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
from typing import Optional, List, Tuple
from datetime import datetime
from OpenSSL import crypto

from certificate import Certificate
from abstractCertificate import AbstractCertificate
from utils import read, save, save_archive


class CertificateRevocationList(AbstractCertificate):
    """
    A class representing a certificate revocation list.
    """
    def __init__(self, key: Optional[crypto.PKey], cert: Optional[crypto.CRL], issuer: 'Certificate'):
        self._cert = cert
        self._key = key
        self._issuer = issuer

    @property
    def cert(self) -> Tuple[crypto.PKey, crypto.CRL]:
        """
        Get the certificate.
        :return: A tuple containing the certificate and the key.
        """
        return self._key, self._cert
    @staticmethod
    def create(issuer: 'Certificate', revoked: List[Tuple[int, datetime]]) -> 'CertificateRevocationList':
        """
        Create a certificate revocation list.
        :param issuer: The issuer of the certificate revocation list.
        :param revoked: The list of revoked certificates.
        :return: A Certificate object.
        """
        crl = crypto.CRL()
        crl.set_lastUpdate(datetime.utcnow().strftime('%Y%m%d%H%M%SZ').encode('ascii'))
        for serial, date in revoked:
            revoked_cert = crypto.Revoked()
            revoked_cert.set_serial(str(serial).encode('ascii'))
            revoked_cert.set_rev_date(date.strftime('%Y%m%d%H%M%SZ').encode('ascii'))
            crl.add_revoked(revoked)
        return CertificateRevocationList(None, crl, issuer).sign(issuer)

    @staticmethod
    def load(issuer: 'Certificate') -> 'CertificateRevocationList':
        """
        Load a certificate from a certificate.
        :param issuer: The certificate.
        :return: A Certificate object.
        """
        crl = crypto.load_crl(crypto.FILETYPE_PEM, read(f'{issuer}.crl', 'rb'))
        return CertificateRevocationList(None, crl, issuer)

    @staticmethod
    def load(file_path: str, issuer: str) -> 'CertificateRevocationList':
        """
        Load a certificate from a file.
        :param file_path: The path to the certificate.
        :return: A Certificate object.
        """
        crl = crypto.load_crl(crypto.FILETYPE_PEM, read(f'{file_path}.crl', 'rb'))
        issuer = crypto.load_certificate(crypto.FILETYPE_PEM, read(f'{issuer}.crt', 'rb'))
        return CertificateRevocationList(None, crl, Certificate(None, issuer, None))

    def revoke(self, subject: 'Certificate', reason: str = 'unspecified') -> 'CertificateRevocationList':
        """
        Revoke a certificate.
        :param subject: The certificate to revoke.
        :param reason: The reason for revocation.
        """
        if self._cert is None:
            raise ValueError
        revoked = crypto.Revoked()
        serial_hex = format(subject.cert[1].get_serial_number(), 'x')
        if len(serial_hex) % 2:
            serial_hex = '0' + serial_hex
        revoked.set_serial(serial_hex.encode('ascii'))
        revoked.set_reason(reason.encode('ascii'))
        now = datetime.utcnow()
        revoked.set_rev_date(now.strftime("%Y%m%d%H%M%SZ").encode('ascii'))
        self._cert.add_revoked(revoked)
        return CertificateRevocationList(None, self._cert, self._issuer).sign(self._issuer)

    def sign(self, issuer: 'Certificate') -> 'CertificateRevocationList':
        """
        Sign the certificate.
        :param issuer: The issuer certificate.
        """
        if self._cert is None:
            raise ValueError
        self._cert.sign(issuer.cert[1], issuer.cert[0], b'sha512')
        return CertificateRevocationList(None, self._cert, self._issuer)

    def save(self, file_path: str) -> None:
        """
        Save the certificate to a file.
        :param file_path: The path to the file.
        """
        if self._cert is None:
            raise ValueError
        save(f'{file_path}.crl', crypto.dump_crl(crypto.FILETYPE_PEM, self._cert), 'wb')

    def save_archive(self, path_2_file: str) -> None:
        """
        Save the CRL to a archive file.
        :param path_2_file: The path to the file.
        """
        if self._cert is None:
            raise ValueError
        save_archive(path_2_file, crypto.dump_crl(crypto.FILETYPE_PEM, self._cert), 'wb')

    def verify(self, subject: 'Certificate') -> bool:
        """
        Verify the certificate.
        :param issuer: The issuer certificate.
        :return: True if the certificate is valid, False otherwise.
        """
        if self._cert is None:
            raise ValueError
        return self._cert.to_cryptography().get_revoked_certificate_by_serial_number(subject.cert[1].get_serial_number()) is not None
