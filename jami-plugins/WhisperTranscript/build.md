## Build manual

1. Build WhisperTranscript

Download the base and tiny quantize models from https://huggingface.co/ggerganov/whisper.cpp/blob/main/ggml-tiny-q5_1.bin and https://huggingface.co/ggerganov/whisper.cpp/blob/main/ggml-base-q5_1.bin and add them in data/assets/

Make sure you have CUDA and BLAS on your system or disable it in the rules.mak of whisper.cpp
```
git submodule update --init
mkdir build
cd WhisperTranscript
mkdir -p build-local
cd build-local
cmake -DCMAKE_BUILD_TYPE=Debug
make -j
```

By default, you may find the resulting `.jpl` file inside the `build` directory. You may set the `ARCHIVE_JPL` variable to `OFF` in `CMakeLists.txt` to disable the creation of the `.jpl` archive.

2. By default, the `cmake` script will generate a developer certificate/key, and a plugin-specific certificate/key, in `plugins/.cert`. Once you have built your plugin on all platforms of interest and merged them together with `python3 SDK/pluginMainSDK.py`, then by typing `merge` in the SDK, you will be able to sign your final `.jpl` file. Call:

`python3 ./SDK/certKey.py --plugin sign --issuer <path-to-your-developer-certificate> --path <path-to-your-.jpl-file-to-sign> <path-to-save-the-final-.jpl-signed-output>`

3. Build the standalone version for testing

If you want to build the standalone for testing WhisperTranscript, use the following instructions :
```
git submodule update --init
mkdir build
cd WhisperTranscript
mkdir -p build-local
cd build-local
cmake .. -DCMAKE_BUILD_TYPE=Debug -DBUILD_STANDALONE=On
make -j
```

4. Reset the standalone build
```
rm -rf ./*
cmake .. -DCMAKE_BUILD_TYPE=Debug -DBUILD_STANDALONE=On
make -j
./WhisperTranscript
```

5. Reset the library build
```
rm -rf ./*
cmake .. -DCMAKE_BUILD_TYPE=Debug
make -j
```
6. Switch between standalone and library
This is usefull because we want only a minimal version of FFMPEG inside of the shared library.
```
cd ../../daemon/contrib/native-x86_64-linux-gnu
rm -rf ffmpeg .ffmpeg
```

# You have now successfully built your plugin!
# The JPL archive is in build/{distribution}
## To add it to Jami, you now need to sign it by referring to `jami-plugins/sign.md`.

## Additional documentation:

### Enabling BLAS
This version of whispercpp supports BLAS. TO use it ensure that you have it on your system.

On Ubuntu, you can install it using : http://www.openmathlib.org/OpenBLAS/
You can install the CUDA toolkit here : https://developer.nvidia.com/cuda-downloads

Be careful when managing your NVIDIA drvivers, it can break your stystem :)
If that's the case just change back your drivers to what they previously were.

If the cuda compiler is not found by default, use :
```
sudo apt install nvidia-cuda-toolkit
```

### Enabling CUDA
We also supports CUDA to ensure that WhsiperTranscript can run on your GPU !

### For a better understanding of plugins, here is what you should know:

The plugins are designed to be compatible for everyone. This is challenging because there are many different systems, and each user may have different libraries installed.

### About plugin building:
The file used for the compilation is the `CMakelists.txt` in Segmentation.
It assembles the files, create the library and call the SDK scripts to manipulate the jpl.

### About JPL Archive:
In your folder `build/{distribution}`, you have the JPL archive, the Jami Plugin format.

Inside, you'll find your libraries in `jpl/lib/{arch}`.
You will find the `libWhisperTranscript.so`, and as in every plugin, you'll have `lib{PluginName}.so`.

### About Libraries:

Libraries are built using `WhisperTranscript/CMakeLists.txt`.

If you want your plugin to work on other computers, you need to understand that the plugin library (`libWhisperTranscript.so`) contains every needed library, linking them dynamically for system libraries and statically for additional libraries like OpenCV.

System libraries must be dynamically linked because the user is supposed to have them installed, and statically linking them might cause compatibility issues.

However, users won’t have every additional library at the required version, so you need to include the exact version in your plugin by statically linking it.

Some useful commands:
- See the linked shared libraries with `ldd libWhisperTranscript.so`.
  > Helps verify that every dynamic library is found on the system.
  > However, you are unable to see which library is statically linked, but you can verify if a symbol is defined.

- See symbols in the library: `nm libWhisperTranscript.so | grep {YourSymbol}`.
  > Helps with missing symbols during loading in Jami. "U" means undefined, and "T" means they are in the text section. See `man nm` for details.

- Symbols can be hard to read. You can demangle them with `c++filt {YourSymbol}`.
  > The symbols represent the low-level names of the functions.

### About plugin's code

The plugin is mainly in c++, located in the `jami-plugins/WhisperTranscript` folder.
The media handler file is used to interact with jami's API (chat, audio and video).
> e.g. receiving the frames of the video stream before transformation and sending the transformed frames.

The media subscriber file is used to modify the object received.
> e.g. draw text onto the video.

