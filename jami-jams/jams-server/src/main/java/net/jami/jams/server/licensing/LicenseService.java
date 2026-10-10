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
package net.jami.jams.server.licensing;

import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;

import net.jami.jams.common.updater.subscription.LicenseInformation;
import net.jami.jams.common.utils.X509Utils;
import net.jami.jams.server.Server;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.PrivateKey;
import java.security.cert.CertificateExpiredException;
import java.security.cert.CertificateNotYetValidException;
import java.security.cert.X509Certificate;
import java.util.Vector;

@Getter
@Setter
@Slf4j
public class LicenseService {

    private X509Certificate certificate;
    private PrivateKey privateKey;
    private X509Certificate caCertificate;
    private LicenseInformation licenseInformation = new LicenseInformation();

    // Load the license.
    public void loadLicense() {
        try {
            Path path = Path.of(System.getProperty("user.dir") + File.separator + "license.dat");
            Vector<Object> v =
                    X509Utils.loadLicenseFromDatFile(new String(Files.readAllBytes(path)));

            certificate = (X509Certificate) v.get(0);
            privateKey = (PrivateKey) v.get(1);

            caCertificate =
                    X509Utils.getCertificateFromPEMString(
                            new String(
                                    LicenseService.class
                                            .getClassLoader()
                                            .getResourceAsStream("oem/ca.crt")
                                            .readAllBytes()));

            // Check the license for validity.
            try {
                certificate.checkValidity();
            } catch (CertificateExpiredException | CertificateNotYetValidException c2) {
                log.error("Your license is not yet valid or has expired!");
                Server.activated.set(false);
            }
            try {
                certificate.verify(caCertificate.getPublicKey());
                // If all these checks have passed then:
                Server.activated.set(true);
                log.info("Server is activated with valid license: {}", Server.activated.get());
                Server.appUpdater.setLicense(certificate, privateKey);
                log.info("License inside updater module set successfully.");
            } catch (Exception e) {
                log.error("The license file you have provided was unable to be verified!");
                Server.activated.set(false);
            }
        } catch (Exception e) {
            log.error("An error occurred while loading the license.");
            Server.activated.set(false);
        }
    }
}
