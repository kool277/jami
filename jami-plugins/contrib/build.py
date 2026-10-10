#!/usr/bin/env python3
#
# Copyright (C) 2023 Savoir-faire Linux Inc.
#
# Author: Kateryna Kostiuk <kateryna.kostiuk@savoirfairelinux.com>
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.
#
# Creates packaging targets for a distribution and architecture.
# This helps reduce the length of the top Makefile.
#

# This script must unify the Plugins build for
# every project and Operational System

import subprocess
import os
import platform
import argparse

def exec_cmd(command):
    process = subprocess.Popen(command, shell=True,
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    out, err = process.communicate()
    if process.returncode != 0:
        print(f"Error executing command: {err.decode().strip()}")
    else:
        print(out.decode().strip())

def get_mac_host_parameter(arch):
    if not arch:
        arch = platform.machine()
    system = platform.uname().release
    return f"{arch}-apple-darwin{system}"

def run_for_mac(arch=None, with_opencv=None, with_onnx=False):
    host_param = get_mac_host_parameter(arch)
    os.environ["WITH_FREETYPE"] = '1'
    opencv_flag = "--enable-opencv" if with_opencv else "--disable-opencv"
    onnx_flag = "--enable-onnx" if with_onnx else "--disable-onnx"

    current_dir = os.path.dirname(os.path.abspath(__file__))
    contrib_dir = os.path.join(current_dir, '..', 'daemon', 'contrib')

    if not arch:
        arch = platform.machine()

    cmd = f"""
    cd {contrib_dir}
    mkdir -p native-{arch}
    cd native-{arch}
    ../bootstrap --host={host_param} --enable-minizip --enable-ffmpeg --enable-opus --enable-speex \
    {onnx_flag} --disable-argon2 --disable-asio --enable-fmt --disable-gcrypt \
    --disable-gmp --disable-gnutls --disable-gpg-error --disable-gsm \
    --disable-http_parser --disable-iconv --disable-jack --disable-jsoncpp \
    --disable-libarchive --disable-libressl --disable-msgpack --disable-natpmp \
    --disable-nettle {opencv_flag} --enable-opendht --disable-pjproject \
    --disable-portaudio --disable-restinio --disable-secp256k1 --disable-speexdsp \
    --disable-upnp --disable-uuid --disable-yaml-cpp --disable-zlib --disable-dhtnet \
    --disable-webrtc-audio-processing
    make list
    export PATH=/usr/local/bin:$PATH
    export BATCH_MODE=1
    make -j$(sysctl -n hw.ncpu)
    """
    exec_cmd(cmd)

def copy_contrib():
    current_dir = os.path.dirname(os.path.abspath(__file__))

    mp3lame_path = os.path.join(current_dir, 'mp3lame')
    rav1e_path = os.path.join(current_dir, 'rav1e')
    freetype_path = os.path.join(current_dir, 'freetype')
    dest_dir = os.path.join(current_dir, '..', 'daemon', 'contrib', 'src')

    cmd = f"""
    cp -r {mp3lame_path} {dest_dir}
    cp -r {rav1e_path} {dest_dir}
    cp -r {freetype_path} {dest_dir}
    """

    exec_cmd(cmd)

def parse_arguments():
    parser = argparse.ArgumentParser(description="Script to build plugins contributions.")
    parser.add_argument('--arch', type=str, choices=['arm64', 'x86_64'],
                        help="Specify the architecture (arm64 or x86_64)")
    parser.add_argument('--with-opencv', action='store_true',
                        help='Enable OpenCV if set.')
    parser.add_argument('--with-onnx', action='store_true',
                        help="Enable ONNX if set.")
    return parser.parse_args()

if __name__ == "__main__":
    os_system = platform.system()
    args = parse_arguments()
    if os_system == "Darwin":
        copy_contrib()
        run_for_mac(args.arch, args.with_opencv, args.with_onnx)
    else:
        print("Unsupported operating system.")
