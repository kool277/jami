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

import com.google.gson.Gson;

import lombok.extern.slf4j.Slf4j;

import net.jami.jams.common.serialization.adapters.GsonFactory;
import net.jami.jams.common.updater.subscription.LicenseInformation;

import org.bouncycastle.asn1.pkcs.PrivateKeyInfo;
import org.bouncycastle.asn1.x509.SubjectPublicKeyInfo;
import org.bouncycastle.openssl.PEMKeyPair;
import org.bouncycastle.openssl.PEMParser;
import org.bouncycastle.openssl.jcajce.JcaPEMKeyConverter;
import org.bouncycastle.pkcs.PKCS10CertificationRequest;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Base64;
import java.util.HashMap;
import java.util.Vector;

import javax.naming.ldap.LdapName;
import javax.naming.ldap.Rdn;

@Slf4j
public class X509Utils {

    private static final String PVK_HEADER = "-----BEGIN PRIVATE KEY-----\n";
    private static final String PVK_TAIL = "\n-----END PRIVATE KEY-----";
    private static final String CERT_HEADER = "-----BEGIN CERTIFICATE-----\n";
    private static final String CERT_TAIL = "\n-----END CERTIFICATE-----";
    private static final String PPK_HEADER = "-----BEGIN PUBLIC KEY-----\n";
    private static final String PPK_TAIL = "\n-----END PUBLIC KEY-----";

    public static PrivateKey getKeyFromPEMString(String keyString) {
        if (keyString.isEmpty()) return null;

        try {
            PEMParser parser = new PEMParser(new StringReader(keyString));
            Object parsedObject = parser.readObject();
            if (parsedObject instanceof PEMKeyPair) {
                PEMKeyPair pk = (PEMKeyPair) parsedObject;
                PKCS8EncodedKeySpec keySpec =
                        new PKCS8EncodedKeySpec(pk.getPrivateKeyInfo().getEncoded());
                return KeyFactory.getInstance("RSA").generatePrivate(keySpec);
            } else {
                JcaPEMKeyConverter converter = new JcaPEMKeyConverter();
                return converter.getPrivateKey((PrivateKeyInfo) parsedObject);
            }
        } catch (Exception e) {
            log.error(
                    "An error occurred while converting the PEM to PrivateKey, stack trace: " + e);
            return null;
        }
    }

    public static PublicKey getPubKeyFromPEMString(String keyString) {
        try {
            PEMParser parser = new PEMParser(new StringReader(keyString));
            Object parsedObject = parser.readObject();
            if (parsedObject instanceof PEMKeyPair) {
                PEMKeyPair pk = (PEMKeyPair) parsedObject;
                PKCS8EncodedKeySpec keySpec =
                        new PKCS8EncodedKeySpec(pk.getPublicKeyInfo().getEncoded());
                return KeyFactory.getInstance("RSA").generatePublic(keySpec);
            } else {
                JcaPEMKeyConverter converter = new JcaPEMKeyConverter();
                return converter.getPublicKey((SubjectPublicKeyInfo) parsedObject);
            }
        } catch (Exception e) {
            log.error("An error occurred while reading the public key from string!");
            return null;
        }
    }

    public static X509Certificate getCertificateFromPEMString(String certificateString) {
        try {
            CertificateFactory certificateFactory = CertificateFactory.getInstance("X.509");
            InputStream inputStream = new ByteArrayInputStream(certificateString.getBytes());
            return (X509Certificate) certificateFactory.generateCertificate(inputStream);
        } catch (Exception e) {
            log.error("An error occurred while converting the PEM to X509, stack trace: " + e);
            return null;
        }
    }

    public static String getPEMStringFromPrivateKey(PrivateKey privateKey) {
        StringBuilder stringBuilder = new StringBuilder();
        try {
            stringBuilder.append(PVK_HEADER);
            stringBuilder.append(Base64.getEncoder().encodeToString(privateKey.getEncoded()));
            stringBuilder.append(PVK_TAIL);
            return stringBuilder.toString();
        } catch (Exception e) {
            log.error(
                    "An error occurred while converting the Private Key to PEM, stack trace: " + e);
            return null;
        }
    }

    public static String getPEMStringFromCertificate(X509Certificate certificate) {
        StringBuilder stringBuilder = new StringBuilder();
        try {
            stringBuilder.append(CERT_HEADER);
            stringBuilder.append(Base64.getEncoder().encodeToString(certificate.getEncoded()));
            stringBuilder.append(CERT_TAIL);
            return stringBuilder.toString();
        } catch (Exception e) {
            log.error(
                    "An error occurred while converting the Certificate Key to PEM, stack trace: "
                            + e);
            return null;
        }
    }

    public static String getPEMStringFromPubKey(PublicKey publicKey) {
        StringBuilder stringBuilder = new StringBuilder();
        try {
            stringBuilder.append(PPK_HEADER);
            stringBuilder.append(Base64.getEncoder().encodeToString(publicKey.getEncoded()));
            stringBuilder.append(PPK_TAIL);
            return stringBuilder.toString();
        } catch (Exception e) {
            log.error(
                    "An error occurred while converting the Public Key to PEM, stack trace: " + e);
            return null;
        }
    }

    public static PKCS10CertificationRequest getCSRFromString(String pkcs10StringRequest) {
        try {
            ByteArrayInputStream pemStream =
                    new ByteArrayInputStream(pkcs10StringRequest.getBytes(StandardCharsets.UTF_8));
            PEMParser pemParser =
                    new PEMParser(new BufferedReader(new InputStreamReader(pemStream)));
            Object parsedObj = pemParser.readObject();
            if (parsedObj instanceof PKCS10CertificationRequest)
                return (PKCS10CertificationRequest) parsedObj;
            log.error("The request does not seem to be a CSR request!");
            return null;
        } catch (Exception e) {
            log.error(
                    "An error occurred while converting the string to PKCS10 Certification Request, stack trace: "
                            + e);
            return null;
        }
    }

    public static Vector<Object> loadLicenseFromDatFile(String fileContents) {
        Vector<Object> res = new Vector<>();
        String keypair = new String(Base64.getDecoder().decode(fileContents));
        int cutPoint = keypair.indexOf("-----BEGIN PRIVATE KEY-----");
        String strCertificate = keypair.substring(0, cutPoint);
        String strPrivateKey = keypair.substring(cutPoint);
        res.add(getCertificateFromPEMString(strCertificate));
        res.add(getKeyFromPEMString(strPrivateKey));
        return res;
    }

    public static LicenseInformation extractSubscriptionTypeFromCertificate(
            X509Certificate certificate) {
        try {
            LdapName ln = new LdapName(certificate.getSubjectDN().toString());
            for (Rdn rdn : ln.getRdns()) {
                try {
                    Gson gson = GsonFactory.createGson();
                    byte[] bytes = Base64.getDecoder().decode(rdn.getValue().toString().getBytes());
                    return gson.fromJson(new String(bytes, "US-ASCII"), LicenseInformation.class);
                } catch (Exception e) {
                }
            }
            return null;
        } catch (Exception e) {
            return null;
        }
    }

    public static HashMap<String, String> extractDNFromCertificate(X509Certificate certificate)
            throws Exception {
        HashMap<String, String> subjectMap = new HashMap<>();
        LdapName ln = new LdapName(certificate.getSubjectDN().toString());
        for (Rdn rdn : ln.getRdns()) {
            subjectMap.put(rdn.getType(), rdn.getValue().toString());
        }
        return subjectMap;
    }
}
