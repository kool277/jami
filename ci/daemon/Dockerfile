# Build environment for jami-daemon. Package list follows
# jami-daemon/Dockerfile (Ubuntu 24.04); sources are bind-mounted at
# /src instead of copied, so build/ and contrib/ persist between runs.
FROM ubuntu:24.04

ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    autoconf \
    automake \
    autopoint \
    bison \
    build-essential \
    ca-certificates \
    cmake \
    meson \
    curl \
    git \
    libarchive-dev \
    libasio-dev \
    libasound2-dev \
    libdbus-1-dev \
    libexpat1-dev \
    libgmp-dev \
    nettle-dev \
    libgnutls28-dev \
    libjsoncpp-dev \
    libmsgpack-dev \
    libnatpmp-dev \
    libopus-dev \
    libpipewire-0.3-dev \
    libpulse-dev \
    libspeex-dev \
    libspeexdsp-dev \
    libssl-dev \
    libsystemd-dev \
    libtool \
    libudev-dev \
    libupnp-dev \
    libva-dev \
    libvdpau-dev \
    libvpx-dev \
    libx264-dev \
    libyaml-cpp-dev \
    libargon2-dev \
    libwebrtc-audio-processing-dev \
    libsecp256k1-dev \
    guile-3.0-dev \
    nasm \
    pkg-config \
    yasm \
    libcppunit-dev \
    ninja-build \
    sip-tester \
    # contrib bootstrap needs these (BUILD.md); dbus to run jamid
    python3 \
    gawk \
    debianutils \
    dbus \
    dbus-x11 \
    && rm -rf /var/lib/apt/lists/*

# contrib/src/yffi (y-crdt) is built with cargo. The toolchain lives
# read-only in the image; crates are cached under CARGO_HOME at run time.
ARG RUST_VERSION=1.97.1
ENV RUSTUP_HOME=/opt/rustup PATH=/opt/cargo/bin:$PATH
RUN curl -sSf https://sh.rustup.rs | CARGO_HOME=/opt/cargo sh -s -- -y \
        --no-modify-path --profile minimal --default-toolchain $RUST_VERSION \
    && chmod -R a+rX /opt/rustup /opt/cargo

ENV TARBALLS=/var/cache/jami CARGO_HOME=/var/cache/jami/cargo
WORKDIR /src
