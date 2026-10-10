#! /bin/bash
# Build Jami daemon for architecture specified by ANDROID_ABI
set -e

CURRENTDIR=$(pwd)

if [ -z "$ANDROID_NDK" -o -z "$ANDROID_SDK" ]; then
   echo "You must define ANDROID_NDK, ANDROID_SDK and ANDROID_ABI before starting."
   echo "They must point to your NDK and SDK directories."
   exit 1
fi
if [ -z "$ANDROID_ABI" ]; then
   echo "Please set ANDROID_ABI to your architecture: armeabi-v7a, x86."
   exit 1
fi

platform=$(echo "`uname`" | tr '[:upper:]' '[:lower:]')
arch=`uname -m`

# Set up ABI variables
if [ ${ANDROID_ABI} = "x86" ] ; then
    TARGET="i686-linux-android"
    PJ_TARGET="i686-pc-linux-android"
    PLATFORM_SHORT_ARCH="x86"
elif [ ${ANDROID_ABI} = "x86_64" ] ; then
    TARGET="x86_64-linux-android"
    PJ_TARGET="x86_64-pc-linux-android"
    PLATFORM_SHORT_ARCH="x86_64"
elif [ ${ANDROID_ABI} = "arm64-v8a" ] ; then
    TARGET="aarch64-linux-android"
    PJ_TARGET="aarch64-unknown-linux-android"
    PLATFORM_SHORT_ARCH="arm64"
elif [ ${ANDROID_ABI} = "armeabi-v7a" ] ; then
    TARGET_CC="armv7a-linux-androideabi"
    TARGET="arm-linux-androideabi"
    PJ_TARGET="arm-unknown-linux-androideabi"
    PLATFORM_SHORT_ARCH="arm"
else
    echo "ABI not supported"
    exit 1
fi

TARGET_CC=${TARGET_CC:-$TARGET}

export API=24 # This value is from minSDK in jami-client-android
export ANDROID_API=android-$API
export ANDROID_TOOLCHAIN="${ANDROID_NDK}/toolchains/llvm/prebuilt/linux-x86_64"
export TARGET

# Add the NDK toolchain to the PATH, needed both for contribs and for building
# stub libraries
NDK_TOOLCHAIN_PATH="${ANDROID_TOOLCHAIN}/bin"
export PATH=${NDK_TOOLCHAIN_PATH}:${PATH}
export SYSROOT=$ANDROID_TOOLCHAIN/sysroot

export CROSS_COMPILE="${NDK_TOOLCHAIN_PATH}/${TARGET_TUPLE}-"
export SYSROOT=$ANDROID_TOOLCHAIN/sysroot

if [ -z "$DAEMON_DIR" ]; then
    DAEMON_DIR="$(pwd)/../daemon"
    echo "DAEMON_DIR not provided attempting to find it in $DAEMON_DIR"
fi

if [ ! -d "$DAEMON_DIR" ]; then
    echo 'Daemon not found.'
    echo 'If you cloned the daemon in a custom location override' \
            'DAEMON_DIR to point to it'
    echo "You can also use our meta repo which contains both:
          https://review.jami.net/#/admin/projects/ring-project"
    exit 1
fi
export DAEMON_DIR

# Make in //
MAKEFLAGS=
if which nproc >/dev/null; then
  MAKEFLAGS=-j`nproc`
fi

# Build buildsystem tools
cd $DAEMON_DIR/extras/tools
export PATH=`pwd`/build/bin:$PATH
echo "Building tools"
./bootstrap
make $MAKEFLAGS
make .pkg-config
make .gas

# Setup cross-compilation build environemnt
export AR=$NDK_TOOLCHAIN_PATH/llvm-ar
export AS="$NDK_TOOLCHAIN_PATH/$TARGET_CC$API-clang -c"
export CC=$NDK_TOOLCHAIN_PATH/$TARGET_CC$API-clang
export CXX=$NDK_TOOLCHAIN_PATH/$TARGET_CC$API-clang++
export LD=$NDK_TOOLCHAIN_PATH/ld
export RANLIB=$NDK_TOOLCHAIN_PATH/llvm-ranlib
export STRIP=$NDK_TOOLCHAIN_PATH/llvm-strip

FLAGS_COMMON="-fPIC"
EXTRA_CFLAGS="${EXTRA_CFLAGS} ${FLAGS_COMMON}"
EXTRA_CXXFLAGS="${EXTRA_CXXFLAGS} ${FLAGS_COMMON}"
EXTRA_LDFLAGS="${EXTRA_LDFLAGS} -llog ${FLAGS_COMMON}"

############
# Contribs #
############
echo "Building the contribs"
CONTRIB_DIR=${DAEMON_DIR}/contrib/native-${TARGET}
CONTRIB_SYSROOT=${DAEMON_DIR}/contrib/${TARGET}
mkdir -p ${CONTRIB_DIR}
mkdir -p ${CONTRIB_SYSROOT}/lib/pkgconfig

cd ${CONTRIB_DIR}

# Copy plugin-level contrib rule overrides into daemon's src before bootstrap
# so the generated Makefile picks them up (same role as copy_contrib() in build.py).
for pkg_dir in "$CURRENTDIR"/*/; do
    if [ -f "${pkg_dir}rules.mak" ]; then
        cp -r "${pkg_dir}" "$DAEMON_DIR/contrib/src/"
    fi
done

../bootstrap --host=${TARGET}

make list
make fetch
export PATH="$PATH:$CONTRIB_SYSROOT/bin"
make $MAKEFLAGS .ffmpeg .fmt .msgpack .opencv .opendht .onnx .opus .freetype

echo "Contribs built: .ffmpeg .fmt .msgpack .opencv .opendht .onnx .opus .freetype"
echo "\033[1;32mContribs built successfully \033[1;0m"
