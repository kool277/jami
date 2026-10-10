#!/usr/bin/env bash

set -e

if command -v apt-get &> /dev/null
then
    apt-get remove cmake cmake-data -y
fi

wget https://github.com/Kitware/CMake/releases/download/v4.3.4/cmake-4.3.4-linux-x86_64.sh \
      -q -O /tmp/cmake-install.sh
echo "b0b61ae426a0d1130642a3287eb5c7f5ef6f88966fd42e2aed9656ec69d42415  /tmp/cmake-install.sh" | sha256sum --check
chmod u+x /tmp/cmake-install.sh
/tmp/cmake-install.sh --skip-license --prefix=/usr/local/
rm /tmp/cmake-install.sh