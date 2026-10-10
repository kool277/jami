# Jami Plugin Build Process

This document outlines the steps to build a Jami plugin, specifically the `GreenScreen` plugin.
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
	|-GreenScreen
		|-build.md
		|-CMakeLists.txt
		|-data
		|-modelSRC
			|-mModel.onnx
			|-mModel.ort
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

Set the image name (choose any lowercase name):
```bash
DOCKER_IMAGE=<docker-name-to-replace>
```

Build the Docker image using the provided Dockerfile:

### Linux:
```bash
docker build -f docker/Dockerfile_ubuntu_24.04 -t $DOCKER_IMAGE .
```

### Android:
```bash
docker build -f docker/Dockerfile_android -t $DOCKER_IMAGE .
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
    $DOCKER_IMAGE /bin/bash -c "
    cd ./jami/daemon/contrib
    mkdir -p native
    cd native
    ../bootstrap --disable-x264 --enable-ffmpeg --disable-dhtnet \
                 --disable-webrtc-audio-processing --disable-argon2 \
                 --disable-asio --enable-fmt --disable-gcrypt --disable-gmp \
                 --disable-gnutls --disable-gpg-error --disable-gsm \
                 --disable-http_parser --disable-jack --disable-jsoncpp \
                 --disable-libarchive --disable-libressl --enable-msgpack \
                 --disable-natpmp --disable-nettle --enable-opencv --enable-opendht \
                 --disable-pjproject --disable-portaudio --disable-restinio \
                 --disable-secp256k1 --disable-speex --disable-speexdsp --disable-upnp \
                 --disable-uuid --disable-yaml-cpp --enable-onnx --enable-opus && make list
    make fetch opencv opencv_contrib
    make -j24
"
```

### Android:
```bash
docker run -t --rm \
    -v $(pwd):/home/gradle/plugins:rw \
    -w /home/gradle \
    -e BATCH_MODE=1 \
    $DOCKER_IMAGE /bin/bash -c "
    cd ./plugins/contrib
    ANDROID_ABI='arm64-v8a' sh build-dependencies.sh
    "
```
> **Note:** The build process for the `contrib` dependencies (particularly ONNX) may take a long time (~20 minutes).

## Step 4: Build the Plugin

Use the following command to build the `GreenScreen` plugin:

### Linux:
```bash
docker run -t --rm \
    -v $(pwd):/root/jami/:rw \
    -w /root/ \
    -e BATCH_MODE=1 \
    $DOCKER_IMAGE /bin/bash -c "
    cd jami
    PLATFORM_TYPE="LINUX" python3 build-plugin.py --projects='GreenScreen' --distribution=ubuntu
"
```
> **Note:** If OpenCV fails to build due to a missing `libade.a`, create an empty file to bypass the issue:

```bash
sudo touch ./daemon/contrib/x86_64-linux-gnu/lib/opencv4/3rdparty/libade.a
```

### Android:
```bash
docker run -t --rm \
    -v $(pwd):/home/gradle/plugins:rw \
    -w /home/gradle \
    -e BATCH_MODE=1 \
    $DOCKER_IMAGE /bin/bash -c "
    export DAEMON=/home/gradle/plugins
    cd ./plugins
    PLATFORM_TYPE="ANDROID" ANDROID_ABI="arm64-v8a" python3 build-plugin.py --projects=GreenScreen --distribution=android
    "
```

## Step 5: Change Ownership of the Built Plugin

The default user in the Docker container who built the plugin is `root`. To manipulate the plugin, change the ownership of the output files to the current user:

### Linux:
```bash
sudo chown ${USER}:${USER} build/
sudo chown ${USER}:${USER} build/x86_64-linux-gnu/
sudo chown ${USER}:${USER} build/x86_64-linux-gnu/GreenScreen.jpl
```

### Android:
```bash
sudo chown ${USER}:${USER} build/
sudo chown ${USER}:${USER} build/android/
sudo chown ${USER}:${USER} build/android/GreenScreen.jpl
```

# You have now successfully built your plugin!
## To add it to Jami, you now need to sign it by referring to `jami-plugins/sign.md`.

## Additional documentation:

### For a better understanding of plugins, here is what you should know:

The plugins are designed to be compatible for everyone. This is challenging because there are many different systems, and each user may have different libraries installed.

### About plugin building:
The file used for the compilation is the `CMakelists.txt` in GreenScreen.
It assembles the files, create the library and call the SDK scripts to manipulate the jpl.

### About JPL Archive:
In your folder `build/<distribution>`, you have the JPL archive, the Jami Plugin format.

You can extract it like a zip, or view it before compression in your folder `jami-plugins/GreenScreen/build-local/jpl`.
Inside, you'll find your libraries in `jpl/lib/<arch>`.
You will find the `libGreenScreen.so`, and as in every plugin, you'll have `lib<PluginName>.so`.
In GreenScreen, you will also find `libonnxruntime.so`, the ONNX library needed to use ONNX Runtime.

### About Libraries:

Libraries are built using `GreenScreen/CMakeLists.txt`.

If you want your plugin to work on other computers, you need to understand that the plugin library (`libGreenScreen.so`) contains every needed library, linking them dynamically for system libraries and statically for additional libraries like OpenCV.

System libraries must be dynamically linked because the user is supposed to have them installed, and statically linking them might cause compatibility issues.

However, users won’t have every additional library at the required version, so you need to include the exact version in your plugin by statically linking it.

Some useful commands:
- See the linked shared libraries with `ldd libGreenScreen.so`.
  > Helps verify that every dynamic library is found on the system.
  > However, you are unable to see which library is statically linked, but you can verify if a symbol is defined.

- See symbols in the library: `nm libGreenScreen.so | grep <YourSymbol>`.
  > Helps with missing symbols during loading in Jami. "U" means undefined, and "T" means they are in the text section. See `man nm` for details.

- Symbols can be hard to read. You can demangle them with `c++filt <YourSymbol>`.
  > The symbols represent the low-level names of the functions.

### About plugin's code

The plugin is mainly in c++, located in the `jami-plugins/GreenScreen` folder.
The media handler file is used to interact with jami's API (chat, audio and video).
> e.g. receiving the frames of the video stream before transformation and sending the transformed frames.

The media subscriber file is used to modify the object received.
> e.g. draw a mask over the background using opencv
