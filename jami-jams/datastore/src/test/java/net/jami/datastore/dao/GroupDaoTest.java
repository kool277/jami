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
import net.jami.jams.common.objects.user.Group;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

class GroupDaoTest {
    private static GroupDao groupDao;
    private static Group group;

    @BeforeAll
    static void setUp() {
        DataStore dataStore = new DataStore("jdbc:derby:memory:testdb;create=true");
        SQLConnection connection = DataStore.connectionPool.getConnection();
        Assertions.assertNotNull(connection);

        groupDao = new GroupDao();
        Assertions.assertNotNull(groupDao);

        group = new Group();
        group.setId("test");
        group.setName("test");
        group.setBlueprint("test");
    }

    @Test
    void getAll() throws Exception {
        groupDao.storeObject(group);
        Assertions.assertFalse(groupDao.getAll().isEmpty());
    }

    @Test
    void getById() throws Exception {
        groupDao.storeObject(group);
        Assertions.assertFalse(groupDao.getById("test").isEmpty());
    }

    @Test
    void updateObject() throws Exception {
        groupDao.storeObject(group);
        Assertions.assertTrue(groupDao.updateObject("test", "name", "blueprint"));
    }

    @Test
    void deleteObject() throws Exception {
        groupDao.storeObject(group);
        Assertions.assertTrue(groupDao.deleteObject("test"));
    }
}
