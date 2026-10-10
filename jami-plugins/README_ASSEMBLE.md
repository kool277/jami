$ export DAEMON="<jami-plugins>/daemon"

OPENCV AND OPENCV_CONTRIB BUILD INSTRUCTIONS

OPENCV VERSION 4.6.0
OPENCV_CONTRIB VERSION 4.6.0

For Android:
    1) Download and install Android NDK
    2) Compile the dependencies

        export ANDROID_NDK=<NDK>
        export ANDROID_ABI=arm64-v8a
        export ANDROID_API=24
        export TOOLCHAIN=$ANDROID_NDK/toolchains/llvm/prebuilt/linux-x86_64
        export TARGET=aarch64-linux-android
        export CC=$TOOLCHAIN/bin/$TARGET$ANDROID_API-clang
        export CXX=$TOOLCHAIN/bin/$TARGET$ANDROID_API-clang++
        export AR=$TOOLCHAIN/bin/llvm-ar
        export AS=$TOOLCHAIN/bin/llvm-as
        export LD=$TOOLCHAIN/bin/ld
        export RANLIB=$TOOLCHAIN/bin/llvm-ranlib
        export STRIP=$TOOLCHAIN/bin/llvm-strip
        export PATH=$PATH:$TOOLCHAIN/bin
        cd contrib
        mkdir native
        cd native
        ../bootstrap --build=x86_64-pc-linux-gnu --host=$TARGET$ANDROID_API --enable-opencv --enable-opencv_contrib
        make

For Linux:
    $ cd ${DAEMON}/contrib/native/
    $ ./../bootstrap --enable-opencv --enable-opencv_contrib
    $ make install


TENSORFLOW BUILD INSTRUCTIONS

TF VERSION 2.1.0

Dependencies:
    1 - python 3
    2 - bazel 0.29.1

$ git clone https://github.com/tensorflow/tensorflow.git
$ cd tensorflow
$ git checkout v2.1.0


For Android: (Tensorflow Lite)
    Dependencies:
        1 - Android NDK 18r

    $ ./configure
        >> Do you want to build TensorFlow with XLA JIT support? [Y/n]: n
        >> Do you want to download a fresh release of Clang? (Experimental) [y/N]: y
        >> Do you want to interactively configure ./WORKSPACE for Android builds? [y/N]: y
        >> Please specify the home path of the Android NDK to use. [Default is /home/pfreitas/Android/Sdk/ndk-bundle]: put the right path to ndk 18r

    $ bazel build //tensorflow/lite:libtensorflowlite.so --crosstool_top=//external:android/crosstool --cpu=armeabi-v7a --host_crosstool_top=@bazel_tools//tools/cpp:toolchain --cxxopt="-std=c++11"

    $ bazel build //tensorflow/lite:libtensorflowlite.so --crosstool_top=//external:android/crosstool --cpu=arm64-v8a --host_crosstool_top=@bazel_tools//tools/cpp:toolchain --cxxopt="-std=c++11"

    $ bazel build //tensorflow/lite:libtensorflowlite.so --crosstool_top=//external:android/crosstool --cpu=x86_64  --host_crosstool_top=@bazel_tools//tools/cpp:toolchain --cxxopt="-std=c++11"

For Linux:

    $ ./configure

    For TFLite:
    $ bazel build //tensorflow/lite:libtensorflowlite.so
    or
    For Tensorflow C++ API:
    $ bazel build --config=v1 --define framework_shared_object=false //tensorflow:libtensorflow_cc.so

    OBS.: If you want to build Tensorflow C++ API with GPU suport, be sure to have a CUDA capable GPU and that you have
    followed all installation steps for the Nvidia drivers, CUDA Toolkit, CUDNN, Tensor RT, that their versions
    matches and that they are correct for the Tensorflow version you want to build. The following links may be very helpful:
        - https://www.tensorflow.org/install/source
        - https://developer.nvidia.com/cuda-gpus
        - https://developer.nvidia.com/cuda-toolkit-archive
        - https://developer.nvidia.com/cudnn


TENSORFLOWLITE INCLUDES ASSEMBLE INSTRUCTIONS

    Keep in mind that after each of bazel build instructions above listed, there will be a "libtensorflowlite.so" created at:
        "<tensorflow>/bazel-genfiles/tensorflow/lite/"
    or at:
        "<tensorflow>/bazel-out/<cpu>-opt/bin/tensorflow/lite/"
    (cpu may be "armeabi-v7a", "arm64-v8a", "x86_64", "x86" or "k8" depending on the build realized)
    The lib in the first folder is overwritten after each build.
    The lib in the second folder is not.

    create folders and copy files to have the following path struture:

    ~home/Libs/
            _tensorflow_distribuiton/
                lib/
                    arm64-v8a/
                        libtensorflowlite.so
                    armeabi-v7a/
                        libtensorflowlite.so
                    x86_64/
                        libtensorflowlite.so
                    x86_64-linux-gnu/
                        libtensorflowlite.so
                    ...
                include/
                    tensorflow/
                        lite/
                            c/
                                buitin_op_data.h
                                c_api_internal.h
                            core/
                                api/
                                    error_reporter.h
                                    op_resolver.h
                                    profiler.h
                                subgraph.h
                            delegates/
                                gpu/
                                    delegate.h
                                nnapi/
                                    nnapi_delegate.h
                            experimental/
                                resource_variable/
                                    resource_variable.h
                            kernels/
                                register.h
                            nnapi/
                                NeuralNetworksShim.h
                                NeuralNetworksTypes.h
                                nnapi_implementation.h
                                nnapi_util.h
                            schema/
                                schema_generated.h
                            tools/
                                evaluation/
                                    utils.h
                            allocation.h
                            builtin_op_data.h
                            context.h
                            external_cpu_backend_context.h
                            interpreter.h
                            memory_planner.h
                            model.h
                            mutable_op_resolver.h
                            optinal_debug_tools.h
                            simple_memory_arena.h
                            stderr_reporter.h
                            string_type.h
                            util.h
                    flatbuffers/
                        base.h
                        code_generators.h
                        flatbuffers.h
                        flatc.h
                        flexbuffers.h
                        grpc.h
                        hash.h
                        idl.h
                        minireflect.h
                        reflection.h
                        reflection_generated.h
                        registry.h
                        stl_emulation.h
                        util.h


TENSORFLOW C++ API INCLUDES ASSEMBLE INSTRUCTIONS

    Keep in mind that after the bazel build listed, there will be a "libtensorflow_cc.so.__version__" created at:
        "<tensorflow>/bazel-genfiles/tensorflow/"

    create folders and copy files to have the following path struture:
    After copying libtensorflow_cc.so.__version__, rename it to libtensorflow_cc.so
    ~home/Libs/
            _tensorflow_cc/
                lib/
                    x86_64-linux-gnu/
                        libtensorflow_cc.so
                    ...
                include/
                    tensorflow/
                        core/
                            -> keep folder structure and copy all header files from "<tensorflow>/
                            tensorflow/core"
                            -> copy all proto header files (.pb.h) from
                            "<tensorflow>/bazel-genfiles/tensorflow/core/"
                    absl/
                        -> keep folder structure and copy all header and .inc files from "<tensorflow>/
                        bazel-tensorflow/external/com_google_absl/absl/"
                    google/
                        -> keep folder structure and copy all header, proto headers, and .inc files from "<tensorflow>/bazel-tensorflow/external/com_google_protobuf/src/google/"
                    third_party/
                        eigen3/
                            Eigen/
                                -> keep folder structure and copy all files from
                                "<tensorflow>/bazel-tensorflow/external/eigen_archive/Eigen/"
                            unsupported/
                                Eigen/
                                    -> keep folder structure and copy all files from "<tensorflow>/bazel-tensorflow/external/eigen_archive/unsupported/Eigen/"
                                    CXX11/
                                        -> copy "<tensorflow>/third_party/eigen3/unsupported/Eigen/CXX11/FixedPoint"
                                        -> copy "<tensorflow>/third_party/eigen3/unsupported/Eigen/CXX11/src/"

--> Be aware to apply any needed changes to the build.sh file so that the plugin can be build against the standart tensorflow_cc library.
