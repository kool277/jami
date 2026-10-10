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
package net.jami.jams.ca.workers.csr.builders;

import lombok.extern.slf4j.Slf4j;

import net.jami.jams.ca.JamsCA;
import net.jami.jams.common.objects.user.User;

import org.bouncycastle.cert.jcajce.JcaX509CertificateHolder;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.security.cert.X509Certificate;

@Slf4j
class UserBuilderTest {

    @BeforeEach
    void setUp() {
        JamsCA jamsCA = SystemAccountBuilderTest.createMockJamsCA();
    }

    @AfterEach
    void tearDown() {
        File file = new File("jams.crl");
        if (file.exists()) {
            file.delete();
        }
    }

    @Test
    void generateUserCertificate() {
        User user = SystemAccountBuilderTest.createMockUser();
        user = UserBuilder.generateUser(user);

        Assertions.assertNotNull(user.getCertificate(), "User Certificate was not generated!");
    }

    @Test
    void refreshUserCertificate() {
        User user = SystemAccountBuilderTest.createMockUser();
        user.setUsername("test");
        Assertions.assertNotNull(user, "User was not generated!");

        X509Certificate cert = user.getCertificate();
        Assertions.assertNotNull(cert, "User Certificate was not generated!");

        User refreshedUser = UserBuilder.refreshUser(user, 465_000_000);
        Assertions.assertNotNull(refreshedUser, "User was not generated!");
        X509Certificate new_cert = refreshedUser.getCertificate();

        Assertions.assertArrayEquals(
                cert.getPublicKey().getEncoded(),
                new_cert.getPublicKey().getEncoded(),
                "PK is different");

        Assertions.assertNotNull(new_cert, "User Certificate was not updated!");
        Assertions.assertEquals(
                user.getAddress(), refreshedUser.getAddress(), "User address is different");

        Assertions.assertNotEquals(cert.getNotAfter(), new_cert.getNotAfter());
        try {
            Assertions.assertEquals(
                    new JcaX509CertificateHolder(cert).getSubjectPublicKeyInfo().getPublicKey(),
                    new JcaX509CertificateHolder(new_cert)
                            .getSubjectPublicKeyInfo()
                            .getPublicKey());
        } catch (Exception e) {
            log.error("Error comparing two public keys information: ", e.getMessage());
        }
    }
}
