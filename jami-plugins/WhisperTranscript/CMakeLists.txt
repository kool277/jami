cmake_minimum_required(VERSION 3.10)

# set the project name
set (ProjectName WhisperTranscript)
set (Version 1.0.1)

project(${ProjectName} VERSION ${Version})
option(ARCHIVE_JPL "Set to OFF to end the build process before the generation of the JPL archive file." ON)
option(DEBUG_SIGN "Set to ON to sign the JPL archive file created by ARCHIVE_JPL to enable testing the JPL archive file in the Jami client. Requires the ARCHIVE_JPL value to be set to ON." OFF) # {FILL}
option(BUILD_STANDALONE "Enable standalone test tool" OFF)
option(BUILD_CONTRIB "Build contrib to CONTRIB_PATH" ON)

# Add an option for BLAS support
option(GGML_BLAS "Enable BLAS support for Whisper C++" OFF)

# Pass the GGML_BLAS option as a definition
if(GGML_BLAS)
    add_compile_definitions(GGML_BLAS=1)
    message(STATUS "BLAS support enabled for Whisper C++")
else()
    message(STATUS "BLAS support disabled for Whisper C++")
endif()

set (DAEMON ${PROJECT_SOURCE_DIR}/../daemon)
set (JPL_FILE_NAME ${ProjectName}.jpl)
set (DAEMON_SRC ${DAEMON}/src)
set (CONTRIB_BASE_PATH ${DAEMON}/contrib)
set (CONTRIB_PATH ${CONTRIB_BASE_PATH}/${CMAKE_LIBRARY_ARCHITECTURE})
set (PLUGINS_LIB ${PROJECT_SOURCE_DIR}/../lib)
set (JPL_DIRECTORY ${PROJECT_BINARY_DIR}/jpl)
set (LIBS_DIR ${PROJECT_SOURCE_DIR}/../contrib/Libs)


# Detect the operating system
if(WIN32)
    #set(FFMPEG_PATH "${CONTRIB_BASE_PATH}/build/ffmpeg/Build/windows/x64")
    set(OUTPUT_JPL "x64-windows")
elseif(ANDROID)
    #set(FFMPEG_PATH "${CONTRIB_BASE_PATH}/build/ffmpeg/Build/android")
    set(OUTPUT_JPL "x86_64-linux-gnu")
elseif(DARWIN)
    set(OUTPUT_JPL "x86_64-apple-Darwin")
else()
    #set(FFMPEG_PATH "/home/pmagnier-slimani/Documents/Jami/jami-plugins/contrib/FFmpeg")
    set(OUTPUT_JPL "x86_64-linux-gnu")
endif()

# Set platform-specific variables
set(CONTRIB_PLATFORM_CURT ${ARCH})
set(CONTRIB_PLATFORM ${OUTPUT_JPL})

message(OS: ${OS_NAME} ${ARCH})
message(Building: ${ProjectName} ${Version})
message(Build path: ${PROJECT_BINARY_DIR})
message(JPL assembling path: ${JPL_DIRECTORY})
message(JPL path: ${JPL_DIRECTORY}/../../../build/${ProjectName}/${JPL_FILE_NAME})
message(Contrib path: ${CONTRIB_BASE_PATH}/${CMAKE_LIBRARY_ARCHITECTURE})
message(Target: ${CONTRIB_BASE_PATH}/${TARGET})
set(TARGET ${CMAKE_LIBRARY_ARCHITECTURE})

include (GNUInstallDirs)
list(APPEND CMAKE_FIND_ROOT_PATH ${CONTRIB_PATH})
set(CMAKE_FIND_ROOT_PATH_MODE_PACKAGE BOTH)
list(APPEND CMAKE_PREFIX_PATH ${CONTRIB_PATH})

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED True)


if (BUILD_CONTRIB)
    message(STATUS "Starting contrib build process...")
    if (NOT MSVC)
        set(CONTRIB_BUILD_PATH ${CONTRIB_BASE_PATH}/native-${TARGET})
        message(STATUS "Contrib build path: ${CONTRIB_BUILD_PATH}")
        message(STATUS "Contrib path: ${CONTRIB_PATH}")

        file(MAKE_DIRECTORY ${CONTRIB_BUILD_PATH})
        file(MAKE_DIRECTORY ${CONTRIB_PATH})

        if (ANDROID)
            message(STATUS "Configuring Android build environment...")
            # See https://developer.android.com/ndk/guides/other_build_systems
            set(ENV{ANDROID_NDK} ${ANDROID_NDK})
            set(ENV{ANDROID_ABI} ${ANDROID_ABI})
            set(ENV{ANDROID_API} ${ANDROID_PLATFORM})
            set(ENV{TOOLCHAIN} ${ANDROID_TOOLCHAIN_ROOT})
            set(ENV{TARGET} ${TARGET})
            set(ENV{API} ${ANDROID_PLATFORM_LEVEL})
            set(ENV{CC} $ENV{TOOLCHAIN}/bin/${TARGET}$ENV{API}-clang)
            set(ENV{CXX} $ENV{TOOLCHAIN}/bin/${TARGET}$ENV{API}-clang++)
            set(ENV{AS} "$ENV{CC} -c")
            set(ENV{AR} ${CMAKE_AR})
            set(ENV{RANLIB} ${CMAKE_RANLIB})
            set(ENV{STRIP} ${CMAKE_STRIP})
            set(ENV{LD} $ENV{TOOLCHAIN}/bin/ld)
            message(STATUS "Android NDK: $ENV{ANDROID_NDK}")
            message(STATUS "Android ABI: $ENV{ANDROID_ABI}")
            message(STATUS "Android Toolchain: $ENV{TOOLCHAIN}")
        endif()

        message(STATUS "Acquiring build directory lock...")
        file(LOCK ${CONTRIB_BUILD_PATH} DIRECTORY)

        message(STATUS "Running bootstrap...")
        execute_process(
            COMMAND ${CONTRIB_BASE_PATH}/bootstrap --host=${TARGET}
            WORKING_DIRECTORY ${CONTRIB_BUILD_PATH}
            RESULT_VARIABLE BOOTSTRAP_RESULT
        )
        if(BOOTSTRAP_RESULT)
            message(FATAL_ERROR "Bootstrap failed with error code: ${BOOTSTRAP_RESULT}")
        endif()

        message(STATUS "Running make list...")
        execute_process(COMMAND make list
            WORKING_DIRECTORY ${CONTRIB_BUILD_PATH}
            RESULT_VARIABLE LIST_RESULT
        )
        if(LIST_RESULT)
            message(WARNING "Make list returned: ${LIST_RESULT}")
        endif()

        # build with the number of processors
        #set(CONTRIB_BUILD_FLAGS -j${CMAKE_BUILD_PARALLEL_LEVEL})
        set(CONTRIB_BUILD_FLAGS -j16)
        message(STATUS "Build flags: ${CONTRIB_BUILD_FLAGS}")

        # If we build the standalone then we don't want ffmpeg minimal
        if (BUILD_STANDALONE)
            message(STATUS "Building standalone version...")
            execute_process(
                COMMAND ${CMAKE_COMMAND} -E env WITH_FREETYPE=1 WITH_HARFBUZZ=1
                make .fmt .whispercpp .ffmpeg ${CONTRIB_BUILD_FLAGS}
                WORKING_DIRECTORY ${CONTRIB_BUILD_PATH}
                RESULT_VARIABLE BUILD_RESULT
                )
        else()
            message(STATUS "Building minimal version...")
            execute_process(
                COMMAND ${CMAKE_COMMAND} -E env FFMPEG_MINIMAL=1 WITH_FREETYPE=1 WITH_HARFBUZZ=1
                make .fmt .whispercpp .ffmpeg ${CONTRIB_BUILD_FLAGS}
                WORKING_DIRECTORY ${CONTRIB_BUILD_PATH}
                RESULT_VARIABLE BUILD_RESULT
                )
        endif()

        if(BUILD_RESULT)
            message(FATAL_ERROR "Build failed with error code: ${BUILD_RESULT}")
        else()
            message(STATUS "Build completed successfully")
        endif()

        message(STATUS "Releasing build directory lock...")
        file(LOCK ${CONTRIB_BUILD_PATH} DIRECTORY RELEASE)
    else()
        message(STATUS "Building on MSVC...")
        # Set contrib build path for Windows
        set(CONTRIB_BUILD_PATH ${CONTRIB_BASE_PATH}/native-${TARGET})
        file(MAKE_DIRECTORY ${CONTRIB_BUILD_PATH})

        # Run bootstrap.bat instead of bootstrap for Windows
        execute_process(
            COMMAND cmd /c "${CONTRIB_BASE_PATH}/bootstrap.bat"
            WORKING_DIRECTORY ${CONTRIB_BUILD_PATH}
            RESULT_VARIABLE BOOTSTRAP_RESULT
        )

        if(BOOTSTRAP_RESULT)
            message(FATAL_ERROR "Bootstrap failed with error code: ${BOOTSTRAP_RESULT}")
        endif()

        # Use make.bat for Windows builds
        execute_process(
            COMMAND cmd /c "make.bat" .fmt .whispercpp .ffmpeg
            WORKING_DIRECTORY ${CONTRIB_BUILD_PATH}
            RESULT_VARIABLE BUILD_RESULT
        )

        if(BUILD_RESULT)
            message(FATAL_ERROR "Contrib build failed with error code: ${BUILD_RESULT}")
        endif()

        message(STATUS "Contrib build successful")
    endif()
endif()


include(FindPkgConfig)
list(APPEND PKG_CONFIG_EXECUTABLE "--static")
pkg_search_module (fmt REQUIRED IMPORTED_TARGET fmt)
pkg_search_module (whisper REQUIRED IMPORTED_TARGET whisper)
# ffmpeg
pkg_search_module (swscale REQUIRED IMPORTED_TARGET libswscale)
pkg_search_module (swresample REQUIRED IMPORTED_TARGET libswresample)
pkg_search_module (avformat REQUIRED IMPORTED_TARGET libavformat)
pkg_search_module (avcodec REQUIRED IMPORTED_TARGET libavcodec)
pkg_search_module (avfilter REQUIRED IMPORTED_TARGET libavfilter)
pkg_search_module (avutil REQUIRED IMPORTED_TARGET libavutil)

include_directories(SYSTEM ${CONTRIB_PATH}/include)
include_directories(SYSTEM ${CONTRIB_BASE_PATH}/native-${TARGET}/whispercpp/ggml/include)
link_directories(${CONTRIB_PATH}/lib)


set(plugin_SRC stt_whisper.cpp
               TranscriptVideoSubscriber.cpp
               TranscriptAudioSubscriber.cpp
               PluginPreferenceHandler.cpp
               main.cpp
               TranscriptMediaHandler.cpp
               ./../lib/accel.cpp
               ./../lib/frameUtils.cpp
               ./../lib/frameFilter.cpp
               ./../lib/resampler.cpp
               ./../lib/common.cpp
               )

set(plugin_HDR stt_whisper.h
               TranscriptAudioSubscriber.h
               TranscriptVideoSubscriber.h
               PluginPreferenceHandler.h
               TranscriptMediaHandler.h
               ./../lib/accel.h
               ./../lib/frameScaler.h
               ./../lib/frameUtils.h
               ./../lib/pluglog.h
               ./../lib/frameFilter.h
               ./../lib/resampler.h
               )

if(BUILD_STANDALONE)
    add_executable(${ProjectName} ${plugin_SRC} ${plugin_HDR})
    target_compile_definitions(${ProjectName} PRIVATE -DSTANDALONE)
else()
    add_library(${ProjectName} SHARED ${plugin_SRC}
                                    ${plugin_HDR}
                                    )
endif()

target_include_directories(${ProjectName} PUBLIC ${PROJECT_BINARY_DIR}
                                                 ${PROJECT_SOURCE_DIR}
                                                 ${PLUGINS_LIB}
                                                 ${DAEMON_SRC}
                                                 ${CONTRIB_BASE_PATH}
                                                 ${CONTRIB_BASE_PATH}/build/fmt/include
                                                 ${CONTRIB_BASE_PATH}/build/opendht/include
                                                 ${CONTRIB_BASE_PATH}/build/msgpack-c/include
                                                 #${FFMPEG_PATH}/include
                                                 )
target_link_directories(${ProjectName} PUBLIC ${CONTRIB_BASE_PATH}
                                              ${CONTRIB_BASE_PATH}/build/fmt/msvc/Release
                                        #${FFMPEG_PATH}/bin
                                        )

target_link_options(${PROJECT_NAME} PRIVATE
    -Wl,-Bsymbolic
    -Wall -Wextra
)

target_link_libraries(${ProjectName} PUBLIC
    PkgConfig::fmt
    PkgConfig::whisper
    PkgConfig::swscale
    PkgConfig::swresample
    PkgConfig::avformat
    PkgConfig::avcodec
    PkgConfig::avfilter
    PkgConfig::avutil
)

if(BUILD_STANDALONE)
    target_link_libraries(${ProjectName} PRIVATE -lyaml-cpp)
else()
    add_custom_command(
        TARGET ${ProjectName}
        PRE_BUILD
        COMMAND python3 ${PROJECT_SOURCE_DIR}/../SDK/jplManipulation.py --preassemble --build-dir ${PROJECT_BINARY_DIR} --plugin=${ProjectName}
        COMMENT "Assembling Plugin files"
    )
    if(WIN32)
        # Windows-specific file copying
        add_custom_command(
            TARGET ${ProjectName}
            POST_BUILD
            COMMAND ${CMAKE_COMMAND} -E copy ${PROJECT_BINARY_DIR}/${ProjectName}.lib ${JPL_DIRECTORY}/lib/${CONTRIB_PLATFORM}/
            COMMAND ${CMAKE_COMMAND} -E copy ${PROJECT_BINARY_DIR}/${ProjectName}.dll ${JPL_DIRECTORY}/lib/${CONTRIB_PLATFORM}/
            COMMENT "Copying files to jpl directory for Windows"
        )
    elseif(APPLE)
        # macOS-specific file copying
        add_custom_command(
            TARGET ${ProjectName}
            POST_BUILD
            COMMAND ${CMAKE_COMMAND} -E copy ${PROJECT_BINARY_DIR}/lib${ProjectName}.dylib ${JPL_DIRECTORY}/lib/${CONTRIB_PLATFORM}/
            COMMENT "Copying files to jpl directory for macOS"
        )
    else()
        # Unix-like systems (Linux, etc.)
        add_custom_command(
            TARGET ${ProjectName}
            POST_BUILD
            COMMAND ${CMAKE_COMMAND} -E copy ${PROJECT_BINARY_DIR}/lib${ProjectName}.so ${JPL_DIRECTORY}/lib/${CONTRIB_PLATFORM}/
            COMMENT "Copying files to jpl directory for Unix-like systems or Android"
        )
    endif()

    if (ARCHIVE_JPL)
        add_custom_command(
            TARGET ${ProjectName}
            POST_BUILD
            COMMAND python3 ${PROJECT_SOURCE_DIR}/../SDK/jplManipulation.py --assemble --build-dir ${PROJECT_BINARY_DIR} --plugin=${ProjectName}
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
                    COMMAND python3 ${PROJECT_SOURCE_DIR}/../SDK/certKey.py create --subject debug ${PROJECT_SOURCE_DIR}/../.cert/debug
                    COMMENT "Generating developer certificate"
                )
            endif()
            if(NOT EXISTS "${PROJECT_SOURCE_DIR}/../.cert/${ProjectName}")
                add_custom_command(
                    TARGET ${ProjectName}
                    POST_BUILD
                    COMMAND python3 ${PROJECT_SOURCE_DIR}/../SDK/certKey.py create --issuer ${PROJECT_SOURCE_DIR}/../.cert/debug --subject ${ProjectName} ${PROJECT_SOURCE_DIR}/../.cert/${ProjectName}/${ProjectName}
                    COMMENT "Generating plugin certificate"
                )
            endif()
            add_custom_command(
                TARGET ${ProjectName}
                POST_BUILD
                COMMAND python3 ${PROJECT_SOURCE_DIR}/../SDK/certKey.py --plugin sign --path ${PROJECT_SOURCE_DIR}/../build/${OUTPUT_JPL}/${ProjectName}.jpl --issuer ${PROJECT_SOURCE_DIR}/../.cert/${ProjectName}/${ProjectName} ${PROJECT_SOURCE_DIR}/../build/${OUTPUT_JPL}/${ProjectName}-signed
                COMMENT "Signing plugin"
            )
        endif()
    endif()
endif()