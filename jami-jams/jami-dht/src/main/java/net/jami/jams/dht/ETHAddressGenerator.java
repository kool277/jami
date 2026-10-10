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
import net.jami.jams.dht.hashutils.HexBin;
import net.jami.jams.dht.hashutils.Keccak256;

import org.apache.commons.codec.binary.Hex;
import org.bouncycastle.jce.provider.BouncyCastleProvider;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Security;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;

public class ETHAddressGenerator {
    static {
        Security.addProvider(new BouncyCastleProvider());
    }

    public static String[] generateAddress() throws Exception {
        KeyPairGenerator keyGen = KeyPairGenerator.getInstance("EC", "BC");
        keyGen.initialize(new ECGenParameterSpec("secp256k1"));
        // Generate the Public and Private Keys
        KeyPair pair = keyGen.generateKeyPair();
        ECPrivateKey ecpriv = (ECPrivateKey) pair.getPrivate();
        ECPublicKey ecpub = (ECPublicKey) pair.getPublic();

        // Get the hex representations we need.
        String hexPubKey =
                ecpub.getW().getAffineX().toString(16) + ecpub.getW().getAffineY().toString(16);
        String hexPrvKey = ecpriv.getS().toString(16);

        // In ethereum the private key is just 0x + private key, so nothing to do here.
        Keccak256 keccak256 = new Keccak256();
        byte[] addressData = keccak256.digest(HexBin.decode(hexPubKey));
        String address = Hex.encodeHexString(addressData);
        address = "0x" + address.substring(24);
        // Return the address and the private key - we just store them for now.
        return new String[] {address, hexPrvKey};
    }
}
