cmake_minimum_required(VERSION 3.10)

# set the project name
set (ProjectName PLUGINID)
set (Version MANIFESTVERSION)

project(${ProjectName} VERSION ${Version})

--- # start FFMPEG Options
option(VIDEO_FFMPEG "Include Video FFMPEG Dependency" OFF)
option(AUDIO_FFMPEG "Include Audio FFMPEG Dependency" OFF)
# end FFMPEG Options ---

set (DAEMON ${PROJECT_SOURCE_DIR}/../daemon)
set (JPL_FILE_NAME ${ProjectName}.jpl)
set (DAEMON_SRC ${DAEMON}/src)
set (CONTRIB_PATH ${DAEMON}/contrib)
set (PLUGINS_LIB ${PROJECT_SOURCE_DIR}/../lib)
set (JPL_DIRECTORY ${PROJECT_BINARY_DIR}/jpl)
set (LIBS_DIR ${PROJECT_SOURCE_DIR}/../contrib/Libs)

# Detect the operating system
if(WIN32)
    set(OS_NAME "WINDOWS")
elseif(ANDROID)
    set(OS_NAME "ANDROID")
else()
    set(OS_NAME "UNIX")
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

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED True)
set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} /DMSGPACK_NO_BOOST /MT")
set(CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG} /DMSGPACK_NO_BOOST /MTd")

set(SOURCES "")
file(GLOB CPP_SOURCES "*.cpp")
list(APPEND SOURCES ${CPP_SOURCES})
--- # if VIDEO_FFMPEG
if(VIDEO_FFMPEG)
    list(APPEND SOURCES "./../lib/accel.cpp")
    list(APPEND SOURCES "./../lib/frameUtils.cpp")
endif()
#  endif VIDEO_FFMPEG ---
--- # if AUDIO_FFMPEG
if(AUDIO_FFMPEG)
    list(APPEND SOURCES "./../lib/frameUtils.cpp")
endif()
#  endif AUDIO_FFMPEG ---
add_library(${ProjectName} SHARED ${SOURCES})

target_include_directories(${ProjectName} PUBLIC ${PROJECT_BINARY_DIR}
                                                 ${PROJECT_SOURCE_DIR}
                                                 ${PLUGINS_LIB}
                                                 ${DAEMON_SRC}
                                                 ${CONTRIB_PATH}
                                                 ${CONTRIB_PATH}/build/fmt/include
                                                 ${CONTRIB_PATH}/build/opendht/include
                                                 ${CONTRIB_PATH}/build/msgpack-c/include
                                                 ---${FFMPEG}/include---
                                                 )
target_link_directories(${ProjectName} PUBLIC ${CONTRIB_PATH}
                                              ${CONTRIB_PATH}/build/fmt/msvc/Release
                                        ---${FFMPEG}/bin---
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

add_custom_command(
    TARGET ${ProjectName}
    POST_BUILD
    COMMAND python3 ${PROJECT_SOURCE_DIR}/../SDK/jplManipulation.py --assemble --plugin=${ProjectName}
    COMMENT "Generating JPL archive"
)