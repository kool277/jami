# Jami Plugin Build Process

This document outlines the steps to build a Jami plugin, specifically the `TestSuite` plugin.
For signing it, please reffer to `jami-plugins/sign.md`

You can build it for Linux architectures (`x86_64-linux-gnu`) and also for Android architectures (`arm64-v8a`, `armeabi-v7a`, `x86_64`). The example provided uses `arm64-v8a`, but feel free to replace it with the desired architecture.

## Requirements:

- `git`
- `docker`

Building the plugin directly on your computer is not recommended for compatibility reasons.

## Step 1: Clone Jami Repositories

Clone the Jami plugin and daemon repositories:

```bash
git clone https://review.jami.net/jami-plugins
cd jami-plugins
```

For the daemon:

```bash
git submodule update --init --recursive
```

The structure should look like this:

```
|-jami-plugins
	|-TestSuite
		|-build.md
		|-CMakeLists.txt
		|-data
		|-*.cpp
		|-*.h
	|-daemon
		|-contrib
	|-SDK
		|jplManipulation.py
	|-docker
		|-Dockerfile_ubuntu_20.04
		|-Dockerfile_android
	|-sign.md
```

## Step 2: Build Docker Image

Build the Docker image using the provided Dockerfile:

### Linux:
```bash
docker build -f docker/Dockerfile_ubuntu_20.04 -t <DockerNameToReplace> .
```

### Android:
```bash
docker build -f docker/Dockerfile_android -t <DockerNameToReplace> .
```

## Step 3: Run Docker and Compile Dependencies

Run the following Docker command to start building dependencies:
> The dependencies are the libraries you will include in your plugin

### Linux:

```bash
docker run -t --rm \
    -v $(pwd):/root/jami/:rw \
    -w /root/ \
    -e BATCH_MODE=1 \
    <DockerNameToReplace> /bin/bash -c "
    cd ./jami/daemon/contrib
    mkdir -p native
    cd native
    ../bootstrap --disable-x264 --enable-ffmpeg --disable-dhtnet \
                 --disable-webrtc-audio-processing --disable-argon2 \
                 --disable-asio --enable-fmt --disable-gcrypt --disable-gmp \
                 --disable-gnutls --disable-gpg-error --disable-gsm \
                 --disable-http_parser --disable-jack --disable-jsoncpp \
                 --disable-libarchive --disable-libressl --enable-msgpack \
                 --disable-natpmp --disable-nettle --disable-opencv --enable-opendht \
                 --disable-pjproject --disable-portaudio --disable-restinio \
                 --disable-secp256k1 --disable-speex --disable-speexdsp --disable-upnp \
                 --disable-uuid --disable-yaml-cpp --disable-onnx --enable-opus && make list
    make fetch opencv opencv_contrib
    make -j24
"
```

## Step 4: Build the Plugin

Use the following command to build the `TestSuite` plugin:

### Linux:
```bash
docker run -t --rm \
    -v $(pwd):/root/jami/:rw \
    -w /root/ \
    -e BATCH_MODE=1 \
    <DockerNameToReplace> /bin/bash -c "
    cd jami
    PLATFORM_TYPE="LINUX" python3 build-plugin.py --projects='TestSuite' --distribution=unix
"
```

## Step 5: Change Ownership of the Built Plugin

The default user in the Docker container who built the plugin is `root`. To manipulate the plugin, change the ownership of the output files to the current user:

### Linux:
```bash
sudo chown ${USER}:${USER} build/
sudo chown ${USER}:${USER} build/x86_64-linux-gnu/
sudo chown ${USER}:${USER} build/x86_64-linux-gnu/TestSuite.jpl
```

# You have now successfully built your plugin!
## To add it to Jami, you now need to sign it by referring to `jami-plugins/sign.md`.
