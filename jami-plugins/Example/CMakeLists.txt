# Copyright (C) 2023-2024 Savoir-faire Linux Inc.

# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation; either version 3 of the License, or
# (at your option) any later version.

# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301 USA.

cmake_minimum_required(VERSION 3.10)

set (PROJECT_NAME Example) # {FILL} Replace Example with the name of your plugin.
set (VERSION 0.0.0) # {FILL} Replace 0.0.0 with the version of your plugin.

project(${PROJECT_NAME} VERSION ${VERSION})

option(VIDEO_FFMPEG "If you'd like to listen to Jami's video stream or modify it, set to ON." OFF) # {FILL}
option(AUDIO_FFMPEG "If you'd like to listen to Jami's audio stream or modify it, set to ON." OFF) # {FILL}
option(ARCHIVE_JPL "If you'd like to end the build process before the generation of a JPL archive, set to OFF." ON) # {FILL}
option(NVIDIA "If you'd like to disable hardware acceleration and use the graphics card for ONNX computation (useful for AI plugins), set to ON." OFF) # {FILL}
option(DEBUG_SIGN "If you'd like to sign the JPL archive created by ARCHIVE_JPL to test it in your Jami client, set to ON. Requires ARCHIVE_JPL to be ON." ON) # {FILL}

set (DAEMON ${PROJECT_SOURCE_DIR}/../daemon)
set (JPL_FILE_NAME ${ProjectName}.jpl)
set (DAEMON_SRC ${DAEMON}/src)
set (CONTRIB_PATH ${DAEMON}/contrib)
set (PLUGINS_LIB ${PROJECT_SOURCE_DIR}/../lib)
set (JPL_DIRECTORY ${PROJECT_BINARY_DIR}/jpl)

# Detect the operating system
if(WIN32)
    set(OS_NAME "WINDOWS")
    set(OUTPUT_JPL "x64-windows")
elseif(ANDROID)
    set(OS_NAME "ANDROID")
    set(OUTPUT_JPL "x86_64-linux-gnu")
elseif(DARWIN)
    set(OS_NAME "UNIX")
    set(OUTPUT_JPL "x86_64-apple-Darwin")
else()
    set(OS_NAME "UNIX")
    set(OUTPUT_JPL "x86_64-linux-gnu")
endif()

# Detect the architecture
if(CMAKE_SIZEOF_VOID_P EQUAL 8)
    set(ARCH "x64")
else()
    message(FATAL_ERROR "Unsupported architecture. Only x64 is supported.")
endif()

# Set platform-specific variables
set(CONTRIB_PLATFORM_CURT ${ARCH})
set(CONTRIB_PLATFORM ${CONTRIB_PLATFORM_CURT}-${OS_NAME})

message(OS: ${OS_NAME} ${ARCH})
message(Building: ${ProjectName} ${Version})
message(Build path: ${PROJECT_BINARY_DIR})
message(JPL assembling path: ${JPL_DIRECTORY})
message(JPL path: ${JPL_DIRECTORY}/../../../build/${ProjectName}/${JPL_FILE_NAME})

# This is specifically to disable hardware acceleration and do computing on the graphics card for computationally expensive AI plugins.
if(NVIDIA)
add_definitions(-DNVIDIA)
set(ONNX_DIR ${ONNX_DIR}/nvidia-gpu)
message(Provider:\ NVIDIA)
set(EXTRA_PATH nvidia-gpu)
set (PREFERENCESFILENAME ${PREFERENCESFILENAME}-accel)
else()
set(ONNX_DIR ${ONNX_DIR}/cpu)
message(Provider:\ NONE)
set(EXTRA_PATH cpu)
endif()

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED True)
set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} /DMSGPACK_NO_BOOST /MT")
set(CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG} /DMSGPACK_NO_BOOST /MTd")

set(SOURCES "")


list(APPEND SOURCES "FILL.cpp"
                    "FILL.cpp" # {FILL} Import manually all .cpp files here in your plugin directory.
    )

# Alternatively, you may comment the list command above, and uncomment the lines below, to automatically include all files ending with .cpp in your project.

# file(GLOB CPP_SOURCES "*.cpp") # All .cpp files in the directory of your plugin ({root}/PLUGIN_NAME) will be collected by cmake.
# list(APPEND SOURCES ${CPP_SOURCES})

if(VIDEO_FFMPEG) # If you previously turned ON video stream capture, these will be imported.
    list(APPEND SOURCES "./../lib/accel.cpp")
    list(APPEND SOURCES "./../lib/frameUtils.cpp")
endif()

if(AUDIO_FFMPEG) # If you previously turned ON audio stream capture, these will be imported.
    list(APPEND SOURCES "./../lib/frameUtils.cpp")
endif()

# list(APPEND SOURCES "./../lib/EDIT_ME.cpp") # {FILL} If you'd like to import any other .cpp files, uncomment this line, and copy it for each import.

add_library(${ProjectName} SHARED ${SOURCES})

target_include_directories(${ProjectName} PUBLIC ${PROJECT_BINARY_DIR}
                                                 ${PROJECT_SOURCE_DIR}
                                                 ${PLUGINS_LIB}
                                                 ${DAEMON_SRC}
                                                 ${CONTRIB_PATH}
                                                 ${CONTRIB_PATH}/build/fmt/include
                                                 ${CONTRIB_PATH}/build/opendht/include
                                                 ${CONTRIB_PATH}/build/msgpack-c/include
                                                 # {FILL} Plugins with computer vision or AI-related functions may be interested in importing the following.
                                                 # ${FFMPEG}/include
                                                 # ${CONTRIB_PATH}/build/opencv/build/install/include
                                                 # ${ONNX_DIR}/../include/session
                                                 # ${ONNX_DIR}/../include/providers/cuda
                                                 )
target_link_directories(${ProjectName} PUBLIC ${CONTRIB_PATH}
                                              ${CONTRIB_PATH}/build/fmt/msvc/Release
                                              # ${FFMPEG}/bin # {FILL} If using FFMPEG.
                                        )

target_link_libraries(${ProjectName} PUBLIC ---FFMPEGLIBS---)

if(CMAKE_CXX_FLAGS_DEBUG)
  set(OUTPUT "${ProjectName}")
  set(CLANG_OPTS "-g -fsanitize=address")
  set(EXTRA_DEBUG_LIBRARIES "-lyaml-cpp")
  set(EXTRA_DEFINES "-D__DEBUG__")
else()
  add_custom_command(
      TARGET ${ProjectName}
      PRE_BUILD
      COMMAND python3 ${PROJECT_SOURCE_DIR}/../SDK/jplManipulation.py --preassemble --plugin=${ProjectName}
      COMMENT "Assembling Plugin files"
  )
endif()

add_custom_command(
    TARGET ${ProjectName}
    PRE_BUILD
    COMMAND python3 ${PROJECT_SOURCE_DIR}/../SDK/jplManipulation.py --preassemble --plugin=${ProjectName}
    COMMENT "Assembling Plugin files"
)


if(WIN32)
# Windows-specific file copying
add_custom_command(
    TARGET ${ProjectName}
    POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy ${PROJECT_BINARY_DIR}/${ProjectName}.lib ${JPL_DIRECTORY}/lib/${CONTRIB_PLATFORM}
    COMMAND ${CMAKE_COMMAND} -E copy ${PROJECT_BINARY_DIR}/${ProjectName}.dll ${JPL_DIRECTORY}/lib/${CONTRIB_PLATFORM}
    COMMENT "Copying files to jpl directory for Windows"
)
elseif(APPLE)
    # macOS-specific file copying
    add_custom_command(
        TARGET ${ProjectName}
        POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy ${PROJECT_BINARY_DIR}/lib${ProjectName}.dylib ${JPL_DIRECTORY}/lib/${CONTRIB_PLATFORM}
        COMMENT "Copying files to jpl directory for macOS"
    )
else()
    # Unix-like systems (Linux, etc.)
    add_custom_command(
        TARGET ${ProjectName}
        POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy ${PROJECT_BINARY_DIR}/lib${ProjectName}.so ${JPL_DIRECTORY}/lib/${CONTRIB_PLATFORM}
        COMMENT "Copying files to jpl directory for Unix-like systems or Android"
    )
endif()

if (NOT ARCHIVE_JPL)
    exit()
endif()

add_custom_command(
    TARGET ${ProjectName}
    POST_BUILD
    COMMAND python3 ${PROJECT_SOURCE_DIR}/../SDK/jplManipulation.py --assemble --plugin=${ProjectName}
    COMMENT "Generating JPL archive"
)

if(NOT EXISTS "${PROJECT_SOURCE_DIR}/../.cert")
    file(MAKE_DIRECTORY "${PROJECT_SOURCE_DIR}/.cert")
endif()

if (DEBUG_SIGN)
    if(NOT EXISTS "${PROJECT_SOURCE_DIR}/../.cert")
        add_custom_command(
            TARGET ${ProjectName}
            POST_BUILD
            COMMAND python3 ${PROJECT_SOURCE_DIR}/../SDK/certKey.py create --subject debug ../.cert/debug
            COMMENT "Generating developer certificate"
        )
    endif()
    if(NOT EXISTS "${PROJECT_SOURCE_DIR}/../.cert/${ProjectName}")
        add_custom_command(
            TARGET ${ProjectName}
            POST_BUILD
            COMMAND python3 ${PROJECT_SOURCE_DIR}/../SDK/certKey.py create --issuer ../.cert/debug --subject ${ProjectName} ../.cert/${ProjectName}/${ProjectName}
            COMMENT "Generating plugin certificate"
        )
    endif()
    add_custom_command(
        TARGET ${ProjectName}
        POST_BUILD
        COMMAND python3 ${PROJECT_SOURCE_DIR}/../SDK/certKey.py sign --path ../build/${OUTPUT_JPL}/${ProjectName} --issuer ../.cert/debug ../build/${OUTPUT_JPL}/${ProjectName}
        COMMENT "Generating plugin certificate"
    )
endif()
