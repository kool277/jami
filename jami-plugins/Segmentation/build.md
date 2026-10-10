# Jami Plugin Build Process

This document outlines the steps to build a Jami plugin, specifically the `Segmentation` plugin.
For signing it, please reffer to `jami-plugins/sign.md`

You can build it for Linux architectures (`x86_64-linux-gnu`), MacOS architectures (`arm64` and `x86_64`) and Android architectures (`arm64-v8a`, `armeabi-v7a` and `x86_64`). The example provided uses `arm64-v8a`, but feel free to replace it with the desired architecture.

## Requirements:

- `git`
- `docker` (only for Linux or android)
- `python3`

### On computer:

If you want a proper result, you need to run inference using GPU instead of CPU.
Depending on your computer :
CPU->0.1-0.3 sec / image
GPU->0.01 sec / image
Both will work, but the mask will update at 30 fps with GPU while being limited to lower fps with CPU.

To use the GPU, you need to build onnxruntime with CUDA and CUDNN, it implies having a NVIDIA GPU
You can use the CUDA Toolkit 12.6 and cuDNN 9.5.1.
You can install it following NVIDIA instructions.

### On Android:

Depending of your phone, inference time can go from 0.3 sec to 1 sec.
We tried using NNAPI to run the model on GPU but some operations are not supported by NNAPI.
It forces the CPU to run some operations, creating multiple partitions in the model.
The over 2 partitions, NNAPI is not faster nor recommanded.

### You should disable --use-nnapi in daemon/contrib/src/onnx/rules.mak

On other models, it may work better, you can check with onnx tools :
```bash
python -m onnxruntime.tools.check_onnx_model_mobile_usability your_model.onnx
```

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
	|-Segmentation
		|-build.md
		|-CMakeLists.txt
		|-data
		|-modelSRC
			|-yolo11n-seg.onnx
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
docker build -f docker/Dockerfile_ubuntu_20.04 -t {DockerNameToReplace} .
```

### Android:
```bash
docker build -f docker/Dockerfile_android -t {DockerNameToReplace} .
```

### MacOS:

Do it on your system.

## Step 3: Run Docker and Compile Dependencies

Run the following Docker command to start building dependencies:
> The dependencies are the libraries you will include in your plugin

### Linux without CUDA:

```bash
docker run -t --rm \
    -v $(pwd):/root/jami/:rw \
    -w /root/ \
    -e BATCH_MODE=1 \
    {DockerNameToReplace} /bin/bash -c "
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

### Linux with CUDA:

```bash
docker run -t --rm \
    -v $(pwd):/root/jami/:rw \
    -w /root/ \
    -e BATCH_MODE=1 \
    {DockerNameToReplace} /bin/bash -c "
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
                 --disable-uuid --disable-yaml-cpp --disable-onnx --enable-opus && make list
    make fetch opencv opencv_contrib
    make -j24
"
```

Then, you can build onnxruntime from source (1.21 works, but it should work from 1.18.1) with CUDA and cuDNN (can take hours and a lot of RAM).
You should not use a docker for this one, considering it should be compatible with your own system.

> in a folder of your choice
```bash
git clone --recursive https://github.com/microsoft/onnxruntime
cd onnxruntime

# Verify if the path is correct on your system

export CUDA_HOME=/usr/local/cuda-12.6
export CUDNN_HOME=/usr/lib/x86_64-linux-gnu
export LD_LIBRARY_PATH=$CUDA_HOME/lib64:$LD_LIBRARY_PATH
export PATH=$CUDA_HOME/bin:$PATH
pip3 install -r requirements.txt

./build.sh --config Release --build_shared_lib --use_cuda --cuda_home $CUDA_HOME --cudnn_home $CUDNN_HOME

```
It builds the 3 folowing librairies :
libonnxruntime.so
libonnxruntime_providers_cuda.so
libonnxruntime_providers_shared.so

You have to add the onnx files to the compilation, you can either update the CMakeLists to match the path, or you can move the files at the right place.

here, we're supposing you built onnxruntime in your home directory, but you can adapt the path.

In jami-plugins:
```bash
sudo mkdir ./daemon/contrib/x86_64-linux-gnu/lib/onnxruntime/
sudo mkdir ./daemon/contrib/x86_64-linux-gnu/lib/onnxruntime/nvidia-gpu
sudo cp ~/onnxruntime/build/Linux/Release/libonnxruntime.so ./daemon/contrib/x86_64-linux-gnu/lib/onnxruntime/nvidia-gpu
sudo cp ~/onnxruntime/build/Linux/Release/libonnxruntime_providers_cuda.so ./daemon/contrib/x86_64-linux-gnu/lib/onnxruntime/nvidia-gpu
sudo cp ~/onnxruntime/build/Linux/Release/libonnxruntime_providers_shared.so ./daemon/contrib/x86_64-linux-gnu/lib/onnxruntime/nvidia-gpu
sudo cp ~/onnxruntime/build/Linux/Release/* ./daemon/contrib/x86_64-linux-gnu/lib/onnxruntime/nvidia-gpu
sudo cp ~/onnxruntime/build/Linux/Release/lib/* ./daemon/contrib/x86_64-linux-gnu/lib/onnxruntime/nvidia-gpu
```

set "ENABLE_CUDA" ON in CMakeLists.txt

> **Note:** Please note than actually, when you install the plugin with CUDA on jami, the plugin manager can fail to find the libonnxruntime_providers_cuda and libonnxruntime_providers_shared libs. You can fix it by moving the libraries to the same directory as onnxruntime.so : `mv ~/.local/share/jami/plugins/Segmentation/lib/x86_64-linux-gnu/libonnxruntime_providers_* ~/.local/share/jami/plugins/Segmentation`

### Android:
```bash
docker run -t --rm \
    -v $(pwd):/home/gradle/plugins:rw \
    -w /home/gradle \
    -e BATCH_MODE=1 \
    {DockerNameToReplace} /bin/bash -c "
    cd ./plugins/contrib
    ANDROID_ABI='arm64-v8a' sh build-dependencies.sh
    "
```

### MacOS:

```bash
cd ./daemon/contrib
mkdir native
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
                 --disable-uuid --disable-yaml-cpp --enable-onnx --enable-opus
make list
make fetch opencv opencv_contrib
make
```

} **Note:** The build process for the `contrib` dependencies (particularly ONNX) may take a long time (~20 minutes).

## Step 4: Build the Plugin

Use the following command to build the `Segmentation` plugin:

### Linux:
```bash
docker run -t --rm \
    -v $(pwd):/root/jami/:rw \
    -w /root/ \
    -e BATCH_MODE=1 \
    {DockerNameToReplace} /bin/bash -c "
    cd jami
    PLATFORM_TYPE="LINUX" python3 build-plugin.py --projects='Segmentation' --distribution=ubuntu
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
    {DockerNameToReplace} /bin/bash -c "
    export DAEMON=/home/gradle/plugins
    cd ./plugins
    PLATFORM_TYPE="ANDROID" ANDROID_ABI="arm64-v8a" python3 build-plugin.py --projects=Segmentation --distribution=android
    "
```

### MacOS:

```bash
PLATFORM_TYPE="APPLE" python3 build-plugin.py --projects=Segmentation --distribution=osx
```
> **Note:** If OpenCV fails to build due to a missing `libade.a`, create an empty file to bypass the issue:

```bash
sudo touch ./daemon/contrib/{YOUR-ARCH e.g. x86_64-apple-darwin}/lib/opencv4/3rdparty/libade.a
```

## Step 5: Change Ownership of the Built Plugin

The default user in the Docker container who built the plugin is `root`. To manipulate the plugin, change the ownership of the output files to the current user:

### Linux or Android:
```bash
sudo chown -R ${USER}:${USER} build/
```

### MacOS:

Not needed since you built it on your system without docker

# You have now successfully built your plugin!
# The JPL archive is in build/{distribution}
## To add it to Jami, you now need to sign it by referring to `jami-plugins/sign.md`.

## Additional documentation:

### For a better understanding of plugins, here is what you should know:

The plugins are designed to be compatible for everyone. This is challenging because there are many different systems, and each user may have different libraries installed.

### About plugin building:
The file used for the compilation is the `CMakelists.txt` in Segmentation.
It assembles the files, create the library and call the SDK scripts to manipulate the jpl.

### About JPL Archive:
In your folder `build/{distribution}`, you have the JPL archive, the Jami Plugin format.

You can extract it like a zip, or view it before compression in your folder `jami-plugins/Segmentation/build-local/jpl`.
Inside, you'll find your libraries in `jpl/lib/{arch}`.
You will find the `libSegmentation.so`, and as in every plugin, you'll have `lib{PluginName}.so`.
In Segmentation, you will also find `libonnxruntime.so`, the ONNX library needed to use ONNX Runtime.

### About Libraries:

Libraries are built using `Segmentation/CMakeLists.txt`.

If you want your plugin to work on other computers, you need to understand that the plugin library (`libSegmentation.so`) contains every needed library, linking them dynamically for system libraries and statically for additional libraries like OpenCV.

System libraries must be dynamically linked because the user is supposed to have them installed, and statically linking them might cause compatibility issues.

However, users won’t have every additional library at the required version, so you need to include the exact version in your plugin by statically linking it.

Some useful commands:
- See the linked shared libraries with `ldd libSegmentation.so`.
  > Helps verify that every dynamic library is found on the system.
  > However, you are unable to see which library is statically linked, but you can verify if a symbol is defined.

- See symbols in the library: `nm libSegmentation.so | grep {YourSymbol}`.
  > Helps with missing symbols during loading in Jami. "U" means undefined, and "T" means they are in the text section. See `man nm` for details.

- Symbols can be hard to read. You can demangle them with `c++filt {YourSymbol}`.
  > The symbols represent the low-level names of the functions.

### About plugin's code

The plugin is mainly in c++, located in the `jami-plugins/Segmentation` folder.
The media handler file is used to interact with jami's API (chat, audio and video).
> e.g. receiving the frames of the video stream before transformation and sending the transformed frames.

The media subscriber file is used to modify the object received.
> e.g. draw a mask over the segmentated areas using opencv

