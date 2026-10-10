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
import net.jami.jams.common.dao.connectivity.SQLConnection;
import net.jami.jams.common.objects.user.UserProfile;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

class UserProfileDaoTest {
    private static UserProfileDao userProfileDao;
    private static UserProfile userProfile;

    @BeforeAll
    static void setUp() {
        DataStore dataStore = new DataStore("jdbc:derby:memory:testdb;create=true");
        SQLConnection connection = DataStore.connectionPool.getConnection();
        Assertions.assertNotNull(connection);

        userProfileDao = new UserProfileDao();
        Assertions.assertNotNull(userProfileDao);

        userProfile = new UserProfile();
        userProfile.setUsername("test");
        userProfile.setFirstName("test");
        userProfile.setLastName("test");
        userProfile.setEmail("test");
        userProfile.setProfilePicture("test");
        userProfile.setOrganization("test");
        userProfile.setPhoneNumber("test");
        userProfile.setPhoneNumberExtension("test");
        userProfile.setFaxNumber("test");
        userProfile.setMobileNumber("test");
        userProfile.setId("test");
    }

    @Test
    void storeObject() {
        Assertions.assertTrue(userProfileDao.storeObject(userProfile));
    }

    @Test
    void getAll() {
        userProfileDao.storeObject(userProfile);
        Assertions.assertFalse(userProfileDao.getAllUserProfile().isEmpty());
    }

    @Test
    void searchUsername() {
        userProfileDao.storeObject(userProfile);
        Assertions.assertFalse(userProfileDao.searchUsername("test").isEmpty());
    }

    @Test
    void searchFullName() {
        userProfileDao.storeObject(userProfile);
        Assertions.assertFalse(userProfileDao.searchFullName("test").isEmpty());
    }

    @Test
    void getByUsername() {
        userProfileDao.storeObject(userProfile);
        Assertions.assertTrue(userProfileDao.getByUsername("test").isPresent());
    }

    @Test
    void updateUserProfile() throws Exception {
        userProfileDao.storeObject(userProfile);
        Assertions.assertTrue(userProfileDao.updateUserProfile(userProfile));
    }

    @Test
    void insertIfNotExists() throws Exception {
        userProfileDao.insertIfNotExists(userProfile);
        Assertions.assertTrue(userProfileDao.getByUsername("test").isPresent());
    }

    @Test
    void deleteUserProfile() throws Exception {
        userProfileDao.storeObject(userProfile);
        Assertions.assertTrue(userProfileDao.deleteUserProfile("test"));
    }
}
