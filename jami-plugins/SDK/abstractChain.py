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
from abstractCertificate import AbstractCertificate


class AbstractChain(ABC):
    @staticmethod
    def load(file_path: str) -> 'AbstractChain':
        pass

    @staticmethod
    def load(content: bytes) -> 'AbstractChain':
        pass

    def verify(self) -> bool:
        pass

    def _add_trusted_cert(self, cert: 'AbstractCertificate') -> None:
        pass

    def _add_trusted_crl(self, cert: 'AbstractCertificate') -> None:
        pass