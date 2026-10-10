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
from typing import List
from OpenSSL import crypto
import requests


from certificate import Certificate
from abstractChain import AbstractChain

class Chain(AbstractChain):
    def __init__(self, chain: List[Certificate], trusted_certificates: List[Certificate] = None):
        self._store = crypto.X509Store()
        # TODO: uncomment this line when the CRLs are available
        # self._store.set_flags(crypto.X509StoreFlags.CRL_CHECK)
        self._chain = chain
        if trusted_certificates is None:
            return None
        for certificate in trusted_certificates:
            self._add_trusted_cert(certificate)

    def verify(self) -> bool:
        """
        Verify the chain.
        :return: True if the chain is verified, False otherwise.
        """
        for certificate in reversed(self._chain):
            context = crypto.X509StoreContext(self._store, certificate.cert[1])
            try:
                if context.verify_certificate() is not None:
                    return False
                self._add_trusted_cert(certificate)
            except crypto.X509StoreContextError as e:
                print(e)
                print('Error on certificate:' + str(certificate.cert[1].get_subject()))
                return False
        return True

    def _add_trusted_cert(self, cert: Certificate) -> None:
        """
        Add a trusted certificate to the chain.
        :param cert: The certificate to add.
        :return: None
        """
        certificate = cert.cert[1]
        self._store.add_cert(certificate)
        self._add_trusted_crl(cert)

    def _add_trusted_crl(self, cert: Certificate) -> None:
        """
        Add a trusted crl to the chain.
        :param cert: The certificate to add.
        :return: None
        """
        certificate = cert.cert[1]
        for extension_index in range(certificate.get_extension_count()):
            if certificate.get_extension(extension_index).get_short_name() == b'crlDistributionPoints':
                    request = requests.get(
                         b'https://' + certificate.get_extension(extension_index).get_data().split(b'https://')[1]
                        )
                    if request.status_code != 200:
                        return None
                    self._store.add_crl(crypto.load_crl(crypto.FILETYPE_ASN1, request.content))