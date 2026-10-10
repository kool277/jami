cmake_minimum_required (VERSION 3.10)

# Set the project name and version
set (ProjectName GreenScreen)
set (Version 2.0.0)

project (${ProjectName} VERSION ${Version})

# Set default options
option (DEBUG "Build in debug mode" OFF)

# Set platform to build for
set (PLATFORM_TYPE $ENV{PLATFORM_TYPE}) # can be LINUX or ANDROID
if (PLATFORM_TYPE STREQUAL "ANDROID")
    set (PLATFORM $ENV{ANDROID_ABI}) # can be arm64-v8a, armeabi-v7a or x86_64
elseif(PLATFORM_TYPE STREQUAL "LINUX")
    set (PLATFORM x86_64-linux-gnu) # can be x86_64-linux-gnu
else()
    message(FATAL_ERROR "Platform type not supported for now")
endif ()

# set compilation flags based on platform
if (PLATFORM STREQUAL "x86_64-linux-gnu")
    set (CONTRIB_PLATFORM x86_64-linux-gnu)
elseif (PLATFORM STREQUAL "arm64-v8a")
    set (CONTRIB_PLATFORM aarch64-linux-android)
elseif (PLATFORM STREQUAL "armeabi-v7a")
    set (CONTRIB_PLATFORM arm-linux-androideabi)
elseif (PLATFORM STREQUAL "x86_64")
    set (CONTRIB_PLATFORM x86_64-linux-android)
endif ()

# Set variables
set (CMAKE_CXX_STANDARD 20)
set (CMAKE_CXX_STANDARD_REQUIRED True)
set (DAEMON ${PROJECT_SOURCE_DIR}/../daemon)
set (CONTRIB_PATH ${DAEMON}/contrib)
set (PLUGINS_LIB ${PROJECT_SOURCE_DIR}/../lib)
set (CONTRIB_ROOT_PATH ${CONTRIB_PATH}/${CONTRIB_PLATFORM})
set (CMAKE_BUILD_RPATH "$ORIGIN")
set (SDK_PATH ${PROJECT_SOURCE_DIR}/../SDK)
set (CMAKE_SHARED_LINKER_FLAGS "-Wl,-Bsymbolic")
set (CMAKE_POSITION_INDEPENDENT_CODE ON)
set (ONNX_PATH ${CONTRIB_ROOT_PATH})

# Set platform specific variables
if (PLATFORM_TYPE STREQUAL "ANDROID")
    set (OpenCV_DIR ${CONTRIB_PATH}/native-${CONTRIB_PLATFORM}/opencv/build)
    set (ONNX_SO_PATH ${CONTRIB_PATH}/native-${CONTRIB_PLATFORM}/onnx/build/Linux/Release/libonnxruntime.so)
elseif (PLATFORM_TYPE STREQUAL "LINUX")
    set (ONNX_SO_PATH ${CONTRIB_ROOT_PATH}/lib/onnxruntime/cpu/libonnxruntime.so)
endif ()

find_package (PkgConfig REQUIRED)
list (APPEND PKG_CONFIG_EXECUTABLE "--static")
list (APPEND PKG_CONFIG_EXECUTABLE "--define-variable=prefix=${CONTRIB_ROOT_PATH}")
list (APPEND PKG_CONFIG_EXECUTABLE "--define-variable=includedir=${CONTRIB_ROOT_PATH}/include")
list (APPEND PKG_CONFIG_EXECUTABLE "--define-variable=libdir=${CONTRIB_ROOT_PATH}/lib")

list (APPEND CMAKE_FIND_ROOT_PATH ${CONTRIB_ROOT_PATH})
set (CMAKE_FIND_ROOT_PATH_MODE_PACKAGE BOTH)
list (APPEND CMAKE_PREFIX_PATH ${CONTRIB_ROOT_PATH})

# Find required packages
pkg_search_module (avformat REQUIRED IMPORTED_TARGET libavformat)
pkg_search_module (avdevice REQUIRED IMPORTED_TARGET libavdevice)
pkg_search_module (avfilter REQUIRED IMPORTED_TARGET libavfilter)
pkg_search_module (avcodec REQUIRED IMPORTED_TARGET libavcodec)
pkg_search_module (swresample REQUIRED IMPORTED_TARGET libswresample)
pkg_search_module (swscale REQUIRED IMPORTED_TARGET libswscale)
pkg_search_module (avutil REQUIRED IMPORTED_TARGET libavutil)

find_package (OpenCV 4 REQUIRED)
message ("OpenCV_LIBS: ${OpenCV_LIBS}")
message ("OpenCV_INCLUDE: ${OpenCV_INCLUDE_DIRS}")

add_definitions (-DMSGPACK_NO_BOOST)

if (DEBUG)
    set (CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -g -fsanitize=address -Wall -Wextra -Wno-unused-parameter")
    add_definitions (-D__DEBUG__)
else ()
    set (CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -O3 -Wall -Wextra -Wno-unused-parameter")
endif ()

# Source files
set (plugin_SRC
    main.cpp
    VideoSubscriber.cpp
    pluginMediaHandler.cpp
    pluginProcessor.cpp
    ${PLUGINS_LIB}/common.cpp
    ${PLUGINS_LIB}/accel.cpp
    ${PLUGINS_LIB}/frameUtils.cpp
    ${PLUGINS_LIB}/frameFilter.cpp
)

# Create shared library
add_library (${ProjectName} SHARED ${plugin_SRC})

# Include directories
target_include_directories (${ProjectName} PUBLIC
    ${PROJECT_SOURCE_DIR}
    ${DAEMON}/src
    ${CONTRIB_PATH}/${CONTRIB_PLATFORM}/include
    ${CONTRIB_PATH}/${CONTRIB_PLATFORM}/include/opencv4
    ${ONNX_PATH}/include/onnxruntime/session
    ${ONNX_PATH}/include/onnxruntime/providers/cuda
    ${PLUGINS_LIB}
)

if (PLATFORM_TYPE STREQUAL "ANDROID")
    target_include_directories (${ProjectName} PUBLIC
        ${ONNX_PATH}/include/onnxruntime/providers/nnapi
    )
endif ()

# Link directories
link_directories (
    ${CONTRIB_PATH}/${CONTRIB_PLATFORM}/lib
    ${CONTRIB_PATH}/${CONTRIB_PLATFORM}/lib/opencv4/3rdparty
    ${ONNX_PATH}/lib/onnxruntime/${ONNX_LIBS}
    $ENV{CUDA_HOME}/lib64
)

# Libraries to link
set (LINK_LIBS
    ${OpenCV_LIBS}
    PkgConfig::avformat
    PkgConfig::avdevice
    PkgConfig::avfilter
    PkgConfig::avcodec
    PkgConfig::swresample
    PkgConfig::swscale
    PkgConfig::avutil
    ${ONNX_SO_PATH}
)

# Link libraries to the target
target_link_libraries (${ProjectName} PUBLIC ${LINK_LIBS} )

set_target_properties (${ProjectName} PROPERTIES
    LIBRARY_OUTPUT_DIRECTORY "${PROJECT_BINARY_DIR}/jpl/lib/${PLATFORM}"
)

# JPL manipulation commands for copying runtime files and generating JPL archive
if (PLATFORM_TYPE STREQUAL "ANDROID")
    add_custom_command (
        TARGET ${ProjectName}
        POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy ${PROJECT_SOURCE_DIR}/modelSRC/mModel.onnx ${PROJECT_BINARY_DIR}/jpl/data/model/mModel.onnx
        COMMAND ${CMAKE_COMMAND} -E copy ${PROJECT_SOURCE_DIR}/modelSRC/mModel.ort ${PROJECT_BINARY_DIR}/jpl/data/model/mModel.ort
        COMMAND ${CMAKE_COMMAND} -E copy ${ONNX_SO_PATH} ${PROJECT_BINARY_DIR}/jpl/lib/${PLATFORM}/libonnxruntime.so
        COMMENT "Copying runtime files"
    )
    add_custom_command (
        TARGET ${ProjectName}
        PRE_BUILD
        COMMAND ${Python3_EXECUTABLE} ${SDK_PATH}/jplManipulation.py --preassemble --build-dir ${PROJECT_BINARY_DIR} --plugin=${ProjectName} --distribution=android
        COMMENT "Assembling Plugin files"
    )
    add_custom_command (
        TARGET ${ProjectName}
        POST_BUILD
        COMMAND ${Python3_EXECUTABLE} ${SDK_PATH}/jplManipulation.py --assemble --build-dir ${PROJECT_BINARY_DIR} --plugin=${ProjectName} --distribution=android
        COMMENT "Generating JPL archive"
    )
elseif (PLATFORM_TYPE STREQUAL "LINUX")
    add_custom_command (
        TARGET ${ProjectName}
        POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy ${PROJECT_SOURCE_DIR}/modelSRC/mModel.onnx ${PROJECT_BINARY_DIR}/jpl/data/model/mModel.onnx
        COMMAND ${CMAKE_COMMAND} -E copy ${ONNX_SO_PATH} ${PROJECT_BINARY_DIR}/jpl/lib/${PLATFORM}/libonnxruntime.so.1.16.3
        COMMENT "Copying runtime files"
    )
    add_custom_command (
        TARGET ${ProjectName}
        PRE_BUILD
        COMMAND ${Python3_EXECUTABLE} ${SDK_PATH}/jplManipulation.py --preassemble --build-dir ${PROJECT_BINARY_DIR} --plugin=${ProjectName} --distribution=x86_64-linux-gnu
        COMMENT "Assembling Plugin files"
    )
    add_custom_command (
        TARGET ${ProjectName}
        POST_BUILD
        COMMAND ${Python3_EXECUTABLE} ${SDK_PATH}/jplManipulation.py --assemble --build-dir ${PROJECT_BINARY_DIR} --plugin=${ProjectName} --distribution=x86_64-linux-gnu
        COMMENT "Generating JPL archive"
    )
endif ()
