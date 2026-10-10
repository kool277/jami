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
import os
import shutil
from msgpack import packb, loads
import re
from zipfile import ZipFile
from typing import Optional
from OpenSSL import crypto


from certificate import Certificate
from signature import Signature
from utils import read, read_archive, save, save_archive

class PluginSignature(Signature):
    """
    A class representing a digital signature.
    """

    def __init__(self, cert: Optional['Certificate']):
        """
        Initialize the signature.
        :param cert: The certificate used to sign the data. NOTE: need to set the certificate before signing not to verify.
        """
        super().__init__(cert)
        self.pluginPaths = None

    def create(self, file: str) -> 'PluginSignature':
        """
        Sign the plugin.
        :return: A dictionary containing the signatures of the plugin.
        """
        if self._cert.cert[1] is None or self._cert.cert[0] is None:
            raise ValueError

        if self.pluginPaths is None or len(self.pluginPaths) == 0:
            self.pluginPaths = [file]
        signatures = {}
        data = {}
        for path in self.pluginPaths:
            signatures[path] = {}
            data[path] = {}
            with ZipFile(path, 'r') as zip_file:
                for filename in zip_file.namelist():
                    with zip_file.open(filename, 'r') as file:
                        signature = Signature(self._cert).load(file.read())
                        signatures[path][filename] = signature._signature
                        data[path][filename] = signature._data
        self._data = data
        self._signature = signatures
        if not self.verify():
            self._data = None
            self._signature = None
            raise LookupError
        return self

    def verify(self) -> bool:
        """
        Verify the plugin.
        :return: True if the plugin is verified, False otherwise.
        """
        for path in self._data:
            for file in self._data[path]:
                try:
                    if not crypto.verify(self._cert.cert[1], self._signature[path][file], self._data[path][file], "sha512") is None:
                        return False
                except Exception:
                    return False
        return True

    def verify_saving(self, path_2_file) -> bool:
        """
        Verify the plugin.
        :param path_2_file: the plugin path.
        :return: True if the plugin is verified, False otherwise.
        """
        if self.pluginPaths is None:
            self.pluginPaths = [path_2_file]
        for path in self.pluginPaths:
            with ZipFile(path, 'r') as zip_file:
                if self._cert is None or self._cert.cert[1] is None:
                    for filename in zip_file.namelist():
                        if re.search(r'\.crt$', filename):
                            self._cert = Certificate(None, crypto.load_certificate(crypto.FILETYPE_PEM, zip_file.read(filename)), None)
                            break
                    if self._cert is None or not Signature(
                                    self._cert,
                                    zip_file.read('signatures.sig'),
                                    zip_file.read('signatures')
                                ).verify():
                        return False
                    self._signature = loads(zip_file.read('signatures'))
                    for file in zip_file.namelist():
                        if file == 'signatures.sig' or file == 'signatures' or file == f'{self._cert.cert[1].get_subject().CN}.crt':
                            continue
                        try:
                            crypto.verify(self._cert.cert[1], self._signature[file], zip_file.read(file), "sha512")
                        except Exception:
                            return False
        return True

    def verify_from_archive(self, path_2_archive: str) -> bool:
        data = read_archive(path_2_archive)
        path_2_archive = path_2_archive[0:-4]
        save(path_2_archive, data)
        with ZipFile(path_2_archive, 'r') as zip_file:
            self._signature = loads(read(zip_file.extract('signatures'), 'rb'))
            return PluginSignature(None).verify_saving(path_2_archive)

    def save(self, path_2_file: Optional[str]) -> None:
        """
        Save the plugin with signature.
        :param path_2_file: The path to the plugin.
        """
        if self._signature is None or self.pluginPaths is None or len(self.pluginPaths) == 0:
            raise LookupError
        for path  in self.pluginPaths:
            plugin_signatures = packb(self._signature[path])
            with ZipFile(path, 'a') as file:
                file.writestr(
                                f'{self._cert.cert[1].get_subject().CN}.crt',
                                crypto.dump_certificate(crypto.FILETYPE_PEM, self._cert.cert[1]) if self._cert.issuer_path is None else read(f'{self._cert.issuer_path}.crt', 'rb')
                            )
                file.writestr('signatures', plugin_signatures)

            with ZipFile(path, 'r') as zip_file:
                data = zip_file.read('signatures')
            sign = Signature(self._cert).load(data)
            with ZipFile(path, 'a') as file:
                file.writestr('signatures.sig', sign._signature)
            if not self.verify_saving(f'{path_2_file}.jpl'):
                raise LookupError
            if path_2_file is not None:
                shutil.copy(path, f'{path_2_file}.jpl')

    def save_archive(self, path_2_file: str) -> None:
        """
        Save the plugin archive.
        :param path_2_plugin: The path to the plugin archive.
        """
        if self._cert is None:
            raise ValueError
        self.save(None)
        save_archive(f'{path_2_file}.jpl.gz', read(self.pluginPaths[0], 'rb'))
