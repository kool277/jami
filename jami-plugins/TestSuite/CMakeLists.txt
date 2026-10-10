cmake_minimum_required(VERSION 3.10)

# set the project name
set (ProjectName TestSuite)
set (Version 1.0.1)

project(${ProjectName} VERSION ${Version})

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
set (CMAKE_CXX_STANDARD 17)
set (CMAKE_CXX_STANDARD_REQUIRED True)
set (DAEMON ${PROJECT_SOURCE_DIR}/../daemon)
set (CONTRIB_PATH ${DAEMON}/contrib)
set (PLUGINS_LIB ${PROJECT_SOURCE_DIR}/../lib)
set (CONTRIB_ROOT_PATH ${CONTRIB_PATH}/${CONTRIB_PLATFORM})
set (CMAKE_BUILD_RPATH "$ORIGIN")
set (SDK_PATH ${PROJECT_SOURCE_DIR}/../SDK)
set (CMAKE_SHARED_LINKER_FLAGS "-Wl,-Bsymbolic")
set (CMAKE_POSITION_INDEPENDENT_CODE ON)

find_package(PkgConfig REQUIRED)
list(APPEND PKG_CONFIG_EXECUTABLE "--static")

message("Contrib path: ${CONTRIB_ROOT_PATH}")
list(APPEND CMAKE_FIND_ROOT_PATH ${CONTRIB_ROOT_PATH})
set(CMAKE_FIND_ROOT_PATH_MODE_PACKAGE BOTH)
list(APPEND CMAKE_PREFIX_PATH ${CONTRIB_ROOT_PATH})

# Find required packages
pkg_search_module (avformat REQUIRED IMPORTED_TARGET libavformat)
pkg_search_module (avdevice REQUIRED IMPORTED_TARGET libavdevice)
pkg_search_module (avfilter REQUIRED IMPORTED_TARGET libavfilter)
pkg_search_module (avcodec REQUIRED IMPORTED_TARGET libavcodec)
pkg_search_module (swresample REQUIRED IMPORTED_TARGET libswresample)
pkg_search_module (swscale REQUIRED IMPORTED_TARGET libswscale)
pkg_search_module (avutil REQUIRED IMPORTED_TARGET libavutil)

add_definitions (-DMSGPACK_NO_BOOST)

if (DEBUG)
    set (CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -g -fsanitize=address -Wall -Wextra -Wno-unused-parameter")
    add_definitions (-D__DEBUG__)
else ()
    set (CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -O3 -Wall -Wextra -Wno-unused-parameter")
endif ()

set(plugin_SRC
    AudioHandlerTester.cpp
    AudioSubscriberTester.cpp
    VideoHandlerTester.cpp
    VideoSubscriberTester.cpp
    ChatHandlerTester.cpp
    ChatSubscriberTester.cpp
    main.cpp
)



# Create shared library
add_library (${ProjectName} SHARED ${plugin_SRC})

# Include directories
target_include_directories (${ProjectName} PUBLIC
    ${PROJECT_SOURCE_DIR}
    ${DAEMON}/src
    ${CONTRIB_PATH}/${CONTRIB_PLATFORM}/include
    ${PLUGINS_LIB}
)

# Link directories
link_directories (
    ${CONTRIB_PATH}/${CONTRIB_PLATFORM}/lib
)

# Libraries to link
set (LINK_LIBS
    PkgConfig::avformat
    PkgConfig::avdevice
    PkgConfig::avfilter
    PkgConfig::avcodec
    PkgConfig::swresample
    PkgConfig::swscale
    PkgConfig::avutil
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
        PRE_BUILD
        COMMAND ${Python3_EXECUTABLE} ${SDK_PATH}/jplManipulation.py --preassemble --plugin=${ProjectName} --distribution=android
        COMMENT "Assembling Plugin files"
    )
    add_custom_command (
        TARGET ${ProjectName}
        POST_BUILD
        COMMAND ${Python3_EXECUTABLE} ${SDK_PATH}/jplManipulation.py --assemble --plugin=${ProjectName} --distribution=android
        COMMENT "Generating JPL archive"
    )
elseif (PLATFORM_TYPE STREQUAL "LINUX")
    add_custom_command (
        TARGET ${ProjectName}
        PRE_BUILD
        COMMAND ${Python3_EXECUTABLE} ${SDK_PATH}/jplManipulation.py --preassemble --plugin=${ProjectName} --distribution=x86_64-linux-gnu
        COMMENT "Assembling Plugin files"
    )
    add_custom_command (
        TARGET ${ProjectName}
        POST_BUILD
        COMMAND ${Python3_EXECUTABLE} ${SDK_PATH}/jplManipulation.py --assemble --plugin=${ProjectName} --distribution=x86_64-linux-gnu
        COMMENT "Generating JPL archive"
    )
endif ()
