cmake_minimum_required(VERSION 3.10)
project(translate_test)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(PLUGIN_SRC  ${PROJECT_SOURCE_DIR}/..)
set(PLUGINS_LIB ${PROJECT_SOURCE_DIR}/../../lib)
set(CONTRIB     ${PROJECT_SOURCE_DIR}/../../daemon/contrib/x86_64-linux-gnu)
set(ORT_ROOT    ${CONTRIB}/lib/onnxruntime/cpu)
# Extract the SONAME from the ORT library so the versioned symlink can be created
# next to the binary (required for $ORIGIN RPATH resolution at runtime).
execute_process(
    COMMAND sh -c "objdump -p ${ORT_ROOT}/libonnxruntime.so | awk '/SONAME/ {print $2}'"
    OUTPUT_VARIABLE ORT_SONAME
    OUTPUT_STRIP_TRAILING_WHITESPACE
)
# For GPU builds swap the ORT_ROOT path:
#   AMD  (ROCm):     set(ORT_ROOT ${CONTRIB}/lib/onnxruntime/rocm)
#   Intel (OpenVINO): set(ORT_ROOT ${CONTRIB}/lib/onnxruntime/openvino)

set(CMAKE_BUILD_RPATH "$ORIGIN")
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -O2 -Wall -Wextra -Wno-unused-parameter")

add_definitions(-DMSGPACK_NO_BOOST)

find_package(ICU REQUIRED COMPONENTS uc i18n)

add_executable(translate_test
    test_main.cpp
    ${PLUGIN_SRC}/Translator.cpp
)

target_include_directories(translate_test PRIVATE
    ${PLUGIN_SRC}
    ${PLUGINS_LIB}
    ${CONTRIB}/include
    ${CONTRIB}/include/onnxruntime/session
)

target_link_libraries(translate_test PRIVATE
    ${ORT_ROOT}/libonnxruntime.so
    ${CONTRIB}/lib/libsentencepiece.so
    ${CONTRIB}/lib/libfasttext.so
    ICU::i18n
    ICU::uc
)

# Copy runtime libs next to the binary so RPATH=$ORIGIN resolves them.
# Also create a versioned symlink for libonnxruntime so the dynamic linker
# can resolve the SONAME embedded in the binary (e.g. libonnxruntime.so.1.16.3).
add_custom_command(TARGET translate_test POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        ${ORT_ROOT}/libonnxruntime.so
        $<TARGET_FILE_DIR:translate_test>/libonnxruntime.so
    COMMAND ${CMAKE_COMMAND} -E create_symlink
        libonnxruntime.so
        $<TARGET_FILE_DIR:translate_test>/${ORT_SONAME}
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        ${CONTRIB}/lib/libsentencepiece.so.0
        $<TARGET_FILE_DIR:translate_test>/libsentencepiece.so.0
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
        ${CONTRIB}/lib/libfasttext.so.0
        $<TARGET_FILE_DIR:translate_test>/libfasttext.so.0
)

if(EXISTS ${ORT_ROOT}/libonnxruntime_providers_shared.so)
    add_custom_command(TARGET translate_test POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_if_different
            ${ORT_ROOT}/libonnxruntime_providers_shared.so
            $<TARGET_FILE_DIR:translate_test>/libonnxruntime_providers_shared.so
        COMMAND ${CMAKE_COMMAND} -E copy_if_different
            ${ORT_ROOT}/libonnxruntime_providers_cuda.so
            $<TARGET_FILE_DIR:translate_test>/libonnxruntime_providers_cuda.so
    )
endif()