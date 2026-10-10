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
package net.jami.jams.server.core.jaminamserver;

import net.jami.jams.common.jami.NameLookupResponse;
import net.jami.jams.common.jami.NameRegistrationRequest;
import net.jami.jams.common.jami.NameServer;
import net.jami.jams.nameserver.PublicNameServer;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.UUID;

class PublicNameServerTest {

    private static NameServer nameServer;

    @BeforeAll
    public static void init() {
        nameServer = new PublicNameServer("https://ns-test.jami.net");
    }

    @Test
    public void testNameRegistration() {
        NameRegistrationRequest nameRegistrationRequest = new NameRegistrationRequest();
        nameRegistrationRequest.setAddr(
                "abcdef0123"
                        + UUID.randomUUID()
                                .toString()
                                .replace("-", "")); // 40 characters long: 8 fixed + 32 random
        nameRegistrationRequest.setOwner("abcdef0123456789abcdef0123456789abcdef02");
        nameRegistrationRequest.setSignature("");
        nameRegistrationRequest.setPublickey("");
        String name = UUID.randomUUID().toString().replace("-", "");
        Integer res = nameServer.registerName(name, nameRegistrationRequest);
        Assertions.assertEquals(200, res, "The response should have been 200!");
    }

    @Test
    public void testNameLookUp() {
        NameLookupResponse resp = nameServer.getAddressFromName("abcdefabcdef");
        Assertions.assertNotNull(resp, "The response should exist!");
    }

    @Test
    public void testAddrLookUp() {
        String addr = nameServer.getNameFromAddress("abcdef0123456789abcdef0123456789abcdef02");
        Assertions.assertNotNull(addr, "The address should exist!");
    }
}
