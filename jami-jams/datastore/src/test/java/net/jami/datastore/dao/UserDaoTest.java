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
package net.jami.datastore.dao;

import net.jami.datastore.main.DataStore;
import net.jami.jams.common.authentication.AuthenticationSourceType;
import net.jami.jams.common.dao.connectivity.SQLConnection;
import net.jami.jams.common.objects.user.AccessLevel;
import net.jami.jams.common.objects.user.User;
import net.jami.jams.common.utils.X509Utils;

import org.bouncycastle.util.encoders.Hex;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

class UserDaoTest {
    private static UserDao userDao;
    private static User user;
    private static String generatedCertificate;
    private static String strPrivateKey;
    private static String refreshedCertificate;

    @BeforeAll
    static void setUp() throws Exception {
        DataStore dataStore = new DataStore("jdbc:derby:memory:testdb;create=true");
        SQLConnection connection = DataStore.connectionPool.getConnection();
        Assertions.assertNotNull(connection);

        userDao = new UserDao();
        Assertions.assertNotNull(userDao);

        InputStream path;
        ClassLoader classLoader = Thread.currentThread().getContextClassLoader();
        path = classLoader.getResourceAsStream("cakey.txt");
        strPrivateKey = new String(path.readAllBytes());
        path = classLoader.getResourceAsStream("cert_a.crt");
        generatedCertificate = new String(path.readAllBytes());
        path = classLoader.getResourceAsStream("cert_b.crt");
        refreshedCertificate = new String(path.readAllBytes());

        user = createMockUser();
    }

    private static User createMockUser() {
        SecureRandom random = new SecureRandom();
        byte[] salt = new byte[16];
        random.nextBytes(salt);

        User user = new User();
        user.setUsername("test");
        user.setPassword(hashPassword("abc123", salt));
        user.setUserType(AuthenticationSourceType.LOCAL);
        user.setRealm("test");
        user.setAccessLevel(AccessLevel.USER);
        user.setSalt(Base64.getEncoder().encodeToString(salt));
        user.setCertificate(X509Utils.getCertificateFromPEMString(generatedCertificate));
        user.setPrivateKey(X509Utils.getKeyFromPEMString(strPrivateKey));
        user.setJamiId("test");
        user.setEthAddress("test");
        user.setEthKey("test");

        return user;
    }

    public static String hashPassword(String password, byte[] salt) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update(salt);
            byte[] hash = digest.digest(password.getBytes(StandardCharsets.UTF_8));
            return new String(Hex.encode(hash));
        } catch (Exception e) {
            return null;
        }
    }

    @Test
    void getAll() throws Exception {
        Assertions.assertFalse(userDao.getAll().isEmpty());
    }

    @Test
    void getByUsernameExistent() throws Exception {
        userDao.storeObject(user);
        Assertions.assertFalse(userDao.getByUsername("test").isEmpty());
    }

    @Test
    void getByUsernameNonExistent() throws Exception {
        userDao.storeObject(user);
        Assertions.assertTrue(userDao.getByUsername("test2").isEmpty());
    }

    @Test
    void getByJamiId() throws Exception {
        userDao.storeObject(user);
        Assertions.assertFalse(userDao.getByJamiId("test").isEmpty());
    }

    @Test
    void updateUserCertificate() throws Exception {
        User user = createMockUser();

        UserDao userDAO = new UserDao();
        userDAO.storeObject(user);

        User user1 = userDAO.getByUsername("test").orElseThrow();
        Assertions.assertNotNull(user1);
        Assertions.assertEquals(user1.getAccessLevel(), AccessLevel.USER);

        userDAO.updateUserCertificate("test", refreshedCertificate);

        User user2 = userDAO.getByUsername("test").orElseThrow();
        Assertions.assertNotEquals(user1.getCertificate(), user2.getCertificate());
    }

    @Test
    void updatePassword() throws Exception {
        userDao.storeObject(user);
        Assertions.assertTrue(userDao.updateObject("newPassword", "test"));
    }

    @Test
    void updatePasswordWithSalt() throws Exception {
        userDao.storeObject(user);
        Assertions.assertTrue(userDao.updateObject("newPassword", user.getSalt(), "test"));
    }
}
