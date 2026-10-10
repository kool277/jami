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

import lombok.extern.slf4j.Slf4j;

import java.io.FileOutputStream;
import java.security.KeyStore;

@Slf4j
public class ActivateSubscriptionWorkflow {

    public static boolean activateSubscription(String data) {
        try {
            // TODO: Decode the the data into a certificate and private key.

            // TODO: Verify that the certificate has really been signed by Savoir-faire Linux and is
            // valid.

            // Build a keystore from the data.
            KeyStore ks = KeyStore.getInstance("JKS");
            char[] password = "changeit".toCharArray();
            ks.load(null, password);
            ks.setKeyEntry("license", null, null);
            FileOutputStream fos = new FileOutputStream("license.jks");
            ks.store(fos, password);
            fos.close();
            log.info("JAMS license activated successfully.");
            return true;
        } catch (Exception e) {
            log.error("An error occurred while attempting to activate license: {}", e.getMessage());
            return false;
        }
    }
}
