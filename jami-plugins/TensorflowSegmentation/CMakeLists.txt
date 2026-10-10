cmake_minimum_required(VERSION 3.10)

# set the project name
set (ProjectName TensorflowSegmentation)
set (Version 1.0.2)

project(${ProjectName} VERSION ${Version})

set (DAEMON ${PROJECT_SOURCE_DIR}/../daemon)
set (PLUGIN_NAME TensorflowSegmentation)
set (JPL_FILE_NAME ${PLUGIN_NAME}.jpl)
set (DAEMON_SRC ${DAEMON}/src)
set (CONTRIB_PATH ${DAEMON}/contrib)
set (PLUGINS_LIB ${PROJECT_SOURCE_DIR}/../lib)
set (JPL_DIRECTORY ${PROJECT_BINARY_DIR}/jpl)
set (LIBS_DIR ${PROJECT_SOURCE_DIR}/../contrib/Libs)

if(WIN32)
    message(OS:\  WINDOWS\ ${CMAKE_SYSTEM_PROCESSOR})
    if (NOT ${CMAKE_CL_64})
        message( FATAL_ERROR "\nUse CMake only for x64 Windows" )
    endif()
    set (CONTRIB_PLATFORM_CURT x64)
    set (CONTRIB_PLATFORM ${CONTRIB_PLATFORM_CURT}-windows)
    set (LIBRARY_FILE_NAME ${PLUGIN_NAME}.dll)
    set (LIBS_BIN_DIR $ENV{PLUGIN_ENV})
    set (FFMPEG ${CONTRIB_PATH}/build/ffmpeg/Build/win32/x64)
endif()

if(UNIX)
    message( FATAL_ERROR "\nUse CMake only for Windows! For linux or Android (linux host), use our bash scripts.\nPlese refer to documentation for more infos." )
    message(OS:\  LINUX\ ${CMAKE_SYSTEM_PROCESSOR})
    set (CONTRIB_PLATFORM_CURT ${CMAKE_SYSTEM_PROCESSOR})
    set (CONTRIB_PLATFORM ${CONTRIB_PLATFORM_CURT}-linux-gnu)
    set (LIBRARY_FILE_NAME lib${PLUGIN_NAME}.so)
    set (LIBS_BIN_DIR /home/${USER}/Libs)
endif()


message(Building:\   ${ProjectName}\   ${Version})
message(Build\ path:\ ${PROJECT_BINARY_DIR})
message(JPL\ assembling\ path:\ ${JPL_DIRECTORY})
message(JPL\ path:\ ${JPL_DIRECTORY}/../../../build/${ProjectName}/${JPL_FILE_NAME})

set(TENSORFLOW _tensorflow_cc)
set(model mModel-resnet50float.pb)
set(modelType .pb)
set(preferencesFile preferences-tfcc.json)
set(TFLIB libtensorflow_cc)
set(GPU -gpu61)

if (CPU)
    set(GPU )
    add_definitions(-DCPU)
    message(CPU\ BUILDING!)
endif()

if (TFLITE)
    add_definitions(-DTFLITE)
    set(TENSORFLOW _tensorflowLite)
    set(model mobilenet_v2_deeplab_v3_256_myquant.tflite)
    set(modelType .tflite)
    set(preferencesFile preferences-tflite.json)
    set(TFLIB libtensorflowlite)
    message(TFLITE\ BUILDING!)
endif()

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED True)
set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} /MT")
set(CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG} /MTd")

set(plugin_SRC main.cpp
               pluginInference.cpp
               pluginMediaHandler.cpp
               pluginParameters.cpp
               pluginProcessor.cpp
               TFInference.cpp
               videoSubscriber.cpp
               ./../lib/accel.cpp
               ./../lib/frameUtils.cpp
               )

set(plugin_HDR pluginInference.h
               pluginMediaHandler.h
               pluginParameters.h
               pluginProcessor.h
               TFInference.h
               TFModels.h
               videoSubscriber.h
               ./../lib/accel.h
               ./../lib/frameScaler.h
               ./../lib/frameUtils.h
               ./../lib/pluglog.h
               )



# add the library
add_library(${ProjectName} SHARED ${plugin_SRC}
                                  ${plugin_HDR}
                                  )

if (WIN32)
target_include_directories(${ProjectName} PUBLIC ${PROJECT_BINARY_DIR}
                                                 ${PROJECT_SOURCE_DIR}
                                                 ${PLUGINS_LIB}
                                                 ${DAEMON_SRC}
                                                 ${CONTRIB_PATH}
                                                 ${FFMPEG}/include
                                                 ${CONTRIB_PATH}/build/opencv/build/install/include
                                                 ${LIBS_DIR}/${TENSORFLOW}/include
                                                 ${LIBS_DIR}/${TENSORFLOW}/include/third_party/eigen3
                                                 ${LIBS_DIR}/${TENSORFLOW}/include/flatbuffers
                                                 )
target_link_directories(${ProjectName} PUBLIC ${CONTRIB_PATH}
                                        ${LIBS_BIN_DIR}/${TENSORFLOW}/lib/${CONTRIB_PLATFORM}
                                        ${CONTRIB_PATH}/build/opencv/build/lib/Release
                                        ${CONTRIB_PATH}/build/opencv/build/3rdparty/lib/Release
                                        ${FFMPEG}/bin
                                        )

target_link_libraries(${ProjectName} PUBLIC swscale avutil libpng opencv_imgcodecs411 opencv_imgproc460 opencv_core460 ${TFLIB} zlib)
endif()

if (UNIX)
target_include_directories(${ProjectName} PUBLIC ${PROJECT_BINARY_DIR}
                                                 ${PROJECT_SOURCE_DIR}
                                                 ${PLUGINS_LIB}
                                                 ${DAEMON_SRC}
                                                 ${CONTRIB_PATH}/${CONTRIB_PLATFORM}/include
                                                 ${CONTRIB_PATH}/${CONTRIB_PLATFORM}/include/opencv4
                                                 ${LIBS_DIR}/${TENSORFLOW}/include
                                                 ${LIBS_DIR}/${TENSORFLOW}/include/third_party/eigen3
                                                 ${LIBS_DIR}/${TENSORFLOW}/include/flatbuffers
                                                 )
link_directories(${ProjectName} PUBLIC    ${CONTRIB_PATH}
                                        ${LIBS_BIN_DIR}/${TENSORFLOW}/lib/${CONTRIB_PLATFORM}
                                        ${CONTRIB_PATH}/${CONTRIB_PLATFORM}/lib
                                        ${CONTRIB_PATH}/${CONTRIB_PLATFORM}/lib/opencv4/3rdparty
                                        )
target_link_libraries(${ProjectName} PUBLIC swscale avutil libpng opencv_imgcodecs opencv_imgproc opencv_core ${TFLIB})
endif()

add_custom_command(
    TARGET ${ProjectName}
    PRE_BUILD
    COMMAND python ${PROJECT_SOURCE_DIR}/../SDK/jplManipulation.py --preassemble --plugin=TensorflowSegmentation
    COMMAND ${CMAKE_COMMAND} -E copy_directory ${LIBS_BIN_DIR}/${TENSORFLOW}/lib/ ${JPL_DIRECTORY}/lib
    COMMAND ${CMAKE_COMMAND} -E make_directory ${JPL_DIRECTORY}/data/models
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_SOURCE_DIR}/modelsSRC/${model} ${JPL_DIRECTORY}/data/models
    COMMAND ${CMAKE_COMMAND} -E rename ${JPL_DIRECTORY}/data/models/${model} ${JPL_DIRECTORY}/data/models/mModel${modelType}
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_SOURCE_DIR}/${preferencesFile} ${JPL_DIRECTORY}/data
    COMMAND ${CMAKE_COMMAND} -E rename ${JPL_DIRECTORY}/data/${preferencesFile} ${JPL_DIRECTORY}/data/preferences.json
    COMMENT "Assembling Plugin files"
)

if (WIN32)
    add_custom_command(
        TARGET ${ProjectName}
        POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E make_directory ${JPL_DIRECTORY}/../../../build/x64-windows/${TENSORFLOW}
        COMMAND ${CMAKE_COMMAND} -E copy ${PROJECT_BINARY_DIR}/Release/${ProjectName}.lib ${JPL_DIRECTORY}/lib/${CONTRIB_PLATFORM}
        COMMAND ${CMAKE_COMMAND} -E copy ${PROJECT_BINARY_DIR}/Release/${LIBRARY_FILE_NAME} ${JPL_DIRECTORY}/lib/${CONTRIB_PLATFORM}
        COMMAND python ${PROJECT_SOURCE_DIR}/../SDK/jplManipulation.py --assemble --plugin=TensorflowSegmentation --extraPath=${TENSORFLOW}
        COMMENT "Generating JPL archive"
    )
else()
    add_custom_command(
        TARGET ${ProjectName}
        POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E make_directory ${JPL_DIRECTORY}/../../../build/x86_64-linux-gnu/${TENSORFLOW}
        COMMAND ${CMAKE_COMMAND} -E copy ${PROJECT_BINARY_DIR}/${LIBRARY_FILE_NAME} ${JPL_DIRECTORY}/lib/${CONTRIB_PLATFORM}
        COMMAND python ${PROJECT_SOURCE_DIR}/../SDK/jplManipulation.py --assemble --plugin=TensorflowSegmentation --extraPath=${TENSORFLOW}
        COMMENT "Generating JPL archive"
    )

endif()