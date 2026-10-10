#
# Copyright (C) 2023 Savoir-faire Linux Inc.
#
# Author: Xavier Jouslin de Noray <xavier.joulindenoray@savoirfairelinux.com>
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
from OpenSSL import crypto
from zipfile import ZipFile
from random import SystemRandom
from typing import Optional, Tuple, List

from signature import Signature
from abstractCertificate import AbstractCertificate
from utils import save, read, save_archive, read_archive

class Certificate(AbstractCertificate):
    """
    A class representing a certificate.

    """
    def __init__(self, key: Optional[crypto.PKey], cert: crypto.X509, issuer_path: Optional[str]) -> None:
        self._cert = cert
        self._key = key
        self.issuer_path = issuer_path

    @property
    def cert(self) -> Tuple[crypto.PKey, crypto.X509]:
        """
        Get the certificate.
        :return: A tuple containing the certificate and the key.
        """
        return self._key, self._cert

    @staticmethod
    def load(file_path: str) -> 'Certificate':
        """
        Load a certificate request from a file.
        :param file_path: The path to the certificate request file.
        :return: A Certificate object.
        """
        cert = crypto.load_certificate(crypto.FILETYPE_PEM, read(f'{file_path}.crt', 'rb'))
        key = crypto.load_privatekey(crypto.FILETYPE_PEM, read(f'{file_path}.key', 'rb'))
        return Certificate(key, cert, file_path)

    @staticmethod
    def load_archive(file_path: str) -> 'Certificate':
        """
        Load a certificate request from a file.
        :param file_path: The path to the certificate request file.
        :return: A Certificate object.
        """
        cert = crypto.load_certificate(crypto.FILETYPE_PEM, read_archive(f'{file_path}.crt', 'rb'))
        key = crypto.load_privatekey(crypto.FILETYPE_PEM, read_archive(f'{file_path}.key', 'rb'))
        return Certificate(key, cert, file_path)

    @staticmethod
    def create(subject: List[Tuple[str, str]], issuer: Optional['Certificate'] = None) -> 'Certificate':
        """
        Create a new certificate.
        :param subject: A list of tuples containing the subject attributes.
        :param issuer: The issuer certificate.
        :return: A Certificate object.
        """
        key = crypto.PKey()
        key.generate_key(crypto.TYPE_RSA, 4096)
        cert = crypto.X509()
        cert.set_version(2)
        subj = cert.get_subject()
        for attr, info in subject:
            if info is None:
                continue
            if attr in ['crlDistributionPoints', 'basicConstraints']:
                ext = crypto.X509Extension(attr.encode(), False, info.encode())
                cert.add_extensions([ext])
                continue
            setattr(subj, attr, info)
        issuer_crt = issuer.cert[1] if issuer is not None else cert
        issuer_key = issuer.cert[0] if issuer is not None else key
        if issuer_crt is None:
            raise ValueError
        cert.set_serial_number(SystemRandom().getrandbits(64))
        cert.set_issuer(issuer_crt.get_subject())
        cert.set_pubkey(key)
        cert.gmtime_adj_notBefore(0)
        cert.gmtime_adj_notAfter(365*24*60*60)
        cert.sign(issuer_key, 'sha512')
        # check if the certificate is the same as the issuer
        if issuer is None:
            return Certificate(key, cert, None)
        return Certificate(key, cert, issuer.issuer_path)

    def save(self, path_2_file: str) -> None:
        """
        Save the certificate request to a file.
        :param path_2_file: The path to the file.
        :return: None
        """
        if self._cert is None:
            raise ValueError
        save(f'{path_2_file}.crt', crypto.dump_certificate(crypto.FILETYPE_PEM, self._cert), 'wb')
        if self._key is not None:
            save(f'{path_2_file}.key', crypto.dump_privatekey(crypto.FILETYPE_PEM, self._key),'wb')
        if self.issuer_path is not None:
            save(f'{path_2_file}.crt', read(f'{self.issuer_path}.crt', 'rb'), 'ab')

    def save_archive(self, path_2_file: str) -> None:
        """
        Save the certificate request to a file.
        :param path_2_file: The path to the file.
        :return: None
        """
        if self._cert is None:
            raise ValueError
        self.save(path_2_file)
        save_archive(f'{path_2_file}.crt.gz', crypto.dump_certificate(crypto.FILETYPE_PEM, self._cert), 'wb')

    def verify(self, subject: crypto.X509) -> bool:
        """
        Verify if the certificate is valid.
        :param subject: The certificate to verify.
        :return: True if the certificate is valid, False otherwise.
        """
        if self._cert is None:
            return False
        try:
            verified = subject.to_cryptography().verify_directly_issued_by(
                self._cert.to_cryptography()
                )
        except Exception:
            return False
        return verified is None

    def verify_from_archive(self, path_2_archive: str) -> bool:
        """
        Verify if the certificate is valid.
        :param subject: The certificate to verify.
        :return: True if the certificate is valid, False otherwise.
        """
        data = read_archive(path_2_archive)
        path_2_archive = path_2_archive[0:-4]
        save(path_2_archive, data)
        with ZipFile(path_2_archive, 'r') as zip_file:
            filename = os.path.splitext(os.path.basename(path_2_archive))[0]
            cert = crypto.load_certificate(crypto.FILETYPE_PEM, read(zip_file.extract(filename + '.crt')))
            return self.verify(cert)

    def sign(self, path_2_file: str) -> 'Signature':
        """
        Sign a file.
        :param path_2_file: The file to sign.
        :return: None
        """
        return Signature(self).create(path_2_file)
