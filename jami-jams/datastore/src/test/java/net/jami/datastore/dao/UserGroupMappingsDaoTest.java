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
import net.jami.jams.common.objects.user.UserGroupMapping;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

class UserGroupMappingsDaoTest {
    private static UserGroupMappingsDao ugmDao;
    private static UserGroupMapping ugm;

    @BeforeAll
    static void setUp() {
        DataStore dataStore = new DataStore("jdbc:derby:memory:testdb;create=true");
        SQLConnection connection = DataStore.connectionPool.getConnection();
        Assertions.assertNotNull(connection);

        ugmDao = new UserGroupMappingsDao();
        Assertions.assertNotNull(ugmDao);

        ugm = new UserGroupMapping();
        ugm.setUsername("test");
        ugm.setGroupId("test");
    }

    @Test
    void getByGroupId() {
        ugmDao.storeObject(ugm);
        Assertions.assertFalse(ugmDao.getByGroupId("test").isEmpty());
    }

    @Test
    void getByUsername() {
        ugmDao.storeObject(ugm);
        Assertions.assertFalse(ugmDao.getByUsername("test").isEmpty());
    }

    @Test
    void getByGroupIdAndUsername() {
        ugmDao.storeObject(ugm);
        Assertions.assertFalse(ugmDao.getByGroupIdAndUsername("test", "test").isEmpty());
    }

    @Test
    void deleteObject() {
        ugmDao.storeObject(ugm);
        Assertions.assertTrue(ugmDao.deleteObject("test", "test"));
    }
}
