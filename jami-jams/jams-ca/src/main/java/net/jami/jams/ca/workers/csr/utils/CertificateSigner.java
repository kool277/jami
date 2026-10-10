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
package net.jami.jams.ca.workers.csr.utils;

import lombok.extern.slf4j.Slf4j;

import net.jami.jams.ca.JamsCA;

import org.bouncycastle.asn1.ASN1Encodable;
import org.bouncycastle.asn1.ASN1ObjectIdentifier;
import org.bouncycastle.asn1.x509.AlgorithmIdentifier;
import org.bouncycastle.asn1.x509.Certificate;
import org.bouncycastle.cert.X509v3CertificateBuilder;
import org.bouncycastle.crypto.params.AsymmetricKeyParameter;
import org.bouncycastle.crypto.util.PrivateKeyFactory;
import org.bouncycastle.jcajce.provider.asymmetric.x509.CertificateFactory;
import org.bouncycastle.operator.ContentSigner;
import org.bouncycastle.operator.DefaultDigestAlgorithmIdentifierFinder;
import org.bouncycastle.operator.DefaultSignatureAlgorithmIdentifierFinder;
import org.bouncycastle.operator.bc.BcRSAContentSignerBuilder;

import java.io.ByteArrayInputStream;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;

@Slf4j
public class CertificateSigner {

    public static X509Certificate signCertificate(
            PrivateKey privateKey,
            X509v3CertificateBuilder certificateBuilder,
            CertificateExtendedData certificateExtendedData) {
        try {
            // Appose the extended data from the template.
            for (Object[] extensions : certificateExtendedData.getExtensions()) {
                certificateBuilder.addExtension(
                        (ASN1ObjectIdentifier) extensions[0],
                        (boolean) extensions[1],
                        (ASN1Encodable) extensions[2]);
            }
            // Initialize the signing.
            AlgorithmIdentifier sigAlgId =
                    new DefaultSignatureAlgorithmIdentifierFinder().find(JamsCA.signingAlgorithm);
            AlgorithmIdentifier digAlgId =
                    new DefaultDigestAlgorithmIdentifierFinder().find(sigAlgId);
            AsymmetricKeyParameter asymmetricKeyParameter =
                    PrivateKeyFactory.createKey(privateKey.getEncoded());
            // Sign the certificate.
            ContentSigner sigGen =
                    new BcRSAContentSignerBuilder(sigAlgId, digAlgId).build(asymmetricKeyParameter);
            Certificate eeX509CertificateStructure =
                    certificateBuilder.build(sigGen).toASN1Structure();
            return (X509Certificate)
                    new CertificateFactory()
                            .engineGenerateCertificate(
                                    new ByteArrayInputStream(
                                            eeX509CertificateStructure.getEncoded()));
        } catch (Exception e) {
            log.error("An error occurred while signing certificate: " + e);
            return null;
        }
    }
}
