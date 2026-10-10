# To build WaterMark, follow these steps:

build the folowing daemon contributions :
- fmt
- opendht
- ffmpeg with FFMPEG_MINIMAL=1 WITH_FREETYPE=1

## From jami-plugins/ run:

### Linux:

```bash
PLATFORM_TYPE="LINUX" python3 build-plugin.py --projects='WaterMark'
```

### Android:

```bash
PLATFORM_TYPE="ANDROID" ANDROID_ABI="{Android ABI}" python3 build-plugin.py --projects='WaterMark'
```

### MacOS

```bash
PLATFORM_TYPE="MACOS" python3 build-plugin.py --projects='WaterMark'
```

## Once the build is complete, you will find your unsigned `WaterMark.jpl` in:

```
jami-plugins/build/{your distribution}/
```

## To install it on Jami, you need to sign the plugin. Refer to `sign.md` in the `jami-plugins/` directory for instructions on how to sign your plugin.