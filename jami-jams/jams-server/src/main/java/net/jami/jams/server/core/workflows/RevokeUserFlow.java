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

import lombok.extern.slf4j.Slf4j;

import net.jami.jams.common.objects.requests.RevocationRequest;
import net.jami.jams.common.objects.requests.RevocationType;
import net.jami.jams.common.objects.responses.DeviceRevocationResponse;
import net.jami.jams.common.objects.user.User;

import java.math.BigInteger;

@Slf4j
public class RevokeUserFlow {

    public static DeviceRevocationResponse revokeUser(String username) {
        DeviceRevocationResponse response = new DeviceRevocationResponse();
        try {
            User user = dataStore.getUserDao().getByUsername(username).get();
            if (user == null) {
                log.error("Unable to find user!");
                return null;
            }
            BigInteger serialNumber = user.getCertificate().getSerialNumber();
            RevocationRequest request = new RevocationRequest();
            request.setRevocationType(RevocationType.USER);
            request.setIdentifier(serialNumber);
            certificateAuthority.revokeCertificate(request);

            // Wait for the CRL worker to complete certificate revocation
            certificateAuthority.waitForRevokeCompletion();

            // Check if the certificate has been revoked
            if (certificateAuthority.getLatestCRL().get().getRevokedCertificate(serialNumber)
                    != null) {
                // Certificate revoked successfully
                response.setSuccess(true);
                return response;
            } else {
                // Certificate not yet revoked
                log.error(
                        "The certificate has not appeared in the CRL. Operation may have failed.");
                response.setSuccess(false);
                return response;
            }
        } catch (Exception e) {
            log.error("An error occurred while revoking device: {}", e.getMessage());
            response.setSuccess(false);
            response.setErrorDetails(e.getMessage());
            return response;
        }
    }
}
