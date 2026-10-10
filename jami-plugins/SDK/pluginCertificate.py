#!/usr/bin/env python3
#
# Copyright (C) 2023 Savoir-faire Linux Inc.
#
# Author: Xavier Jouslin de Noray <xavier.jouslindenoray@savoirfairelinux.com>
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
from OpenSSL import crypto
from zipfile import ZipFile
import re
from typing import List, Tuple

from certificate import Certificate
from pluginChain import PluginChain
from pluginSignature import PluginSignature
from utils import read_archive, save


class PluginCertificate(Certificate):
    """
    A class representing a plugin certificate.
    """
    def __init__(self, key: crypto.PKey, cert: crypto.X509, issuer_path: str = None):
        super().__init__(key, cert, issuer_path)

    @staticmethod
    def load(cert: Certificate) -> 'PluginCertificate':
        """Certificate
        Load a plugin certificate from a certificate and a plugin path.
        :param cert: The certificate to load.
        :param plugin_path: The path to the plugin.
        :return: A PluginCertificate object.
        """
        return PluginCertificate(cert.cert[0], cert.cert[1], cert.issuer_path)

    @staticmethod
    def create(subject: List[Tuple[str, str]], issuer: 'Certificate') -> 'PluginCertificate':
        return PluginCertificate(*Certificate.create(subject, issuer).cert, None)

    @staticmethod
    def verify(plugin_path: str) -> bool:
        """
        Verify a plugin.
        :param plugin_path: The path to the plugin.
        :return: True if the plugin is verified, False otherwise.
        """
        cert = None
        with ZipFile(plugin_path, 'r') as zip_file:
            for filename in zip_file.namelist():
                if filename.endswith('.crt'):
                    cert = zip_file.read(filename)
                    break
        if cert is None:
            return False
        return PluginChain.load(cert).verify() and PluginSignature(None).verify_saving(plugin_path)

    @staticmethod
    def verify_from_archive(plugin_path: str) -> bool:
        """
        Verify a plugin archived.
        :param plugin_path: The path to the plugin.
        :return: True if the plugin is verified, False otherwise.
        """
        data = read_archive(plugin_path)
        path_2_archive = path_2_archive[0:-4]
        save(path_2_archive, data)
        return PluginCertificate.verify(path_2_archive)

    def sign(self, file: str) -> 'PluginSignature':
        """
        Sign a plugin.
        :param file: The path to the plugin.
        """
        return PluginSignature(self).create(file)
