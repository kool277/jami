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
from copy import deepcopy
from typing import Optional
from OpenSSL import crypto


from utils import save, save_archive
from abstractCertificate import AbstractCertificate

class Signature:
    """
    A class representing a digital signature.

    Attributes:
        cert (ABCCertificate): The certificate used to sign the data.

    Methods:
        sign(file: str) -> Tuple[bytes, bytes]: Sign data with private key, return signature and data.
        verify(signature: bytes, data: bytes) -> bool: Verify signature with public key.
    """
    def __init__(self, cert: Optional['AbstractCertificate'], signature: Optional[bytes] = None, data: Optional[bytes] = None):
        self._cert = cert
        self._signature = signature
        self._data = data

    def create(self, file: str) -> 'Signature':
        """
        Sign data with private key, return signature and data
        :param file: file to sign
        :return: signature
        """
        if self._cert is None or self._cert.cert[0] is None:
            raise ValueError
        priv_key = self._cert.cert[0]
        with open(file, "rb") as f:
            data = f.read()
        signature = crypto.sign(priv_key, data, "sha512")
        self._signature = signature
        self._data = data
        if self.verify():
            return self
        else:
            self._signature = None
            self._data = None
            raise ValueError

    def load(self, data: str) -> 'Signature':
        """
        Load signature from file
        :param path_2_file: path to file
        :return: signature
        """
        priv_key = self._cert.cert[0]
        signature = crypto.sign(priv_key, data, "sha512")
        self._signature = signature
        self._data = data
        if self.verify():
            return self
        else:
            self._signature = None
            self._data = None
            raise ValueError

    def verify(self) -> bool:
        """
        Verify signature with public key
        :param signature: signature to verify
        :param data: data to verify
        :return: True if signature is valid, False otherwise
        """
        try:
            if self._cert is None or self._cert.cert[1] is None:
                return False
            data = deepcopy(self._data)
            if isinstance(data, str):
                data = data.encode()
            return crypto.verify(self._cert.cert[1], self._signature, data, "sha512") is None
        except Exception:
            return False

    def save(self, path_2_file: str):
        """
        Save signature to file
        :param path_2_file: path to file
        """
        if self._signature is None:
            raise ValueError
        save(path_2_file, self._signature)

    def save_archive(self, path_2_file: str) -> None:
        """
        Save signature to file
        :param path_2_file: path to file
        """
        if self._signature is None:
            raise ValueError
        save_archive(path_2_file, self._signature)
