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
'''

 To execute this script, run the following command:
    - PYTHONPATH="<absolute-path-to-certificate-module>" <path-to-TestSuite/PluginCertificateTester.py>

'''
import os

from pluginCertificate import PluginCertificate
import unittest
from OpenSSL import crypto
from zipfile import ZipFile
import gzip
import shutil

from jplManipulation import JPLStructure
from certificate import Certificate


class MockJPLStructure(JPLStructure):

    def __init__(self):
        self.ZipObjcts = {}
        self.paths = [os.path.join(os.path.dirname(__file__), 'data/certificates/test.jpl')]
        self.discoverJPLs()

    def discoverJPLs(self) -> None:
        if not os.path.exists(os.path.join(os.path.dirname(__file__), '/data/certificates')):
            os.makedirs(os.path.dirname(__file__) + '/data/certificates')
        # create the zip for the plugin
        for path in self.paths:
            with ZipFile(path, 'w') as zip:
                # create the structure of the plugin
                zip.writestr('data/test.txt', 'test')
                zip.writestr('manifest.json', '{}')
                zip.writestr('lib/x86_64-linux-gnu/test.so', 'test')
                zip.writestr('test.crt', crypto.dump_certificate(crypto.FILETYPE_PEM, Certificate.create([('commonName', 'Test')]).cert[1]))



class TestPluginCertificate(unittest.TestCase):

    def setUp(self) -> None:
        MockJPLStructure()

    def tearDown(self) -> None:
        if os.path.exists(os.path.dirname(__file__) + '/data/'):
            shutil.rmtree(os.path.dirname(__file__)+ '/data/')
        return super().tearDown()

    def test_sign(self):
        cert = Certificate.create([('commonName', 'Test')])
        plugin_cert = PluginCertificate(cert._key, cert._cert)
        # Call the sign() method on the PluginCertificate object
        signature = plugin_cert.sign(os.path.join(os.path.dirname(__file__), 'data/certificates/test.jpl'))

        # Check that the returned dictionary contains the expected signatures
        self.assertEqual(len(signature._signature[signature.pluginPaths[0]]), 4)
        self.assertTrue(isinstance(signature._signature[signature.pluginPaths[0]]['manifest.json'], bytes))

    def test_save(self):
        cert = Certificate.create([('commonName', 'Test')])
        plugin_cert = PluginCertificate(cert._key, cert._cert)
        signature = plugin_cert.sign(os.path.join(os.path.dirname(__file__), 'data/certificates/test.jpl'))
        signature.save(None)
        # TODO: Add assertions to check that the files were written correctly
        for path in signature.pluginPaths:
            with ZipFile(path, 'r') as zip:
                self.assertTrue(zip.testzip() is None)
                self.assertEqual(len(zip.filelist), 7)

    def test_save_archive(self):
        cert = Certificate.create([('commonName', 'Test')])
        plugin_cert = PluginCertificate(cert._key, cert._cert)
        signature = plugin_cert.sign(os.path.join(os.path.dirname(__file__), 'data/certificates/test.jpl'))
        # Call the save() method with the test data
        signature.save_archive('/tmp/test')
        for path in signature.pluginPaths:
            with ZipFile(path, 'r') as zip:
                self.assertTrue(zip.testzip() is None)
                self.assertEqual(len(zip.filelist), 7)
            with gzip.open('/tmp/test.jpl.gz', 'rb') as gz:
                with ZipFile(gz, 'r') as zip:
                    self.assertTrue(zip.testzip() is None)
                    self.assertEqual(len(zip.filelist), 7)

if __name__ == '__main__':
    unittest.main()
