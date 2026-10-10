cmake_minimum_required(VERSION 3.15) # reasonable modern minimum
project(hunspell LANGUAGES CXX)

# Add debug output to verify build configuration
message(STATUS "Configuring hunspell in ${CMAKE_CURRENT_SOURCE_DIR}")
message(STATUS "Build type: ${CMAKE_BUILD_TYPE}")
message(STATUS "Generator: ${CMAKE_GENERATOR}")

include(GNUInstallDirs)

# Source files
set(HUNSPELL_SOURCES
    src/hunspell/affentry.cxx
    src/hunspell/affixmgr.cxx
    src/hunspell/csutil.cxx
    src/hunspell/filemgr.cxx
    src/hunspell/hashmgr.cxx
    src/hunspell/hunspell.cxx
    src/hunspell/hunzip.cxx
    src/hunspell/phonet.cxx
    src/hunspell/replist.cxx
    src/hunspell/suggestmgr.cxx
)

# Ensure build type is set
if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
    set(CMAKE_BUILD_TYPE Release CACHE STRING "Choose the type of build." FORCE)
endif()

# Create the library target
if(MSVC)
    add_library(hunspell STATIC ${HUNSPELL_SOURCES})
    target_compile_definitions(hunspell
        PRIVATE
            _CRT_SECURE_NO_WARNINGS
        PUBLIC
            HUNSPELL_STATIC
    )
    target_compile_options(hunspell
        PRIVATE
            /W4
            /wd4251  # Disable warning about DLL interfaces
            /wd4267  # Disable warning about size_t to int conversion
            /wd4244  # Disable warning about _int64 to int conversion
            /wd4706  # Disable warning about assignment in conditional expression
    )
else()
    add_library(hunspell STATIC ${HUNSPELL_SOURCES})
    target_compile_options(hunspell PRIVATE -Wall -Wextra)
endif()

add_library(hunspell::hunspell ALIAS hunspell)

# Configure the target
set_target_properties(hunspell PROPERTIES
    POSITION_INDEPENDENT_CODE ON
    OUTPUT_NAME "hunspell"
    EXPORT_NAME hunspell
    C_VISIBILITY_PRESET hidden
    CXX_VISIBILITY_PRESET hidden
    VISIBILITY_INLINES_HIDDEN ON
)

# Set include directories
target_include_directories(hunspell
    PUBLIC
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/src>
        $<INSTALL_INTERFACE:include>
    PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/src/hunspell
)

# Create a directory for the exported header files
file(MAKE_DIRECTORY ${CMAKE_BINARY_DIR}/include/hunspell)

# Copy header files to the include directory
file(GLOB HUNSPELL_HEADERS "${CMAKE_CURRENT_SOURCE_DIR}/src/hunspell/*.h*")
file(COPY ${HUNSPELL_HEADERS} DESTINATION ${CMAKE_BINARY_DIR}/include/hunspell)

# Static library settings
set_target_properties(hunspell PROPERTIES
    POSITION_INDEPENDENT_CODE ON
    OUTPUT_NAME "hunspell"
)

# Compile options
target_compile_features(hunspell PRIVATE cxx_std_11)

# Debug logging for include directories
get_property(inc_dirs TARGET hunspell PROPERTY INCLUDE_DIRECTORIES)
message(STATUS "Hunspell include directories: ${inc_dirs}")
message(STATUS "Hunspell binary dir: ${CMAKE_BINARY_DIR}")
message(STATUS "Hunspell source dir: ${CMAKE_CURRENT_SOURCE_DIR}")

# If needed, define anything special
target_compile_definitions(hunspell PRIVATE
    $<$<CXX_COMPILER_ID:MSVC>:_CRT_SECURE_NO_WARNINGS>
)

# Install rules
install(TARGETS hunspell
    EXPORT hunspell-targets
    LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}
    ARCHIVE DESTINATION ${CMAKE_INSTALL_LIBDIR}
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
    INCLUDES DESTINATION ${CMAKE_INSTALL_INCLUDEDIR}
)

install(FILES ${HUNSPELL_HEADERS}
    DESTINATION ${CMAKE_INSTALL_INCLUDEDIR}/hunspell
)
