cmake_minimum_required (VERSION 3.10)

# Set the project name and version
set (ProjectName WaterMark)
set (Version 2.1.0)

project (${ProjectName} VERSION ${Version})

# Set default options
option (DEBUG "Build in debug mode" OFF)

# Set platform to build for
set (PLATFORM_TYPE $ENV{PLATFORM_TYPE}) # can be LINUX or ANDROID or MACOS
if (PLATFORM_TYPE STREQUAL "ANDROID")
    set (PLATFORM $ENV{ANDROID_ABI}) # can be arm64-v8a, armeabi-v7a or x86_64
elseif(PLATFORM_TYPE STREQUAL "LINUX")
    set (PLATFORM x86_64-linux-gnu) # can be x86_64-linux-gnu
elseif(PLATFORM_TYPE STREQUAL "MACOS")
    execute_process(
        COMMAND sh -c "$(command -v cc || command -v gcc) -dumpmachine" # used to create the directory for daemon contribution, see daemon/contrib/bootstrap
        OUTPUT_VARIABLE DUMP_MACHINE_RESULT
        OUTPUT_STRIP_TRAILING_WHITESPACE # remove the trailing "\n"
    )
    set (PLATFORM ${DUMP_MACHINE_RESULT})
    execute_process(
        COMMAND sh -c "uname -m"
        OUTPUT_VARIABLE ARCH
        OUTPUT_STRIP_TRAILING_WHITESPACE # remove the trailing "\n"
    )
    set (PLATFORM_LIB_DIR "${ARCH}-apple-darwin")
else()
    message(FATAL_ERROR "Platform type not supported for now")
endif ()

set(CMAKE_ANDROID_ARCH_ABI ${PLATFORM})

# set compilation flags based on platform
if (PLATFORM STREQUAL "x86_64-linux-gnu")
    set (CONTRIB_PLATFORM x86_64-linux-gnu)
    set (distribution x86_64-linux-gnu)
elseif (PLATFORM STREQUAL "arm64-v8a")
    set (CONTRIB_PLATFORM aarch64-linux-android)
    set (distribution android)
elseif (PLATFORM STREQUAL "armeabi-v7a")
    set (CONTRIB_PLATFORM arm-linux-androideabi)
    set (distribution android)
elseif (PLATFORM STREQUAL "x86_64")
    set (CONTRIB_PLATFORM x86_64-linux-android)
    set (distribution android)
elseif (PLATFORM STREQUAL "x86_64-apple-darwin23.6.0")
    set (CONTRIB_PLATFORM x86_64-apple-darwin23.6.0)
    set (distribution x86_64-apple-darwin23.6.0)
else()
    set (CONTRIB_PLATFORM ${PLATFORM})
    set (dsitribution ${PLATFORM})
endif ()

if (PLATFORM_TYPE STREQUAL "ANDROID")
    # should be removed and use the toolchain in env instead
    set(CMAKE_ANDROID_ARCH_ABI ${PLATFORM}) # Set the desired ABI
    set(CMAKE_ANDROID_STL_TYPE c++_shared) # Use C++ shared library
    set(CMAKE_ANDROID_NDK_TOOLCHAIN_FILE /opt/android/ndk/29.0.14206865/build/cmake/android.toolchain.cmake)
    set(CMAKE_TOOLCHAIN_FILE=/opt/android/ndk/29.0.14206865/build/cmake/android.toolchain.cmake)
    set(CMAKE_C_COMPILER /opt/android/ndk/29.0.14206865/toolchains/llvm/prebuilt/linux-x86_64/bin/${CONTRIB_PLATFORM}30-clang)
    set(CMAKE_CXX_COMPILER /opt/android/ndk/29.0.14206865/toolchains/llvm/prebuilt/linux-x86_64/bin/${CONTRIB_PLATFORM}30-clang++)
endif()

message ("PLATFORM_TYPE: ${PLATFORM_TYPE}")
message ("PLATFORM: ${PLATFORM}")
message ("CONTRIB_PLATFORM: ${CONTRIB_PLATFORM}")
message ("distribution: ${distribution}")

# Set variables
set (CMAKE_CXX_STANDARD 17)
set (CMAKE_CXX_STANDARD_REQUIRED True)
set (DAEMON ${PROJECT_SOURCE_DIR}/../daemon)
set (CONTRIB_PATH ${DAEMON}/contrib)
set (PLUGINS_LIB ${PROJECT_SOURCE_DIR}/../lib)
set (CONTRIB_ROOT_PATH ${CONTRIB_PATH}/${CONTRIB_PLATFORM})
set (CMAKE_BUILD_RPATH "$ORIGIN")
set (SDK_PATH ${PROJECT_SOURCE_DIR}/../SDK)
set (CMAKE_POSITION_INDEPENDENT_CODE ON)

# Set platform specific variables
if (PLATFORM_TYPE STREQUAL "ANDROID")
    set (CMAKE_SHARED_LINKER_FLAGS "-Wl,-Bsymbolic")
elseif (PLATFORM_TYPE STREQUAL "LINUX")
    set (CMAKE_SHARED_LINKER_FLAGS "-Wl,-Bsymbolic")
elseif(PLATFORM_TYPE STREQUAL "MACOS")
    set (CMAKE_SHARED_LINKER_FLAGS "-Wl")
endif ()

find_package(PkgConfig REQUIRED)
list (APPEND PKG_CONFIG_EXECUTABLE "--static")

list (APPEND CMAKE_FIND_ROOT_PATH ${CONTRIB_ROOT_PATH})
set (CMAKE_FIND_ROOT_PATH_MODE_PACKAGE BOTH)
list (APPEND CMAKE_PREFIX_PATH ${CONTRIB_ROOT_PATH})

# Find required packages
pkg_search_module (avformat REQUIRED IMPORTED_TARGET libavformat)
pkg_search_module (avfilter REQUIRED IMPORTED_TARGET libavfilter)
pkg_search_module (avcodec REQUIRED IMPORTED_TARGET libavcodec)
pkg_search_module (avutil REQUIRED IMPORTED_TARGET libavutil)

add_definitions (-DMSGPACK_NO_BOOST)

if (DEBUG)
    set (CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -g -fsanitize=address -Wall -Wextra -Wno-unused-parameter")
    add_definitions (-D__DEBUG__)
else ()
    set (CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -O3 -Wall -Wextra -Wno-unused-parameter")
endif ()

if(PLATEFORM_TYPE STREQUAL "MACOS")
    find_library (COREFOUNDATION CoreFoundation)
    find_library (COREMEDIA CoreMedia)
    find_library (COREVIDEO CoreVideo)
    find_library (CORESERVICES CoreServices)
    find_library (FOUNDATION Foundation)
    find_library (AVFOUNDATION AVFoundation)
    find_library (COREGRAPHICS CoreGraphics)
    set (MACOS_LIBS
        ${COREFOUNDATION}
        ${COREMEDIA}
        ${COREVIDEO}
        ${CORESERVICES}
        ${FOUNDATION}
        ${AVFOUNDATION}
        ${COREGRAPHICS}
    )
endif()
# Source files
set (plugin_SRC
    main.cpp
    PluginPreferenceHandler.cpp
    WatermarkMediaHandler.cpp
    WatermarkVideoSubscriber.cpp
    ${PLUGINS_LIB}/accel.cpp
    ${PLUGINS_LIB}/common.cpp
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
    ${PLUGINS_LIB}
)

# Link directories
link_directories (
    ${CONTRIB_PATH}/${CONTRIB_PLATFORM}/lib
)

# Libraries to link
set (LINK_LIBS
    PkgConfig::avformat
    PkgConfig::avfilter
    PkgConfig::avcodec
    PkgConfig::avutil
)

# Link libraries to the target
target_link_libraries (${ProjectName} PUBLIC  ${MACOS_LIBS} ${LINK_LIBS}) # if the platform is not MACOS, MACOS_LIBS will be empty and will not affect the build

if(PLATFORM_TYPE STREQUAL "MACOS")
    set_target_properties (${ProjectName} PROPERTIES
        LIBRARY_OUTPUT_DIRECTORY "${PROJECT_BINARY_DIR}/jpl/lib/${PLATFORM_LIB_DIR}"
    )
else ()
    set_target_properties (${ProjectName} PROPERTIES
        LIBRARY_OUTPUT_DIRECTORY "${PROJECT_BINARY_DIR}/jpl/lib/${PLATFORM}"
    )
endif()

add_custom_command (
    TARGET ${ProjectName}
    PRE_BUILD
    COMMAND ${Python3_EXECUTABLE} ${SDK_PATH}/jplManipulation.py --preassemble --build-dir ${PROJECT_BINARY_DIR} --plugin=${ProjectName} --distribution=${distribution} --arch=${ARCH}
    COMMENT "Assembling Plugin files"
)
add_custom_command (
    TARGET ${ProjectName}
    POST_BUILD
    COMMAND ${Python3_EXECUTABLE} ${SDK_PATH}/jplManipulation.py --assemble --build-dir ${PROJECT_BINARY_DIR} --plugin=${ProjectName} --distribution=${distribution}
    COMMENT "Generating JPL archive"
)