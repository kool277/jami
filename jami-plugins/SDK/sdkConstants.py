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

import re
import string
pattern = re.compile(r'[\W_]+')

PLUGINS_APIS = {"MEDIA_HANDLER": '1',
                "MEDIA_HANDLER_AUDIO": '2',
                "CHAT_HANDLER": '3'}

APIS_NAMES = {"MEDIA_HANDLER": "MediaHandler",
              "CHAT_HANDLER": "ChatHandler"}

DATA_TYPES = {"VIDEO": 'Video',
              "AUDIO": 'Audio',
              "TEXT": 'Chat'}

ACTIONS = {"CREATE": '1',
           "CREATE_MAIN": '2',
           "CREATE/MODIFY_MANIFEST": '3',
           "DELETE_MANIFEST": '4',
           "CREATE_PREFERENCES": '5',
           "DELETE_PREFERENCES": '6',
           "CREATE_FUNCTIONALITY": '7',
           "CREATE_PACKAGE_JSON": '8',
           "DELETE": '9',
           "ASSEMBLE": '10',
           "BUILD": '11',
           "PREASSEMBLE": '12',
           "CREATE_BUILD_FILES": '13'}

FORBIDDEN_NAMES = [
    "SDK",
    "lib",
    "contrib",
    "build",
    "docker",
    '']

PREFERENCES_TYPES = ["List", "Path"]

OS_IDS = {"Linux": 1,
          "Windows": 2,
          "Darwin": 3}

NAME = ''
EMAIL = ''