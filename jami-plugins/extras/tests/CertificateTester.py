#!/usr/bin/python3
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
'''

 To execute this script, run the following command:
    - PYTHONPATH="<absolute-path-to-certificate>" <absolute-path-to-CertificateTester.py>

'''


from os import path, makedirs, mkdir
import unittest
import shutil
import gzip
from OpenSSL.crypto import X509, PKey
from OpenSSL import crypto

from certificateRevocationList import CertificateRevocationList
from certificateSigningRequest import CertificateSigningRequest
from signature import Signature
import certificate
import utils

root_directory = path.dirname(path.abspath(__file__)) + '/data/certificates/'
# create a class that inherits from Certificate to test Certificate
class CertificateMock(certificate.Certificate):
    def __init__(self, key:crypto.PKey, cert: X509):
        super().__init__(key, cert, None)

class TestCertificate(unittest.TestCase):
    def setUp(self) -> None:
        self.path_test = "example"

    def tearDown(self) -> None:
        if path.exists(path.join(path.dirname(path.abspath(__file__)), 'data')):
            shutil.rmtree(path.join(path.dirname(path.abspath(__file__)), 'data'))

    def test_load(self):
        if not path.exists(f'{root_directory}ca/'):
            makedirs(f'{root_directory}ca/')
        ca = certificate.Certificate.create([('commonName', 'Test')])
        ca.save(f'{root_directory}ca/test')
        comp_key = crypto.load_privatekey(crypto.FILETYPE_PEM,
                                          utils.read(f'{root_directory}ca/test.key', 'rb')
                                        )
        private_comp_key = crypto.dump_privatekey(crypto.FILETYPE_PEM, comp_key)
        comp_ca = crypto.load_certificate(crypto.FILETYPE_PEM,
                                          utils.read(f'{root_directory}ca/test.crt', 'rb')
                                        )
        comp_ca = crypto.dump_certificate(crypto.FILETYPE_PEM, comp_ca)

        file = f'{root_directory}ca/test'
        cert = certificate.Certificate.load(file)

        private_key = crypto.dump_privatekey(crypto.FILETYPE_PEM, cert._key)
        ca = crypto.dump_certificate(crypto.FILETYPE_PEM, cert._cert)

        self.assertEqual(private_key, private_comp_key)
        self.assertEqual(ca, comp_ca)

    def test_load_csr(self):
        if not path.exists(f'{root_directory}req/'):
            makedirs(f'{root_directory}req/')
        req = CertificateSigningRequest.create([('commonName', 'Test')])
        req.save(f'{root_directory}req/test')
        comp_req = crypto.load_certificate_request(crypto.FILETYPE_PEM,
                                          utils.read(f'{root_directory}req/test.csr', 'rb')
                                        )
        comp_req = crypto.dump_certificate_request(crypto.FILETYPE_PEM, comp_req)

        file = f'{root_directory}req/test'
        cert = CertificateSigningRequest.load(file)

        req = crypto.dump_certificate_request(crypto.FILETYPE_PEM, cert._cert)

        self.assertEqual(req, comp_req)

    def test_load_crl(self):
        if not path.exists(f'{root_directory}crl/'):
            makedirs(f'{root_directory}crl/')
        ca = certificate.Certificate.create([('commonName', 'Test')])
        crl = CertificateRevocationList.create(ca, [])
        crl.save(f'{root_directory}crl/test')
        ca.save(f'{root_directory}crl/test_ca')
        comp_crl = crypto.load_crl(crypto.FILETYPE_PEM,
                                          utils.read(f'{root_directory}crl/test.crl', 'rb')
                                        )
        comp_crl = crypto.dump_crl(crypto.FILETYPE_PEM, comp_crl)

        file = f'{root_directory}crl/test'
        crl = CertificateRevocationList.load(file, f'{root_directory}crl/test_ca')
        crl = crypto.dump_crl(crypto.FILETYPE_PEM, crl.cert[1])
        self.assertEqual(crl, comp_crl)

    def test_create_certificate(self):
        # create a CA certificate
        ca = certificate.Certificate.create([('commonName', 'Test')])

        # create a certificate signed by the CA
        subject = "example.com"
        cert = certificate.Certificate.create([('commonName', subject)], ca)
        self.assertIsInstance(cert._key, PKey)
        self.assertIsInstance(cert._cert, X509)
        self.assertEqual(cert._cert.get_subject().commonName, subject)
        self.assertEqual(cert._cert.get_subject().commonName, subject)
        self.assertEqual(cert._cert.get_issuer().commonName, "Test")
        if ca._cert is None:
            self.fail('Certificate not created')
        self.assertEqual(cert._cert.to_cryptography().
                         verify_directly_issued_by(ca._cert.to_cryptography()),
                         None
                        )

    def test_create_csr(self):
        subject = [('commonName', 'example.com'), ('countryName', 'US'), ('stateOrProvinceName', 'California')]
        cert = CertificateSigningRequest.create(subject)
        self.assertNotEqual(cert.cert[0], None)
        self.assertNotEqual(cert.cert[1], None)

    def test_save_archive(self):
        # create a CA certificate
        subject = "Test"
        ca = certificate.Certificate.create([('commonName', 'Test')])

        path_test_save = f'{root_directory}{self.path_test}/{subject}'
        if not path.exists(f'{root_directory}{self.path_test}/'):
            makedirs(f'{root_directory}{self.path_test}/')
        ca.save_archive(path_test_save)

        # check that the certificate and key files were saved to disk
        cert_path = path_test_save + '.crt'
        key_path = path_test_save + '.key'
        archive_path = path_test_save + '.crt.gz'
        self.assertTrue(path.exists(cert_path))
        self.assertTrue(path.exists(key_path))
        self.assertTrue(path.exists(archive_path))

        # check that the certificate and key files contain the expected data
        with open(cert_path, "rb") as f:
            cert_data = f.read()
        with open(key_path, "rb") as f:
            key_data = f.read()
        with gzip.open(archive_path, "rb") as f:
            archive_data = f.read()
        self.assertIn(b"BEGIN CERTIFICATE", cert_data)
        self.assertIn(b"BEGIN PRIVATE KEY", key_data)
        self.assertIn(b"BEGIN CERTIFICATE", archive_data)

    def test_save_cert(self):
        # create a CA certificate
        subject = "Test"
        ca = certificate.Certificate.create([('commonName', 'Test')])

        path_test_save = f'{root_directory}{self.path_test}/{subject}'
        if not path.exists(f'{root_directory}{self.path_test}/'):
            makedirs(f'{root_directory}{self.path_test}/')
        ca.save(path_test_save)

        # check that the certificate and key files were saved to disk
        cert_path = path_test_save + '.crt'
        key_path = path_test_save + '.key'
        self.assertTrue(path.exists(cert_path))
        self.assertTrue(path.exists(key_path))

        # check that the certificate and key files contain the expected data
        with open(cert_path, "rb") as f:
            cert_data = f.read()
        with open(key_path, "rb") as f:
            key_data = f.read()
        self.assertIn(b"BEGIN CERTIFICATE", cert_data)
        self.assertIn(b"BEGIN PRIVATE KEY", key_data)

    def test_sign(self):
        # create a CA certificate
        ca = certificate.Certificate.create([('commonName' ,'example')])

        # create test.txt file in ca._root_directory directory
        if not path.exists(f'{root_directory}{self.path_test}/'):
            makedirs(f'{root_directory}{self.path_test}/')
        with open(f'{root_directory}{self.path_test}/test.txt', "w") as f:
            f.write("test")
        # sign the certificate using the CA
        signature  = ca.sign(f'{root_directory}{self.path_test}/test.txt')

        # verify the signature using the CA's public key
        if ca._cert is None:
            self.fail('Certificate not created')
        self.assertIsNone(crypto.verify(ca._cert, signature._signature, signature._data, "sha512"))

    def test_sign_csr(self):
        # Create a self-signed certificate to act as the CA
        ca_subject = [('commonName', 'example.com'), ('countryName', 'US'), ('stateOrProvinceName', 'California')]
        ca = certificate.Certificate.create(ca_subject)

        # Create a CSR for a new certificate
        csr_subject = [('commonName', 'example.org'), ('countryName', 'US'), ('stateOrProvinceName', 'California')]
        csr = CertificateSigningRequest.create(csr_subject)

        # Sign the CSR with the CA
        cert = csr.sign(ca)

        # Verify that the certificate was signed correctly
        self.assertEqual(cert._signature.cert[1].get_subject(), csr.cert[1].get_subject())
        self.assertEqual(cert._signature.cert[1].get_issuer(), ca.cert[1].get_subject())

    def test_verify_certificate(self):
        # create a CA certificate
        ca = certificate.Certificate.create([('commonName', 'Test')])

        # create a certificate to be signed
        subject = [('commonName', 'example.com')]
        cert = certificate.Certificate.create(subject, ca)

        # verify the signature using the verifyCertificate function
        if ca._cert is None:
            self.fail('Certificate not created')
        verified = ca.verify(cert._cert)
        self.assertTrue(verified)

    def test_verify_signature(self):
        # create a CA certificate
        ca = certificate.Certificate.create([('commonName', 'Test')])


        # create test.txt file in ca._root_directory directory
        if not path.exists(f'{root_directory}{self.path_test}/'):
            makedirs(f'{root_directory}{self.path_test}/')
        with open(f'{root_directory}{self.path_test}/test.txt', "w") as f:
            f.write("test")

        # sign the certificate using the CA
        signature = Signature(ca).create(f'{root_directory }{self.path_test}/test.txt')

        # verify the signature using the verifySignature method
        if ca._cert is None:
            self.fail('Certificate not created')

        verified = signature.verify()
        self.assertTrue(verified)

    def test_revoke_certificate(self):
        # create a CA certificate
        ca = certificate.Certificate.create([('commonName', 'Test')])
        crl = CertificateRevocationList.create(ca, [])
        # create a certificate to be signed
        subject = [('commonName', 'example.com')]
        cert = certificate.Certificate.create(subject, ca)
        # revoke the certificate
        crl.revoke(cert)

        # verify that the certificate was revoked
        if crl.cert[1] is None or not isinstance(crl.cert[1], crypto.CRL):
            self.fail('CRL not created')
        revoke_serial = [revoke.get_serial().decode("ascii").lower() for revoke in crl.cert[1].get_revoked()]
        serial_int = cert.cert[1].get_serial_number()
        serial_hex = format(serial_int, 'x')
        if len(serial_hex) % 2:
            serial_hex = '0' + serial_hex
        self.assertTrue(serial_hex.lower() in revoke_serial)

if __name__ == '__main__':
    unittest.main()
