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
from abc import ABC
from typing import List, Tuple, Optional
from OpenSSL import crypto


class AbstractCertificate(ABC):
    """
    A class representing a abstract certificate.
    """

    @property
    def cert(self) -> Tuple[crypto.PKey, crypto.X509]:
        pass

    @staticmethod
    def load(file_path: str) -> 'AbstractCertificate':
        pass

    @staticmethod
    def create(subject: List[Tuple[str, str]], issuer: Optional['AbstractCertificate'] = None):
        pass

    def save(self, path_2_file: str) -> None:
        pass

    def verify(self) -> bool:
        pass

    def verify_from_archive(self, file_2_archive: str) -> bool:
        pass

    def save_archive(self, path_2_file: str) -> None:
        pass

    def sign(self, path_2_file: str) -> bytes:
        pass