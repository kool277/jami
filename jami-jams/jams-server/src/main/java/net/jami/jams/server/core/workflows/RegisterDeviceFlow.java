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

import static net.jami.jams.authmodule.UserAuthenticationModule.datastore;
import static net.jami.jams.server.Server.certificateAuthority;
import static net.jami.jams.server.Server.dataStore;
import static net.jami.jams.server.Server.nameServer;
import static net.jami.jams.server.Server.userAuthenticationModule;

import lombok.extern.slf4j.Slf4j;

import net.jami.jams.authmodule.UserAuthenticationModule;
import net.jami.jams.common.authmodule.AuthModuleKey;
import net.jami.jams.common.objects.devices.Device;
import net.jami.jams.common.objects.requests.DeviceRegistrationRequest;
import net.jami.jams.common.objects.responses.DeviceRegistrationResponse;
import net.jami.jams.common.objects.user.User;
import net.jami.jams.common.objects.user.UserProfile;
import net.jami.jams.dht.DeviceReceiptGenerator;

import java.security.cert.X509Certificate;
import java.util.Date;

@Slf4j
public class RegisterDeviceFlow {

    public static DeviceRegistrationResponse registerDevice(
            String username, DeviceRegistrationRequest registrationRequest) {
        try {
            User user = dataStore.getUserDao().getByUsername(username).orElseThrow();

            UserProfile userProfile =
                    userAuthenticationModule
                            .getAuthSources()
                            .get(new AuthModuleKey(user.getRealm(), user.getUserType()))
                            .getUserProfile(username);

            // Renew user certificate if expired with same private key
            if (!user.getCertificate().getNotAfter().after(new Date())) {
                user = UserAuthenticationModule.certificateAuthority.getRefreshedCertificate(user);
                datastore.updateUserCertificate(user);
            }

            Device device = new Device();
            device.setCertificationRequest(registrationRequest.getCsr());
            device.setOwner(username);
            device.setDisplayName(registrationRequest.getDeviceName());
            device = certificateAuthority.getSignedCertificate(user, device);
            if (device == null) {
                log.error("An error occurred while creating the device certificate.");
                return null;
            }
            device.setDeviceId(DeviceReceiptGenerator.generateDeviceId(device));
            dataStore.getDeviceDao().storeObject(device);

            DeviceRegistrationResponse response = new DeviceRegistrationResponse();
            String policyData = getPolicyData(username);
            if (policyData != null) {
                response.setPolicyData(policyData);
            }

            // Device receipt
            String[] devReceipt =
                    DeviceReceiptGenerator.generateReceipt(
                            user.getPrivateKey(),
                            user.getCertificate().getPublicKey(),
                            device.getCertificate().getPublicKey(),
                            user.getEthAddress());
            response.setDeviceReceipt(devReceipt[0]);
            response.setReceiptSignature(devReceipt[1]);
            String firstDisplayName =
                    userProfile.getFirstName() != null ? userProfile.getFirstName() : "";
            String lastDisplayName =
                    userProfile.getLastName() != null ? userProfile.getLastName() : "";
            response.setDisplayName(firstDisplayName + " " + lastDisplayName);

            response.setNameServer(nameServer.getURI());
            if (userProfile.getProfilePicture() != null)
                response.setUserPhoto(userProfile.getProfilePicture());
            // Chain certificate
            response.setCertificateChain(
                    new X509Certificate[] {
                        certificateAuthority.getCA(), user.getCertificate(), device.getCertificate()
                    });
            return response;
        } catch (Exception e) {
            log.error("An error occurred while enrolling the device.");
            e.printStackTrace();
            return null;
        }
    }

    public static String getPolicyData(String username) {
        String policy =
                dataStore
                        .getPolicyDao()
                        .getByUsername(username)
                        .map(p -> p.getPolicyData())
                        .orElse(null);
        if (policy == null) {
            log.warn("No policy available for user - not adding a policy component to response");
        }

        return policy;
    }
}
