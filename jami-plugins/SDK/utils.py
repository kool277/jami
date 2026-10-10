#!/usr/bin/env python3
#
# Copyright (C) 2020-2021 Savoir-faire Linux Inc.
#
# Author: Aline Gondim Santos <aline.gondimsantos@savoirfairelinux.com>
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

import os
from typing import Union
import gzip

from typing import Optional, Union
from sdkConstants import *
from skeletonSrcProfile import SkeletonSourceFiles


def initializeClasses(action):
    setSkeletonSourceFiles(action)
    return bool(globalSkeletonSourceFiles.pluginId)


globalSkeletonSourceFiles = ''


def setSkeletonSourceFiles(action):
    global globalSkeletonSourceFiles
    globalSkeletonSourceFiles = SkeletonSourceFiles(action)


def getSkeletonSourceFiles():
    return globalSkeletonSourceFiles

def save(filename:Union[str, bytes], content:Union[str, bytes], mode:str='wb') -> None:
    with open(filename, mode) as file:
        file.write(content)

def save_archive(filename:Union[str, bytes], content:Union[str, bytes], mode:str='w') -> None:
    with gzip.open(filename, mode) as file:
        file.write(content)

def read_archive(filename:str, mode:str='rb'):
    with gzip.open(filename, mode) as file:
        return file.read()

def read(filename:str, mode:str='r'):
    with open(filename, mode) as file:
        return file.read()


def isEmpty(parser: Optional[str]) -> bool:
    return parser is None
