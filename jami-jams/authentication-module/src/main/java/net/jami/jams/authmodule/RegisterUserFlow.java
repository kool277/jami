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

import static net.jami.jams.authmodule.UserAuthenticationModule.certificateAuthority;
import static net.jami.jams.authmodule.UserAuthenticationModule.datastore;

import lombok.extern.slf4j.Slf4j;

import net.jami.jams.common.jami.NameRegistrationRequest;
import net.jami.jams.common.jami.NameServer;
import net.jami.jams.common.objects.roots.X509Fields;
import net.jami.jams.common.objects.user.User;
import net.jami.jams.common.utils.X509Utils;
import net.jami.jams.dht.DeviceReceiptGenerator;
import net.jami.jams.dht.ETHAddressGenerator;

import java.nio.charset.StandardCharsets;
import java.security.PublicKey;
import java.security.Signature;

@Slf4j
public class RegisterUserFlow {

    // Get the CA, sign, return the Jami ID.
    public static boolean createUser(User user, NameServer nameServer) {
        // This generates the X509 Fields we need.
        user.setX509Fields(new X509Fields());
        user.getX509Fields().setCommonName(user.getUsername());
        user = certificateAuthority.getSignedCertificate(user);
        String[] ethKeyPair = null;
        try {
            ethKeyPair = ETHAddressGenerator.generateAddress();
        } catch (Exception e) {
            log.error("Failed to generate an Ethereum key pair for the user " + user.getUsername());
            e.printStackTrace();
            return false;
        }
        user.setEthAddress(ethKeyPair[0]);
        user.setEthKey(ethKeyPair[1]);
        user.setJamiId(DeviceReceiptGenerator.generateJamiId(user));
        // Didn't exactly plan on this happening here, but this is the only place we actually need
        // it.
        // Given an interface of NameServer, we need to enroll the user or decline the enrollment
        // before
        // storing him
        NameRegistrationRequest nameRegistrationRequest = new NameRegistrationRequest();
        nameRegistrationRequest.setOwner(ethKeyPair[0]);
        nameRegistrationRequest.setAddr(user.getJamiId());
        PublicKey publicKeyPem = user.getCertificate().getPublicKey();
        String publicKeyStr = X509Utils.getPEMStringFromPubKey(publicKeyPem);
        String encodedPublicKey =
                java.util.Base64.getEncoder()
                        .encodeToString(publicKeyStr.getBytes(StandardCharsets.UTF_8));
        nameRegistrationRequest.setPublickey(encodedPublicKey);
        try {
            Signature signature = Signature.getInstance("SHA512withRSA");
            signature.initSign(user.getPrivateKey());
            signature.update(user.getUsername().getBytes());
            byte[] signedBytes = signature.sign();
            String signatureBase64 = java.util.Base64.getEncoder().encodeToString(signedBytes);
            nameRegistrationRequest.setSignature(signatureBase64);
        } catch (Exception e) {
            log.error("Failed to sign the username for user " + user.getUsername(), e);
            return false;
        }

        if (nameServer != null
                && nameServer.registerName(user.getUsername(), nameRegistrationRequest) != 200) {
            log.error(
                    "Failed to register the user " + user.getUsername() + " with the name server.");
            return false;
        }
        datastore.getUserDao().storeObject(user);
        log.info("Created the user " + user.getUsername() + " because he did not exist before!");
        return true;
    }
}
