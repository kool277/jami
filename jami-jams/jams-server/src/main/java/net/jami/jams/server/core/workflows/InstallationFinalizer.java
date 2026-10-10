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
package net.jami.jams.server.core.workflows;

import static net.jami.jams.server.Server.certificateAuthority;
import static net.jami.jams.server.Server.dataStore;
import static net.jami.jams.server.Server.nameServer;
import static net.jami.jams.server.Server.tomcatLauncher;
import static net.jami.jams.server.Server.userAuthenticationModule;

import com.google.gson.Gson;

import lombok.extern.slf4j.Slf4j;

import net.jami.jams.common.authentication.AuthenticationSourceType;
import net.jami.jams.common.objects.roots.X509Fields;
import net.jami.jams.common.objects.system.SystemAccount;
import net.jami.jams.common.objects.system.SystemAccountType;
import net.jami.jams.common.serialization.adapters.GsonFactory;
import net.jami.jams.common.server.ServerSettings;
import net.jami.jams.nameserver.LocalNameServer;
import net.jami.jams.nameserver.PublicNameServer;
import net.jami.jams.server.Server;
import net.jami.jams.server.servlets.api.install.CachedObjects;
import net.jami.jams.server.startup.AuthModuleLoader;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.security.KeyStore;

@Slf4j
public class InstallationFinalizer {

    private boolean useLocalNS = true;
    private final Gson gson = GsonFactory.createGson();

    public boolean finalizeInstallation() {
        // Basically here we build the config and flush it.
        try {
            log.info("Building configuration from submitted variables…");
            ServerSettings serverSettings = new ServerSettings();
            serverSettings.setCaConfiguration(
                    gson.toJson(CachedObjects.certificateAuthorityConfig));
            // TODO: This is a bit of hack, we should fix this someday.
            serverSettings.setServerPublicURI(
                    CachedObjects.certificateAuthorityConfig.getServerDomain());
            if (CachedObjects.activeDirectorySettings != null) {
                serverSettings.setActiveDirectoryConfiguration(
                        gson.toJson(CachedObjects.activeDirectorySettings));
                log.info(
                        "Server configured to use Active Directory as the authentication backend.");
            }
            if (CachedObjects.ldapSettings != null) {
                serverSettings.setLdapConfiguration(gson.toJson(CachedObjects.ldapSettings));
                log.info("Server configured to use LDAP as the authentication backend.");
            }
            if (CachedObjects.localAuthSettings != null) {
                serverSettings.setLocalDirectoryConfiguration(
                        gson.toJson(CachedObjects.localAuthSettings));
                if (CachedObjects.localAuthSettings.getPublicNames()) {
                    useLocalNS = false;
                    nameServer =
                            new PublicNameServer(
                                    CachedObjects.localAuthSettings.getPublicNameServer());
                    log.warn(
                            "Server configured to use {} as the name server for Jami clients.",
                            CachedObjects.localAuthSettings.getPublicNameServer());
                }
                log.info("Server is configured to use local authentication engine.");
            }
            // Now flush the server settings.
            OutputStream os = new FileOutputStream(new File("config.json"));
            os.write(gson.toJson(serverSettings).getBytes());
            os.flush();
            os.close();
            log.info("Settings saved succesfully to configuration file.");
            log.info("Attempting to save the CA and generate the OCSP certificate…");
            if (CachedObjects.createCARequest.getFields() != null) {
                SystemAccount caAccount = new SystemAccount();
                caAccount.setSystemAccountType(SystemAccountType.CA);
                caAccount.setX509Fields(CachedObjects.createCARequest.getFields());
                certificateAuthority.getSignedCertificate(caAccount);
                dataStore.getSystemDao().storeObject(caAccount);
                log.info("CA stored successfully.");
                certificateAuthority.init(serverSettings.getCaConfiguration(), caAccount, null);
                SystemAccount ocspAccount = new SystemAccount();
                ocspAccount.setX509Fields(new X509Fields());
                ocspAccount.getX509Fields().setCommonName("OCSP Server Certificate");
                ocspAccount.setSystemAccountType(SystemAccountType.OCSP);
                ocspAccount.getX509Fields().setLifetime(caAccount.getX509Fields().getLifetime());
                certificateAuthority.getSignedCertificate(ocspAccount);
                dataStore.getSystemDao().storeObject(ocspAccount);
                log.info("OCSP certificate created and stored successfully.");
                certificateAuthority.init(
                        serverSettings.getCaConfiguration(), caAccount, ocspAccount);
                log.info(
                        "Certificate authority with the appropriate settings inited successfully.");
            }
            log.info("Initializing the selected authentication providers");
            userAuthenticationModule =
                    AuthModuleLoader.loadAuthenticationModule(dataStore, certificateAuthority);
            if (serverSettings.getActiveDirectoryConfiguration() != null)
                userAuthenticationModule.attachAuthSource(
                        AuthenticationSourceType.AD,
                        serverSettings.getActiveDirectoryConfiguration());
            if (serverSettings.getLdapConfiguration() != null)
                userAuthenticationModule.attachAuthSource(
                        AuthenticationSourceType.LDAP, serverSettings.getLdapConfiguration());
            if (useLocalNS)
                nameServer =
                        new LocalNameServer(
                                dataStore,
                                userAuthenticationModule,
                                serverSettings.getServerPublicURI());
            log.info("Building keystore for client auth for Tomcat…");
            KeyStore ks = KeyStore.getInstance("JKS");
            char[] password = "changeit".toCharArray();
            ks.load(null, password);
            ks.setCertificateEntry("jams-ca", certificateAuthority.getCA());
            FileOutputStream fos = new FileOutputStream("keystore.jks");
            ks.store(fos, password);
            fos.close();
            log.info("Keystore for Tomcat built successfully.");
            Server.isInstalled.set(true);
            // fix to swap connectors - this assumes you are running with an SSL certificate
            tomcatLauncher.swapConnectors();
            log.info("The installation completed successfully. JAMS is set up and ready to use.");
        } catch (Exception e) {
            log.error("An error occurred while saving settings to disk: " + e);
            return false;
        }
        return true;
    }
}
