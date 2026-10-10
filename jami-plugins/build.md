1. Copy and rename the Example directory.

```
cp -R Example YourPluginName
sed -i 's/Example/YourPluginName/g' manifest.json
```

2. Change the version to fit the appropriate version of your plugin. You must change `manifest.json`, `main.cpp` and `CMakeLists.txt`. For example, for version 1.0.1:

```cpp
#define Example_VERSION_MAJOR 1
#define Example_VERSION_MINOR 0
#define Example_VERSION_PATCH 1
```

```json
    "version": "1.0.1",
```

```
set (VERSION 1.0.1) # {FILL} Replace 0.0.0 with the version of your plugin.
```

3. Edit the CMakeLists.txt of your project directory. Each comment containing {FILL} should be adjusted depending on the associated instructions.

In order, that means:
- Line 2: Set PROJECT_NAME as your plugin name.
- Line 3: Set VERSION as your plugin version.
- Line 8: Turn VIDEO_FFMPEG ON if you'd like to subscribe to or modify Jami's video stream.
- Line 9: Turn AUDIO_FFMPEG ON if you'd like to subscribe to or modify Jami's audio stream.
- Line 62: Add all further `.cpp` imports to SOURCES

**NOTE: All files ending with `.cpp` in your plugin directory will be automatically picked up by `CMake`.**
Header files ending with `.h` which are included in your C++ files will be automatically added as dependencies.

4. Program the functionality of your plugin, taking the `Example` plugin's Video, Audio and Chat features as inspiration.

5. To add a new language, rename `Example_en.json`, replacing `Example` with your plugin name, and edit the contents to reflect your translations.

**NOTE: The language code is ISO 639.**

6. Build your plugin:
```
cd YourPluginName
mkdir -p build-local
cd build-local
cmake ..
cmake --build .
```

By default, you may find the resulting `.jpl` file inside the `build` directory. You may set the `ARCHIVE_JPL` variable to `OFF` in `CMakeLists.txt` to disable the creation of the `.jpl` archive.

7. By default, the `cmake` script will generate a developer certificate/key, and a plugin-specific certificate/key, in `plugins/.cert`. Once you have built your plugin on all platforms of interest and merged them together with `python3 SDK/pluginMainSDK.py`, then by typing `merge` in the SDK, you will be able to sign your final `.jpl` file. Call:

`python3 ./SDK/certKey.py --plugin sign --issuer <path-to-your-developer-certificate> --path <path-to-your-.jpl-file-to-sign> <path-to-save-the-final-.jpl-signed-output>`
