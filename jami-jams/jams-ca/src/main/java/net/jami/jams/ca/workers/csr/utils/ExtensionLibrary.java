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

import net.jami.jams.ca.JamsCA;

import org.bouncycastle.asn1.x509.AccessDescription;
import org.bouncycastle.asn1.x509.AuthorityInformationAccess;
import org.bouncycastle.asn1.x509.BasicConstraints;
import org.bouncycastle.asn1.x509.CRLDistPoint;
import org.bouncycastle.asn1.x509.DistributionPoint;
import org.bouncycastle.asn1.x509.DistributionPointName;
import org.bouncycastle.asn1.x509.ExtendedKeyUsage;
import org.bouncycastle.asn1.x509.Extension;
import org.bouncycastle.asn1.x509.GeneralName;
import org.bouncycastle.asn1.x509.GeneralNames;
import org.bouncycastle.asn1.x509.KeyPurposeId;
import org.bouncycastle.asn1.x509.KeyUsage;

public class ExtensionLibrary {

    public static CertificateExtendedData caExtensions = new CertificateExtendedData();
    public static CertificateExtendedData userExtensions = new CertificateExtendedData();
    public static CertificateExtendedData ocspExtensions = new CertificateExtendedData();
    public static CertificateExtendedData deviceExtensions = new CertificateExtendedData();

    private static final int SCHEMA = GeneralName.uniformResourceIdentifier;

    static {
        // Pre-Define the CRL Distribution Point
        DistributionPoint[] distPoints = new DistributionPoint[1];
        distPoints[0] =
                new DistributionPoint(
                        new DistributionPointName(
                                new GeneralNames(
                                        new GeneralName(
                                                SCHEMA, JamsCA.serverDomain + "/api/auth/crl"))),
                        null,
                        null);

        // Pre-Define the AIA Point
        AccessDescription accessDescription =
                new AccessDescription(
                        AccessDescription.id_ad_ocsp,
                        new GeneralName(SCHEMA, JamsCA.serverDomain + "/api/ocsp"));

        // CA Extensions.
        caExtensions
                .getExtensions()
                .add(new Object[] {Extension.basicConstraints, true, new BasicConstraints(10)});
        caExtensions
                .getExtensions()
                .add(
                        new Object[] {
                            Extension.keyUsage,
                            false,
                            new KeyUsage(KeyUsage.cRLSign | KeyUsage.keyCertSign)
                        });

        // OCSP Extensions.
        ocspExtensions
                .getExtensions()
                .add(new Object[] {Extension.basicConstraints, true, new BasicConstraints(false)});
        ocspExtensions
                .getExtensions()
                .add(
                        new Object[] {
                            Extension.extendedKeyUsage,
                            false,
                            new ExtendedKeyUsage(KeyPurposeId.id_kp_OCSPSigning)
                        });
        ocspExtensions
                .getExtensions()
                .add(
                        new Object[] {
                            Extension.keyUsage,
                            false,
                            new KeyUsage(
                                    KeyUsage.nonRepudiation
                                            | KeyUsage.digitalSignature
                                            | KeyUsage.keyEncipherment)
                        });

        // User extensions (the user is a sub-CA)
        userExtensions
                .getExtensions()
                .add(new Object[] {Extension.basicConstraints, true, new BasicConstraints(10)});
        userExtensions
                .getExtensions()
                .add(
                        new Object[] {
                            Extension.keyUsage,
                            false,
                            new KeyUsage(KeyUsage.cRLSign | KeyUsage.keyCertSign)
                        });
        userExtensions
                .getExtensions()
                .add(
                        new Object[] {
                            Extension.cRLDistributionPoints, false, new CRLDistPoint(distPoints)
                        });
        userExtensions
                .getExtensions()
                .add(
                        new Object[] {
                            Extension.authorityInfoAccess,
                            false,
                            new AuthorityInformationAccess(accessDescription)
                        });

        // Device extensions
        deviceExtensions
                .getExtensions()
                .add(new Object[] {Extension.basicConstraints, true, new BasicConstraints(false)});
        deviceExtensions
                .getExtensions()
                .add(
                        new Object[] {
                            Extension.keyUsage,
                            false,
                            new KeyUsage(
                                    KeyUsage.digitalSignature
                                            | KeyUsage.dataEncipherment
                                            | KeyUsage.keyAgreement
                                            | KeyUsage.nonRepudiation)
                        });
        deviceExtensions
                .getExtensions()
                .add(
                        new Object[] {
                            Extension.cRLDistributionPoints, false, new CRLDistPoint(distPoints)
                        });
        deviceExtensions
                .getExtensions()
                .add(
                        new Object[] {
                            Extension.authorityInfoAccess,
                            false,
                            new AuthorityInformationAccess(accessDescription)
                        });
    }
}
