# Build environment for jami-client-qt. Starts from the jami-daemon build
# image (ci/daemon: daemon dependencies + Rust), adds the client packages of
# jami-client-qt/extras/build/docker/Dockerfile.client-qt-gnulinux and
# Qt 6.12.0 from the Qt online repository via aqtinstall, because the
# libqt-jami packages are still 6.10.x. The workspace is bind-mounted at
# /src so that jami-client-qt/daemon -> ../jami-daemon resolves.
ARG BASE=jami-daemon-build
FROM ${BASE}

ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    locales \
    python3-venv \
    gettext \
    libcanberra-gtk3-dev \
    libglib2.0-dev \
    libnotify-dev \
    libpcre3-dev \
    libxcb-shape0-dev \
    libxcb-xfixes0-dev \
    libxcb-cursor0 \
    libxkbcommon-x11-0 \
    libxcb-icccm4 \
    libxcb-image0 \
    libxcb-keysyms1 \
    libxcb-render-util0 \
    libboost-dev \
    libxext-dev \
    libxfixes-dev \
    uuid-dev \
    libgsm1-dev \
    libmsgpack-cxx-dev \
    libfmt-dev \
    libsdbus-c++-dev \
    libhttp-parser-dev \
    libappindicator3-dev \
    libqrencode-dev \
    libnm-dev \
    libnss3-dev \
    libcrypto++-dev \
    libvulkan-dev \
    libxcomposite-dev \
    libxdamage-dev \
    libxkbfile-dev \
    libxtst-dev \
    libxrandr2 \
    libxshmfence1 \
    libgbm1 \
    libegl1 \
    libopengl0 \
    libgl1-mesa-dri \
    libglx-mesa0 \
    libfontconfig1 \
    libdrm2 \
    libasound2t64 \
    xvfb \
    xauth \
    pandoc \
    googletest \
    libgtest-dev \
    clang-format \
    wget \
    && locale-gen en_US.UTF-8 \
    && rm -rf /var/lib/apt/lists/*

ARG QT_VERSION=6.12.0
ARG AQT_VERSION=3.3.0
RUN python3 -m venv /opt/aqt \
    && /opt/aqt/bin/pip install --no-cache-dir aqtinstall==$AQT_VERSION \
    && /opt/aqt/bin/aqt install-qt linux desktop $QT_VERSION linux_gcc_64 \
        --outputdir /opt/qt \
        --modules qt5compat qtmultimedia qtpositioning qthttpserver \
                  qtwebsockets qtwebengine qtwebchannel qtimageformats \
                  qtshadertools qtpdf \
    && rm -rf /opt/aqt /root/.cache aqtinstall.log

ENV QT_ROOT=/opt/qt/${QT_VERSION}/gcc_64
ENV PATH=${QT_ROOT}/bin:$PATH \
    LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 \
    QT_QUICK_BACKEND=software \
    QT_QPA_PLATFORM=offscreen \
    QT_OPENGL=software \
    QSG_RHI_BACKEND=software \
    QTWEBENGINE_CHROMIUM_FLAGS="--disable-gpu --disable-software-rasterizer --disable-dev-shm-usage --no-sandbox"

WORKDIR /src
