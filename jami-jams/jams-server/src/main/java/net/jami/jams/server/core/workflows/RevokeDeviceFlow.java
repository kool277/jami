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

import net.jami.jams.common.objects.devices.Device;
import net.jami.jams.common.objects.requests.RevocationRequest;
import net.jami.jams.common.objects.requests.RevocationType;
import net.jami.jams.common.objects.responses.DeviceRevocationResponse;

import java.math.BigInteger;
import java.util.Optional;

@Slf4j
public class RevokeDeviceFlow {

    public static DeviceRevocationResponse revokeDevice(String username, String deviceId) {
        DeviceRevocationResponse response = new DeviceRevocationResponse();
        try {
            Optional<Device> result =
                    dataStore.getDeviceDao().getByDeviceIdAndOwner(deviceId, username);
            if (result.isEmpty()) {
                log.error("An error occurred while finding the device.");
                return null;
            }

            Device device = result.get();

            BigInteger serialNumber = device.getCertificate().getSerialNumber();

            synchronized (certificateAuthority) {
                RevocationRequest request =
                        new RevocationRequest(serialNumber, RevocationType.DEVICE);
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
            }
        } catch (Exception e) {
            log.error("An error occurred while revoking the device: {}", e.getMessage());
            response.setSuccess(false);
            response.setErrorDetails(e.getMessage());
            return response;
        }
    }
}
