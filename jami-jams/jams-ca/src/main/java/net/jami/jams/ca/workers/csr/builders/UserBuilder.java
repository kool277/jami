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

import static net.jami.jams.ca.workers.csr.CertificateWorker.SHIFT;

import lombok.extern.slf4j.Slf4j;

import net.jami.jams.ca.JamsCA;
import net.jami.jams.ca.workers.csr.utils.CertificateSigner;
import net.jami.jams.ca.workers.csr.utils.ExtensionLibrary;
import net.jami.jams.common.objects.roots.X509Fields;
import net.jami.jams.common.objects.user.User;

import org.apache.commons.codec.binary.Hex;
import org.apache.commons.codec.digest.MessageDigestAlgorithms;
import org.bouncycastle.asn1.x500.X500Name;
import org.bouncycastle.asn1.x509.SubjectPublicKeyInfo;
import org.bouncycastle.cert.X509v3CertificateBuilder;
import org.bouncycastle.cert.jcajce.JcaX509CertificateHolder;

import java.math.BigInteger;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.security.cert.CertificateEncodingException;
import java.security.cert.X509Certificate;
import java.util.Date;

@Slf4j
public class UserBuilder {

    public static User generateUser(User user) {
        try {
            KeyPairGenerator keyPairGenerator = KeyPairGenerator.getInstance("RSA");
            keyPairGenerator.initialize(4096);
            KeyPair keyPair = keyPairGenerator.generateKeyPair();

            byte[] digest =
                    MessageDigest.getInstance(MessageDigestAlgorithms.SHA_1)
                            .digest(keyPair.getPublic().getEncoded());
            user.getX509Fields().setUid(Hex.encodeHexString(digest));
            user.setPrivateKey(keyPair.getPrivate());

            String dn = user.getX509Fields().getDN();
            SubjectPublicKeyInfo publicKeyInfo =
                    SubjectPublicKeyInfo.getInstance(keyPair.getPublic().getEncoded());
            X509Certificate certificate =
                    generateSignedCertificate(dn, JamsCA.userLifetime, publicKeyInfo);
            user.setCertificate(certificate);
            return user;
        } catch (Exception e) {
            log.error("An error occurred while generating user certificate: " + e);
            return null;
        }
    }

    public static User refreshUser(User user) {
        return refreshUser(user, JamsCA.userLifetime);
    }

    public static User refreshUser(User user, long userLifeTime) {
        X509Fields x509 = new X509Fields();
        x509.setCommonName(user.getUsername());
        x509.setUid(user.getJamiId());
        user.setX509Fields(x509);

        try {
            String dn = user.getX509Fields().getDN();
            SubjectPublicKeyInfo publicKeyInfo =
                    new JcaX509CertificateHolder(user.getCertificate()).getSubjectPublicKeyInfo();
            X509Certificate certificate =
                    generateSignedCertificate(dn, userLifeTime, publicKeyInfo);
            user.setCertificate(certificate);

            return user;
        } catch (Exception e) {
            log.error("An error occurred while refreshing user certificate: " + e);
            return null;
        }
    }

    private static X509Certificate generateSignedCertificate(
            String dn, long userLifeTime, SubjectPublicKeyInfo publicKeyInfo)
            throws CertificateEncodingException {
        long now = System.currentTimeMillis();
        X509v3CertificateBuilder builder =
                new X509v3CertificateBuilder(
                        new JcaX509CertificateHolder(JamsCA.CA.getCertificate()).getSubject(),
                        new BigInteger(128, new SecureRandom()),
                        new Date(now - SHIFT),
                        new Date(now + userLifeTime),
                        new X500Name(dn),
                        publicKeyInfo);

        X509Certificate certificate =
                CertificateSigner.signCertificate(
                        JamsCA.CA.getPrivateKey(), builder, ExtensionLibrary.userExtensions);
        log.info("User certificate:  Not valid after: {}", certificate.getNotAfter());
        return certificate;
    }
}
