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

from datetime import datetime

from sdkConstants import *


class UserInfos:
    def __init__(self, action):
        self.name = "AUTHORNAME"
        self.mail = "AUTHORMAIL"
        self.header = ''
        self.initHeaderSkeleton()
        if (action == ACTIONS["CREATE"] or action ==
                ACTIONS["CREATE_FUNCTIONALITY"] or action == ACTIONS["CREATE_MAIN"]):
            self.createCopyRight()

    def initHeaderSkeleton(self):
        with open('./Templates/copyright.txt') as f:
            self.header = f.read()
            f.close()

    def createCopyRight(self):
        global NAME
        global EMAIL
        with open('./Templates/copyright.txt') as f:
            data = f.read()
            today = datetime.today()
            data = data.replace("YEAR", str(today.year))
            authorName = NAME
            if (authorName == ""):
                authorName = input("\nEnter author’s name: ")
            if (authorName != ""):
                self.name = authorName
                NAME = self.name
            data = data.replace("AUTHORNAME", self.name)
            authorMail = EMAIL
            if (authorMail == ""):
                authorMail = input("\nEnter author’s e-mail address: ")
            if (authorMail != ""):
                self.mail = authorMail
                EMAIL = self.mail
            data = data.replace("AUTHORMAIL", self.mail)
        self.header = data
