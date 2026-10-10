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
package net.jami.jams.ca.workers.csr.builders;

import lombok.extern.slf4j.Slf4j;

import net.jami.jams.ca.JamsCA;
import net.jami.jams.ca.workers.csr.utils.CertificateSigner;
import net.jami.jams.ca.workers.csr.utils.ExtensionLibrary;
import net.jami.jams.common.objects.system.SystemAccount;

import org.bouncycastle.asn1.x500.X500Name;
import org.bouncycastle.asn1.x509.SubjectPublicKeyInfo;
import org.bouncycastle.cert.X509v3CertificateBuilder;
import org.bouncycastle.cert.jcajce.JcaX509CertificateHolder;
import org.bouncycastle.openssl.jcajce.JcaPEMWriter;

import java.io.FileWriter;
import java.math.BigInteger;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.util.Date;

@Slf4j
public class SystemAccountBuilder {

    // Self-signed because it is a CA
    public static SystemAccount generateCA(SystemAccount systemAccount) {
        try {
            // Generate RSA Key Pair
            KeyPairGenerator keyPairGenerator = KeyPairGenerator.getInstance("RSA");
            keyPairGenerator.initialize(4096);
            KeyPair keyPair = keyPairGenerator.generateKeyPair();

            // Build the X509 Certificate
            X509v3CertificateBuilder builder =
                    new X509v3CertificateBuilder(
                            new X500Name(systemAccount.getX509Fields().getDN()),
                            new BigInteger(256, new SecureRandom()),
                            new Date(System.currentTimeMillis()),
                            new Date(
                                    System.currentTimeMillis()
                                            + systemAccount.getX509Fields().getLifetime()),
                            new X500Name(systemAccount.getX509Fields().getDN()),
                            SubjectPublicKeyInfo.getInstance(keyPair.getPublic().getEncoded()));

            // Sign the Certificate
            X509Certificate certificate =
                    CertificateSigner.signCertificate(
                            keyPair.getPrivate(), builder, ExtensionLibrary.caExtensions);

            // Set the private key and certificate in the system account
            systemAccount.setPrivateKey(keyPair.getPrivate());
            systemAccount.setCertificate(certificate);

            // Save the certificate to a PEM file
            JcaPEMWriter pemWriter = new JcaPEMWriter(new FileWriter("CA.pem"));
            pemWriter.writeObject(certificate);
            pemWriter.close();

            return systemAccount;

        } catch (Exception e) {
            log.error("Unable to generate the system CA: " + e);
            return null;
        }
    }

    // This is signed by the CA, the OCSP certificate has the same lifetime as the CA by default.
    // someday this could change.
    public static SystemAccount generateOCSP(SystemAccount systemAccount) {
        try {
            KeyPairGenerator keyPairGenerator = KeyPairGenerator.getInstance("RSA");
            keyPairGenerator.initialize(4096);
            KeyPair keyPair = keyPairGenerator.generateKeyPair();
            X509v3CertificateBuilder builder =
                    new X509v3CertificateBuilder(
                            new JcaX509CertificateHolder(JamsCA.CA.getCertificate()).getSubject(),
                            new BigInteger(256, new SecureRandom()),
                            new Date(System.currentTimeMillis()),
                            new Date(
                                    System.currentTimeMillis()
                                            + systemAccount.getX509Fields().getLifetime()),
                            new X500Name(systemAccount.getX509Fields().getDN()),
                            SubjectPublicKeyInfo.getInstance(keyPair.getPublic().getEncoded()));
            systemAccount.setPrivateKey(keyPair.getPrivate());
            systemAccount.setCertificate(
                    CertificateSigner.signCertificate(
                            JamsCA.CA.getPrivateKey(), builder, ExtensionLibrary.caExtensions));
            return systemAccount;
        } catch (Exception e) {
            log.error("Unable to generate the system OCSP: " + e);
            return null;
        }
    }
}
