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
package net.jami.jams.server;

import com.google.gson.Gson;

import javassist.ClassPool;

import lombok.extern.slf4j.Slf4j;

import net.jami.datastore.main.DataStore;
import net.jami.jams.common.annotations.ScopedServletAnnotationScanner;
import net.jami.jams.common.authentication.AuthenticationSourceType;
import net.jami.jams.common.authentication.local.LocalAuthSettings;
import net.jami.jams.common.authmodule.AuthenticationModule;
import net.jami.jams.common.cryptoengineapi.CertificateAuthority;
import net.jami.jams.common.jami.NameServer;
import net.jami.jams.common.serialization.adapters.GsonFactory;
import net.jami.jams.common.server.ServerSettings;
import net.jami.jams.common.utils.LibraryLoader;
import net.jami.jams.nameserver.LocalNameServer;
import net.jami.jams.nameserver.PublicNameServer;
import net.jami.jams.server.core.TomcatLauncher;
import net.jami.jams.server.licensing.LicenseService;
import net.jami.jams.server.startup.AuthModuleLoader;
import net.jami.jams.server.startup.CryptoEngineLoader;
import net.jami.jams.server.update.JAMSUpdater;
import net.jami.jams.server.update.UpdateInterface;

import org.bouncycastle.openssl.jcajce.JcaPEMWriter;

import java.awt.Desktop;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.io.Reader;
import java.net.URI;
import java.util.concurrent.atomic.AtomicBoolean;

@Slf4j
// In order to make this "stoppable" to simply, I turned the server itself into
// a thread.
public class Server {

    public static final AtomicBoolean isInstalled = new AtomicBoolean(false);
    public static final AtomicBoolean activated = new AtomicBoolean(false);

    public static DataStore dataStore;
    // This one gets loaded via JAR, to make it more flexible.
    public static CertificateAuthority certificateAuthority;
    public static AuthenticationModule userAuthenticationModule;
    public static NameServer nameServer;
    public static TomcatLauncher tomcatLauncher = null;
    public static LicenseService licenseService = new LicenseService();
    public static final UpdateInterface updateInterface = new UpdateInterface();
    public static JAMSUpdater appUpdater = new JAMSUpdater(new AtomicBoolean(false));
    private static final Gson gson = GsonFactory.createGson();

    public static void main(String[] args) {
        // This is a fix to drop old cached stuff from the tomcat classloader.
        ClassPool.getDefault().clearImportedPackages();
        ScopedServletAnnotationScanner scanner = new ScopedServletAnnotationScanner();
        scanner.processClasses(
                new java.io.File(
                                Server.class
                                        .getProtectionDomain()
                                        .getCodeSource()
                                        .getLocation()
                                        .getPath())
                        .getName());
        switch (args.length) {
            case 1:
                tomcatLauncher = new TomcatLauncher(Integer.parseInt(args[0]));
                break;
            case 3:
                tomcatLauncher = new TomcatLauncher(Integer.parseInt(args[0]), args[1], args[2]);
                break;
            default:
                log.error("Incorrect number of start arguments provided!");
                System.exit(-1);
                break;
        }

        // Pre-load the libraries we should pre-load.
        LibraryLoader.loadlibs("libs", Server.class);
        // Step 1: Create the data store.
        dataStore = new DataStore("jdbc:derby:jams;create=true");

        // Create image folder if it doesn't exist.
        createImageFolder();

        File configJsonFile =
                new File(System.getProperty("user.dir") + File.separator + "config.json");
        isInstalled.set(configJsonFile.exists());
        log.info("Server is already installed: " + isInstalled.get());

        if (isInstalled.get()) {
            try {
                Reader reader = new FileReader(configJsonFile);
                loadConfig(reader);
                // This covers the case where the server is installed but the CA file is missing.
                createCAFile();
                log.info("All services are UP and ready for use...");
            } catch (Exception e) {
                log.error(
                        "Unable to load configuration file or initialize some components - this is critical");
                System.exit(1);
            }
        } else {
            certificateAuthority = CryptoEngineLoader.loadCertificateAuthority(null, dataStore);
            userAuthenticationModule =
                    AuthModuleLoader.loadAuthenticationModule(dataStore, certificateAuthority);
            log.info("Started server with empty modules waiting for setup...");
        }
        // Now pop-up the GUI
        // Here we need to do a small spin-wait because keys may be slow to generate.
        try {
            startGUI();
            log.info("Server is now running!");
        } catch (Exception e) {
            log.error("Unable to start GUI with error {}", e.getMessage());
        }
    }

    private static void createImageFolder() {
        File imagesFolder = new File("." + File.separator + "images");
        if (!imagesFolder.exists()) {
            boolean created = imagesFolder.mkdirs();
            if (created) {
                log.info("Created images folder");
            } else {
                log.error("Failed to create images folder");
                System.exit(-1);
            }
        }
    }

    private static void createCAFile() {
        if (!new File("CA.pem").exists()) {
            try {
                JcaPEMWriter pemWriter = new JcaPEMWriter(new FileWriter("CA.pem"));
                pemWriter.writeObject(certificateAuthority.getCA());
                pemWriter.close();
            } catch (IOException e) {
                log.error("Unable to create CA file: " + e);
            }
        }
    }

    private static void loadConfig(Reader reader) {
        ServerSettings serverSettings = gson.fromJson(reader, ServerSettings.class);

        certificateAuthority =
                CryptoEngineLoader.loadCertificateAuthority(
                        serverSettings.getCaConfiguration(), dataStore);
        if (certificateAuthority == null) {
            log.error("Unable to load certificate authority - this is critical");
            System.exit(1);
        }
        userAuthenticationModule =
                AuthModuleLoader.loadAuthenticationModule(dataStore, certificateAuthority);

        if (serverSettings.getLdapConfiguration() != null)
            userAuthenticationModule.attachAuthSource(
                    AuthenticationSourceType.LDAP, serverSettings.getLdapConfiguration());

        if (serverSettings.getActiveDirectoryConfiguration() != null) {
            userAuthenticationModule.attachAuthSource(
                    AuthenticationSourceType.AD, serverSettings.getActiveDirectoryConfiguration());
        }

        if (serverSettings.getLocalDirectoryConfiguration() != null) {
            LocalAuthSettings settings =
                    gson.fromJson(
                            serverSettings.getLocalDirectoryConfiguration(),
                            LocalAuthSettings.class);
            if (settings.getPublicNames())
                nameServer = new PublicNameServer(settings.getPublicNameServer());
            else
                nameServer =
                        new LocalNameServer(
                                dataStore,
                                userAuthenticationModule,
                                serverSettings.getServerPublicURI());
        } else
            nameServer =
                    new LocalNameServer(
                            dataStore,
                            userAuthenticationModule,
                            serverSettings.getServerPublicURI());

        licenseService.loadLicense();
    }

    public static void startGUI() throws Exception {
        boolean ready = false;
        while (!ready) {
            log.info("Waiting for authentication module to be ready…");
            if (userAuthenticationModule.getAuthModulePubKey() != null) {
                ready = true;
            }
            Thread.sleep(10);
        }
        log.info("Authentication module is ready!");
        if (Desktop.isDesktopSupported()
                && Desktop.getDesktop().isSupported(Desktop.Action.BROWSE)) {
            Desktop.getDesktop()
                    .browse(
                            new URI(
                                    tomcatLauncher.getTomcat().getConnector().getScheme()
                                            + "://localhost:"
                                            + tomcatLauncher
                                                    .getTomcat()
                                                    .getService()
                                                    .findConnectors()[0]
                                                    .getPort()));
        } else {
            log.info("There is no graphical interface on this system - please connect remotely!");
        }
    }
}
