#!/usr/bin/env python3
#
# Copyright (C) 2023 Savoir-faire Linux Inc.
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
from os import path
from typing import List
from OpenSSL import crypto

from utils import read
from chain import Chain
from certificate import Certificate


class PluginChain(Chain):
    def __init__(self, chain: List[Certificate], trusted_certificates: List[Certificate] = None) -> None:
        super().__init__(chain, trusted_certificates)

    @staticmethod
    def load(content: bytes) -> 'PluginChain':
        """
        Load a plugin certificate from a certificate and a plugin path.
        :param content: The certificate chain to load.
        :return: A PluginChain object.
        """
        certificate_chain = re.split(b'-----END CERTIFICATE-----', content)[:-1]
        store = crypto.X509Store()
        # read the root certificate place on extra folder and add it to the store
        plugin_store_root = Certificate(None, crypto.load_certificate(
            crypto.FILETYPE_PEM, read(
                path.join(
                    path.dirname(path.abspath(__file__)),
                    '../extras/resources/plugin-store-root.crt'
                    ),
                    'rb'
                )
            ),
            None
        )
        return PluginChain([
            Certificate(
                None,
                crypto.load_certificate(
                    crypto.FILETYPE_PEM,
                    certificate + b'-----END CERTIFICATE-----\n'
                    ),
                None,
                )
            for certificate in certificate_chain
            ], [plugin_store_root])

    @staticmethod
    def load_from_file(file_path: str) -> 'PluginChain':
        """Certificate
        Load a plugin certificate from a plugin path.
        :param file_path: The path to the plugin.
        :return: A Chain object.
        """
        return PluginChain.load(read(f'{file_path}.crt', 'rb'))
