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
package net.jami.jams.dht;

/*
 *  Copyright (c) 2019 Savoir-faire Linux Inc.
 *
 *  Author: Felix Sidokhine <felix.sidokhined@savoirfairelinux.com>
 *
 *  This program is free software; you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation; either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import lombok.extern.slf4j.Slf4j;

import net.jami.jams.common.objects.devices.Device;
import net.jami.jams.common.objects.user.User;

import org.apache.commons.codec.binary.Base64;
import org.apache.commons.codec.binary.Hex;
import org.apache.commons.codec.digest.MessageDigestAlgorithms;
import org.msgpack.core.MessageBufferPacker;
import org.msgpack.core.MessagePack;

import java.io.IOException;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.Signature;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.stream.Collectors;

@Slf4j
public class DeviceReceiptGenerator {

    private static void packToSign(
            MessageBufferPacker messagePack,
            PublicKey publicKey,
            byte[] deviceId,
            byte[] devicePubKeyEncoded)
            throws IOException {
        byte[] owner = publicKey.getEncoded();
        messagePack.packMapHeader(4);
        messagePack.packString("seq");
        messagePack.packInt(0);
        messagePack.packString("owner");
        messagePack.packBinaryHeader(owner.length);
        messagePack.addPayload(owner);
        messagePack.packString("type");
        messagePack.packInt(0);
        messagePack.packString("data");
        // Inner message building.
        MessageBufferPacker innerMessagePack = MessagePack.newDefaultBufferPacker();
        innerMessagePack.packMapHeader(2);
        innerMessagePack.packString("dev");
        innerMessagePack.packBinaryHeader(deviceId.length);
        innerMessagePack.addPayload(deviceId);
        innerMessagePack.packString("pk");
        innerMessagePack.packBinaryHeader(devicePubKeyEncoded.length);
        innerMessagePack.addPayload(devicePubKeyEncoded);
        // Append the inner to the messagePack
        messagePack.packBinaryHeader(innerMessagePack.toByteArray().length);
        messagePack.addPayload(innerMessagePack.toByteArray());
    }

    private static byte[] generateAnnoucement(
            PrivateKey privateKey, PublicKey publicKey, PublicKey devicePubKey) {
        try {
            MessageBufferPacker outerMessagePack = MessagePack.newDefaultBufferPacker();
            MessageBufferPacker messagePack = MessagePack.newDefaultBufferPacker();
            MessageDigest digest = MessageDigest.getInstance(MessageDigestAlgorithms.SHA_1);
            byte[] devicePubKeyEncoded = devicePubKey.getEncoded();
            byte[] deviceId = digest.digest(devicePubKeyEncoded);
            packToSign(messagePack, publicKey, deviceId, devicePubKeyEncoded);

            // Sign the message pack object using SHA-512 digest.
            Signature signer = Signature.getInstance("SHA512withRSA");
            signer.initSign(privateKey);
            signer.update(messagePack.toByteArray());
            byte[] signature = signer.sign();

            // Build the outer enveloper.
            outerMessagePack.packMapHeader(2);
            outerMessagePack.packString("id");
            outerMessagePack.packInt(0);
            outerMessagePack.packString("dat");
            outerMessagePack.packMapHeader(2);
            outerMessagePack.packString("body");
            packToSign(outerMessagePack, publicKey, deviceId, devicePubKeyEncoded);
            outerMessagePack.packString("sig");
            outerMessagePack.packBinaryHeader(signature.length);
            outerMessagePack.addPayload(signature);

            return outerMessagePack.toByteArray();
        } catch (Exception e) {
            log.error("An error occurred while building the device receipt.");
            return null;
        }
    }

    public static String[] generateReceipt(
            PrivateKey privateKey, PublicKey publicKey, PublicKey devicePubKey, String ethAddress) {
        try {
            HashMap<String, String> receipt =
                    new LinkedHashMap<String, String>() {
                        @Override
                        public String toString() {
                            return "{"
                                    + entrySet().stream()
                                            .map(
                                                    x ->
                                                            "\""
                                                                    + x.getKey()
                                                                    + "\":\""
                                                                    + x.getValue()
                                                                    + "\"")
                                            .collect(Collectors.joining(","))
                                    + "}";
                        }
                    };
            MessageDigest digest = MessageDigest.getInstance(MessageDigestAlgorithms.SHA_1);
            receipt.put("id", Hex.encodeHexString(digest.digest(publicKey.getEncoded())));
            receipt.put("dev", Hex.encodeHexString(digest.digest(devicePubKey.getEncoded())));
            receipt.put("eth", ethAddress);
            receipt.put(
                    "announce",
                    Base64.encodeBase64String(
                            generateAnnoucement(privateKey, publicKey, devicePubKey)));
            Signature signer = Signature.getInstance("SHA512withRSA");
            signer.initSign(privateKey);
            signer.update(receipt.toString().getBytes());
            byte[] signature = signer.sign();
            return new String[] {
                receipt.toString(), java.util.Base64.getEncoder().encodeToString(signature)
            };
        } catch (Exception e) {
            log.error("Unable to build generate device receipt!");
            return null;
        }
    }

    public static String generateJamiId(User user) {
        try {
            return Hex.encodeHexString(
                    MessageDigest.getInstance(MessageDigestAlgorithms.SHA_1)
                            .digest(user.getCertificate().getPublicKey().getEncoded()));
        } catch (Exception e) {
            log.error("Unable to generate JamiId with error " + e);
            return null;
        }
    }

    public static String generateDeviceId(Device device) {
        try {
            return Hex.encodeHexString(
                    MessageDigest.getInstance(MessageDigestAlgorithms.SHA_256)
                            .digest(device.getCertificate().getPublicKey().getEncoded()));
        } catch (Exception e) {
            log.error("Unable to generate deviceId with error " + e);
            return null;
        }
    }
}
