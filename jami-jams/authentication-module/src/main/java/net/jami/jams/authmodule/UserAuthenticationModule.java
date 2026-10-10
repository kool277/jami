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
package net.jami.jams.authmodule;

import com.nimbusds.jwt.SignedJWT;

import lombok.extern.slf4j.Slf4j;

import net.jami.datastore.main.DataStore;
import net.jami.jams.common.authentication.AuthenticationSource;
import net.jami.jams.common.authentication.AuthenticationSourceType;
import net.jami.jams.common.authmodule.AuthModuleKey;
import net.jami.jams.common.authmodule.AuthTokenResponse;
import net.jami.jams.common.authmodule.AuthenticationModule;
import net.jami.jams.common.cryptoengineapi.CertificateAuthority;
import net.jami.jams.common.jami.NameServer;
import net.jami.jams.common.objects.user.AccessLevel;
import net.jami.jams.common.objects.user.User;
import net.jami.jams.common.utils.LibraryLoader;
import net.jami.jams.common.utils.X509Utils;

import org.apache.commons.codec.binary.Base64;
import org.bouncycastle.cert.X509CRLHolder;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.cert.CertPath;
import java.security.cert.CertPathValidator;
import java.security.cert.CertificateFactory;
import java.security.cert.PKIXParameters;
import java.security.cert.TrustAnchor;
import java.security.cert.X509Certificate;
import java.security.interfaces.RSAPublicKey;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
public class UserAuthenticationModule implements AuthenticationModule {
    // This contains the DOMAIN-SOURCE.
    // In general there is at most 2 here.
    private static final String LDAP_CONNECTOR_CLASS = "net.jami.jams.ldap.connector.LDAPConnector";
    private static final String AD_CONNECTOR_CLASS = "net.jami.jams.ad.connector.ADConnector";
    public static DataStore datastore;
    public static CertificateAuthority certificateAuthority;
    private CertificateFactory certificateFactory;
    CertPathValidator certPathValidator;
    private final TokenController tokenController;
    private PrivateKey privateKey = null;
    private PublicKey publicKey = null;
    // The data storage layer for tokens.

    private final ConcurrentHashMap<AuthModuleKey, AuthenticationSource> authenticationSources =
            new ConcurrentHashMap<>();

    public UserAuthenticationModule(DataStore dataStore, CertificateAuthority certificateAuthority)
            throws Exception {
        UserAuthenticationModule.datastore = dataStore;
        UserAuthenticationModule.certificateAuthority = certificateAuthority;

        certificateFactory = CertificateFactory.getInstance("X.509");
        certPathValidator = CertPathValidator.getInstance("PKIX");

        authenticationSources.put(
                new AuthModuleKey("LOCAL", AuthenticationSourceType.LOCAL), datastore);
        log.info("Started authentication module - default local source is already enabled!");

        File pubkeyFile = new File(System.getProperty("user.dir") + File.separator + "oauth.pub");
        File privateKeyFile =
                new File(System.getProperty("user.dir") + File.separator + "oauth.key");

        if (!privateKeyFile.exists() || !pubkeyFile.exists()) {
            log.info("Generating first time private/public keys for OAuth!");
            KeyPairGenerator keyPairGenerator = KeyPairGenerator.getInstance("RSA");
            keyPairGenerator.initialize(4096);
            KeyPair kp = keyPairGenerator.generateKeyPair();
            privateKey = kp.getPrivate();
            publicKey = kp.getPublic();
            // Store these to file.
            OutputStream os;
            os =
                    new FileOutputStream(
                            System.getProperty("user.dir") + File.separator + "oauth.key");
            os.write(X509Utils.getPEMStringFromPrivateKey(privateKey).getBytes());
            os.flush();
            os.close();
            log.info("OAuth private key stored successfully for future use.");
            os =
                    new FileOutputStream(
                            System.getProperty("user.dir") + File.separator + "oauth.pub");
            os.write(X509Utils.getPEMStringFromPubKey(publicKey).getBytes());
            os.flush();
            os.close();
            log.info("OAuth public key stored successfully for future use.");
        } else {
            InputStream privateInput = new FileInputStream(privateKeyFile);
            privateKey = X509Utils.getKeyFromPEMString(new String(privateInput.readAllBytes()));
            privateInput.close();
            log.info("OAuth private key loaded successfully.");

            InputStream publicInput = new FileInputStream(pubkeyFile);
            publicKey = X509Utils.getPubKeyFromPEMString(new String(publicInput.readAllBytes()));
            publicInput.close();
            log.info("OAuth public key loaded successfully.");
        }
        // TODO: Read signing key, if file does not exist create it (also create the
        // corresponding public key)
        tokenController = new TokenController(privateKey);
        // Also expose the public key programatically.
        log.info("OAuth2 Token System instantiated successfully.");
    }

    @Override
    public void attachAuthSource(AuthenticationSourceType type, String settings) {
        switch (type) {
            case AD:
                loadAuthConnector(AD_CONNECTOR_CLASS, settings);
                break;
            case LDAP:
                loadAuthConnector(LDAP_CONNECTOR_CLASS, settings);
                break;
            default:
                break;
        }
    }

    private void loadAuthConnector(String className, String settings) {
        try {
            Class<?> cls = LibraryLoader.classLoader.loadClass(className);
            AuthenticationSource source =
                    (AuthenticationSource)
                            cls.getConstructor(String.class, DataStore.class)
                                    .newInstance(settings, UserAuthenticationModule.datastore);
            authenticationSources.put(
                    new AuthModuleKey(
                            source.getInfo().getRealm(),
                            source.getInfo().getAuthenticationSourceType()),
                    source);
        } catch (Exception e) {
            log.error("An error occurred while loading connector " + className + ": " + e);
        }
    }

    @Override
    public AuthTokenResponse authenticateUser(String username, String password) {
        AuthTokenResponse res = null;
        String hashPass = "";
        if (datastore.getUserDao().getByUsername(username).isPresent()) {
            User user = datastore.getUserDao().getByUsername(username).orElseThrow();
            if ((user.getUserType() == AuthenticationSourceType.LOCAL))
                hashPass = PasswordUtil.hashPassword(password, Base64.decodeBase64(user.getSalt()));
            else hashPass = password;

            if (hashPass != null
                    && authenticationSources
                            .get(new AuthModuleKey(user.getRealm(), user.getUserType()))
                            .authenticate(username, hashPass))
                return tokenController.getToken(user, null);
        }
        // The second case is much more violent, because we don't know in
        // advance "where" this user comes from, so we have to infer
        // (this is only really true for "users", all others are usually pre-marked)
        // This is also the case when we store the user into the DAO
        // - because he never existed before.
        for (AuthModuleKey key : authenticationSources.keySet()) {
            if (authenticationSources.get(key).authenticate(username, password)) {
                User user = new User();
                user.setUsername(username);
                user.setAccessLevel(AccessLevel.USER);
                user.setRealm(key.getRealm());
                user.setUserType(key.getType());
                // This is legal with a null ONLY because in this case there is no relation with
                // a external server.
                RegisterUserFlow.createUser(user, null);
                return tokenController.getToken(user, null);
            }
        }
        return res;
    }

    @Override
    public AuthTokenResponse authenticateUser(X509Certificate[] certificates) {
        try {
            // Verify the certificate chain
            // We create the certificate chain and remove the self-signed root CA
            List<X509Certificate> certificatesWithoutRootCA =
                    new ArrayList<>(Arrays.asList(certificates));
            if (!certificatesWithoutRootCA.isEmpty()) {
                X509Certificate lastCert =
                        certificatesWithoutRootCA.get(certificatesWithoutRootCA.size() - 1);
                if (isSelfSigned(lastCert)) {
                    certificatesWithoutRootCA.remove(lastCert);
                }
            } else {
                return null;
            }

            CertPath certPath = certificateFactory.generateCertPath(certificatesWithoutRootCA);

            PKIXParameters pkixParams =
                    new PKIXParameters(
                            Collections.singleton(
                                    new TrustAnchor(certificateAuthority.getCA(), null)));
            // Set OCSP revocation check to false since we use the internal CRL
            pkixParams.setRevocationEnabled(false);
            // Check that the certificates are valid at this time
            pkixParams.setDate(new Date());
            certPathValidator.validate(certPath, pkixParams);
            // Check certificate revocation with the internal CRL
            X509CRLHolder crl = certificateAuthority.getLatestCRL().get();
            for (X509Certificate certificate : certificatesWithoutRootCA) {
                if (crl.getRevokedCertificate(certificate.getSerialNumber()) != null) return null;
            }
            // Now that the certificate chain is valid, we can extract the user and device
            X509Certificate clientCertificate = certificates[1];
            X509Certificate deviceCertificate = certificates[0];
            String username = X509Utils.extractDNFromCertificate(clientCertificate).get("CN");
            // We need to extract the deviceId from the certificate
            User user = datastore.getUserDao().getByUsername(username).orElseThrow();
            return tokenController.getToken(
                    user, X509Utils.extractDNFromCertificate(deviceCertificate).get("UID"));
        } catch (Exception e) {
            return null;
        }
    }

    public AuthTokenResponse authenticateUser(X509Certificate deviceCertificate) {
        // In thise case we only generate the token because the reverse proxy already validated the
        // client's certificate chain
        try {
            String username = getIssuerCN(deviceCertificate);
            User user = datastore.getUserDao().getByUsername(username).orElseThrow();
            return tokenController.getToken(
                    user, X509Utils.extractDNFromCertificate(deviceCertificate).get("UID"));
        } catch (Exception e) {
            return null;
        }
    }

    public static String getIssuerCN(X509Certificate certificate) {
        // Get the issuer DN as a string
        String issuerDN = certificate.getIssuerX500Principal().getName();

        // Define a regex pattern to extract the CN part
        Pattern pattern = Pattern.compile("CN=([^,]+)");
        Matcher matcher = pattern.matcher(issuerDN);

        // If a CN is found, return it
        if (matcher.find()) {
            return matcher.group(1);
        } else {
            return null; // or handle the case where CN is not found
        }
    }

    public static boolean isSelfSigned(X509Certificate cert) {
        try {
            PublicKey key = cert.getPublicKey();
            cert.verify(key);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public ConcurrentHashMap<AuthModuleKey, AuthenticationSource> getAuthSources() {
        return authenticationSources;
    }

    @Override
    public boolean testModuleConfiguration(AuthenticationSourceType type, String settings) {
        try {
            String className = "";
            if (type.equals(AuthenticationSourceType.AD)) className = AD_CONNECTOR_CLASS;
            if (type.equals(AuthenticationSourceType.LDAP)) className = LDAP_CONNECTOR_CLASS;
            Class<?> cls = LibraryLoader.classLoader.loadClass(className);
            AuthenticationSource source =
                    (AuthenticationSource)
                            cls.getConstructor(String.class, DataStore.class)
                                    .newInstance(settings, UserAuthenticationModule.datastore);
            return source.test();
        } catch (Exception e) {
            log.error("The testing of the source was unsuccessful: " + e);
            return false;
        }
    }

    @Override
    public boolean createUser(
            AuthenticationSourceType type, String realm, NameServer nameServer, User user) {
        // This concept doesn't exist for LDAP or AD or any other hosted directory, in
        // this case we
        // simply run
        // very theoretically, we should allow LDAP to publish to the public registry,
        // but this is a
        // lot
        // more complex.
        return RegisterUserFlow.createUser(user, nameServer);
    }

    @Override
    public RSAPublicKey getAuthModulePubKey() {
        return (RSAPublicKey) publicKey;
    }

    @Override
    public char[] getOTP(String username) {
        Optional<User> user = datastore.getUserDao().getByUsername(username);
        return user.map(u -> u.getPassword().toCharArray()).orElse(new char[0]);
    }

    @Override
    public boolean verifyToken(SignedJWT token) {
        return false;
    }

    @Override
    public void deleteToken(SignedJWT token) {}
}
