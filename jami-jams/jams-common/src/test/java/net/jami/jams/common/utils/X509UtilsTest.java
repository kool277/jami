/*
 * Copyright (C) 2020-2024 by Savoir-faire Linux
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
package net.jami.jams.common.utils;

import static org.junit.jupiter.api.Assertions.fail;

import org.bouncycastle.pkcs.PKCS10CertificationRequest;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;

class X509UtilsTest {

    static String strPrivateKey;
    static String strCertificate;
    static String strPkcs10Request;

    @BeforeAll
    public static void loadProps() {
        try {
            InputStream path;
            ClassLoader classLoader = Thread.currentThread().getContextClassLoader();
            path = classLoader.getResourceAsStream("cakey.txt");
            strPrivateKey = new String(path.readAllBytes());
            path = classLoader.getResourceAsStream("cacert.txt");
            strCertificate = new String(path.readAllBytes());
            path = classLoader.getResourceAsStream("pkcs10request.txt");
            strPkcs10Request = new String(path.readAllBytes());
        } catch (Exception e) {
            fail("An error occurred while setting up resources for test.");
        }
    }

    @Test
    void getKeyFromPEMString() {
        PrivateKey privateKey;
        privateKey = X509Utils.getKeyFromPEMString(strPrivateKey);
        Assertions.assertNotNull(
                privateKey, "An error occurred while decoding correctly formatted private key.");
        privateKey = X509Utils.getKeyFromPEMString(strPrivateKey.substring(10));
        Assertions.assertNull(
                privateKey,
                "An error occurred while decoding private key from an incorrect string.");
    }

    @Test
    void getCertificateFromPEMString() {
        X509Certificate x509Certificate;
        x509Certificate = X509Utils.getCertificateFromPEMString(strCertificate);
        Assertions.assertNotNull(
                x509Certificate,
                "An error occurred while decoding correctly formatted certificate.");
        x509Certificate = X509Utils.getCertificateFromPEMString(strCertificate.substring(25));
        Assertions.assertNull(
                x509Certificate,
                "An error occurred while decoding certificate from an incorrect string.");
    }

    @Test
    void getPEMStringFromPrivateKey() {
        PrivateKey privateKey;
        privateKey = X509Utils.getKeyFromPEMString(strPrivateKey);
        Assertions.assertNotNull(
                privateKey, "An error occurred while decoding correctly formatted private key.");
        String str = X509Utils.getPEMStringFromPrivateKey(privateKey);
        PrivateKey privateKey1 = X509Utils.getKeyFromPEMString(str);
        Assertions.assertEquals(
                privateKey, privateKey1, "Keys do not match - although they should!");
    }

    @Test
    void getPEMStringFromCertificate() {
        X509Certificate x509Certificate;
        x509Certificate = X509Utils.getCertificateFromPEMString(strCertificate);
        Assertions.assertNotNull(
                x509Certificate,
                "An error occurred while decoding correctly formatted certificate.");
        String str = X509Utils.getPEMStringFromCertificate(x509Certificate);
        X509Certificate x509Certificate1 = X509Utils.getCertificateFromPEMString(str);
        Assertions.assertEquals(
                x509Certificate,
                x509Certificate1,
                "Certificates do not match - although they should!");
    }

    @Test
    void getCSRFromString() {
        PKCS10CertificationRequest certificationRequest;
        certificationRequest = X509Utils.getCSRFromString(strPkcs10Request);
        Assertions.assertNotNull(
                certificationRequest, "Certification request should have been parsed correctly!");
        certificationRequest = X509Utils.getCSRFromString(strPkcs10Request.substring(23));
        Assertions.assertNull(
                certificationRequest, "Certification request should not have been parsed!");
    }
}
