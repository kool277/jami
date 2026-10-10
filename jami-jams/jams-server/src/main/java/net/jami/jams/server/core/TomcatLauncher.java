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

package net.jami.jams.server.core;

import static net.jami.jams.server.Server.certificateAuthority;

import lombok.Getter;
import lombok.extern.slf4j.Slf4j;

import org.apache.catalina.WebResourceRoot;
import org.apache.catalina.connector.Connector;
import org.apache.catalina.core.StandardContext;
import org.apache.catalina.startup.Tomcat;
import org.apache.catalina.webresources.DirResourceSet;
import org.apache.catalina.webresources.JarResourceSet;
import org.apache.catalina.webresources.StandardRoot;
import org.apache.coyote.http11.Http11NioProtocol;
import org.apache.tomcat.util.descriptor.web.ErrorPage;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

// This class boots the tomcat server which provides the subsystem
// for the API calls.
@Slf4j
@Getter
public class TomcatLauncher {

    private final Tomcat tomcat = new Tomcat();
    private StandardContext context;

    public TomcatLauncher(int port) {
        tomcat.getService().addConnector(TomcatConnectorFactory.getNoSSLConnector(port));
        this.startServer();
    }

    // Swap connectors fix.
    public void swapConnectors() {
        if (getTomcat().getConnector().findSslHostConfigs() != null
                && getTomcat().getConnector().findSslHostConfigs().length > 0) {
            getTomcat()
                    .getConnector()
                    .findSslHostConfigs()[0]
                    .setTruststoreFile(
                            System.getProperty("user.dir") + File.separator + "keystore.jks");
            getTomcat().getConnector().findSslHostConfigs()[0].setTruststorePassword("changeit");
            getTomcat()
                    .getConnector()
                    .findSslHostConfigs()[0]
                    .setCertificateVerification("optional");
            ((Http11NioProtocol) getTomcat().getConnector().getProtocolHandler())
                    .reloadSslHostConfigs();
        } else {
            log.error(
                    "Unable to reload SSL configuration because the server is not running over SSL!");
        }
    }

    public TomcatLauncher(int port, String certificateFile, String keyFile) {
        if (!Files.exists(
                        Paths.get(
                                System.getProperty("user.dir") + File.separator + certificateFile))
                || !Files.exists(
                        Paths.get(System.getProperty("user.dir") + File.separator + keyFile))) {
            log.info("Unable to find certificate or keyfile, exiting");
            System.exit(1);
        }
        if (Files.exists(
                Paths.get(System.getProperty("user.dir") + File.separator + "keystore.jks"))) {
            log.info("Found a valid trust store, injecting into tomcat!");
            tomcat.getService()
                    .addConnector(
                            TomcatConnectorFactory.getSSLConnectorWithTrustStore(
                                    certificateFile, keyFile, port));
        } else {
            Connector connector =
                    TomcatConnectorFactory.getSSLConnectorWithoutTrustStore(
                            certificateFile, keyFile, port);
            tomcat.getService().addConnector(connector);
        }
        this.startServer();
    }

    public void startServer() {
        String jarName = System.getProperty("user.dir") + File.separator + "jams-server.jar";
        log.info("JAR Resource File = " + jarName);
        String contextPath =
                new File(System.getProperty("user.dir")).getAbsolutePath() + File.separator + "app";
        try {
            Path path = Paths.get(contextPath);
            Files.createDirectories(path);
        } catch (Exception e) {
            log.error("Unable to create context directory", e);
        }
        context = (StandardContext) tomcat.addWebapp("", contextPath);
        context.getJarScanner().setJarScanFilter((jarScanType, s) -> false);
        log.info("Serving application from: " + contextPath);
        WebResourceRoot resources = new StandardRoot(context);
        if (jarName.contains(".jar")) {
            resources.addPreResources(
                    new JarResourceSet(
                            resources,
                            "/WEB-INF/classes",
                            jarName,
                            "/net/jami/jams/server/servlets"));
            resources.addPreResources(new JarResourceSet(resources, "/", jarName, "/webapp"));
        } else {
            log.info(
                    "WARNING: You are running from your local filesystem, this makes sense only for developers!");
            StringBuilder basePath = new StringBuilder();
            String[] paths = System.getProperty("user.dir").split("/");
            for (int i = 0; i < paths.length - 1; i++) {
                basePath.append("/").append(paths[i]);
            }
            basePath.append("/jams-server");
            resources.addPreResources(
                    new DirResourceSet(
                            resources,
                            "/WEB-INF/classes",
                            basePath + "/target/classes/net/jami/jams/server/servlets",
                            "/"));
            resources.addPreResources(
                    new DirResourceSet(resources, "/", basePath + "/target/classes", "/webapp"));
        }
        context.setResources(resources);
        // We always go to login by default.
        context.addWelcomeFile("index");
        // Register error pages.
        ErrorPage notFound = new ErrorPage();
        notFound.setErrorCode(404);
        notFound.setLocation("/");
        ErrorPage genericError = new ErrorPage();
        genericError.setErrorCode(500);
        genericError.setLocation("/500");
        context.addErrorPage(notFound);
        context.addErrorPage(genericError);
        try {
            tomcat.start();
        } catch (Exception e) {
            log.error("An error occurred while attempting to start Web server.");
        }
    }

    public void stopTomcat() {
        try {
            synchronized (tomcat) {
                certificateAuthority.shutdownThreads();
                tomcat.stop();
                context.destroy();
                tomcat.destroy();
            }
        } catch (Exception e) {
            log.info(
                    "An error occurred while attempting to stop Tomcat server: {}", e.getMessage());
        }
    }
}
