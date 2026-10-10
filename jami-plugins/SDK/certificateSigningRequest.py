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
from typing import List, Tuple, Optional
from OpenSSL import crypto
from zipfile import ZipFile


from utils import read, save, save_archive, read_archive
from abstractCertificate import AbstractCertificate
from certificate import Certificate
from certificateSigningRequestSignature import CertificateSigningRequestSignature

class CertificateSigningRequest(AbstractCertificate):
    """
    A class representing a certificate signing request.
    """

    def __init__(self, key: Optional[crypto.PKey], cert: Optional[crypto.X509Req]):
        self._cert = cert
        self._key = key

    @property
    def cert(self) -> Tuple[crypto.PKey, crypto.X509Req]:
        """
        Get the certificate.
        :return: A tuple containing the certificate and the key.
        """
        return self._key, self._cert

    @staticmethod
    def load(file_path: str) -> 'CertificateSigningRequest':
        """
        Load a certificate request from a file.
        :param file_path: The path to the certificate request file.
        :return: A Certificate object.
        """
        cert = crypto.load_certificate_request(crypto.FILETYPE_PEM, read(f'{file_path}.csr', 'rb'))
        if not cert.verify(cert.get_pubkey()):
            raise ValueError
        return CertificateSigningRequest(None, cert)

    @staticmethod
    def create(subject: List[Tuple[str, str]], issuer: Optional['AbstractCertificate'] = None) -> 'CertificateSigningRequest':
        """
        Create a new certificate.
        :param subject: A list of tuples containing the subject attributes.
        :param issuer: The issuer certificate.
        :return: A Certificate signing object.
        """
        if issuer is not None:
            raise ValueError
        key = crypto.PKey()
        key.generate_key(crypto.TYPE_RSA, 4096)
        req = crypto.X509Req()
        subj = req.get_subject()
        for attr, info in subject:
            if info is None:
                continue
            if attr in ['crlDistributionPoints', 'basicConstraints']:
                # add CRL distribution points extension
                ext = crypto.X509Extension(attr.encode(), False, info.encode())
                req.add_extensions([ext])
                continue
            setattr(subj, attr, info)
        req.set_pubkey(key)
        req.sign(key, 'sha512')
        return CertificateSigningRequest(key, req)

    def save(self, path_2_file: str) -> None:
        """
        Save the certificate request to a file.
        :param path_2_file: The path to the file.
        :return: None
        """
        if self._cert is None:
            raise ValueError
        save(f'{path_2_file}.csr', crypto.dump_certificate_request(crypto.FILETYPE_PEM, self._cert), 'wb')
        if self._key is not None:
            save(f'{path_2_file}.key', crypto.dump_privatekey(crypto.FILETYPE_PEM, self._key),'wb')

    def verify(self) -> bool:
        """
        Verify the certificate signing request.
        :return: True if the certificate is valid, False otherwise.
        """
        if self._cert is None:
            return False
        try:
            verified = self._cert.verify(self._cert.get_pubkey())
        except Exception:
            return False
        return verified is None

    def save_archive(self, path_2_file: str):
        """
        Save the certificate request archive.
        :param path_2_file: The path to the file.
        :return: None
        """
        if self._cert is None:
            raise ValueError
        self.save(path_2_file)
        save_archive(f'{path_2_file}.csr.gz', crypto.dump_certificate_request(crypto.FILETYPE_PEM, self._cert), 'wb')

    def verify_from_archive(self, path_2_archive: str) -> bool:
        data = read_archive(path_2_archive)
        path_2_archive = path_2_archive[0:-4]
        save(path_2_archive, data)
        with ZipFile(path_2_archive, 'r') as zip_file:
            filename = os.path.splitext(os.path.basename(path_2_archive))[0]
            self._cert = crypto.load_certificate(crypto.FILETYPE_PEM, read(zip_file.extract(filename + '.crt')))
            return self.verify()

    def sign(self, issuer: 'Certificate') -> 'CertificateSigningRequestSignature':
        """
        Sign the certificate signing request.
        :param issuer: The issuer certificate.
        :param serial: The serial number.
        :param validity: The validity of the certificate.
        :return: A Certificate object.
        """
        return CertificateSigningRequestSignature(issuer).create(self)
