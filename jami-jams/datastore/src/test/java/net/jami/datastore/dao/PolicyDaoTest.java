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
import net.jami.jams.common.objects.user.Policy;
import net.jami.jams.common.objects.user.UserGroupMapping;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

class PolicyDaoTest {
    private static PolicyDao policyDao;
    private static Policy policy;

    @BeforeAll
    static void setUp() {
        DataStore dataStore = new DataStore("jdbc:derby:memory:testdb;create=true");
        SQLConnection connection = DataStore.connectionPool.getConnection();
        Assertions.assertNotNull(connection);

        policyDao = new PolicyDao();
        Assertions.assertNotNull(policyDao);

        policy = new Policy();
        policy.setName("test");
        policy.setPolicyData("test");
    }

    @Test
    void getAll() {
        policyDao.storeObject(policy);
        Assertions.assertFalse(policyDao.getAll().isEmpty());
    }

    @Test
    void getByName() {
        policyDao.storeObject(policy);
        Assertions.assertFalse(policyDao.getByName("test").isEmpty());
    }

    @Test
    void getByUsername() {
        UserGroupMappingsDao ugmDao = new UserGroupMappingsDao();
        UserGroupMapping ugm = new UserGroupMapping();
        ugm.setUsername("test");
        ugm.setGroupId("test");
        ugmDao.storeObject(ugm);

        GroupDao groupDao = new GroupDao();
        Group group = new Group();
        group.setId("test");
        group.setName("test");
        group.setBlueprint("test");
        groupDao.storeObject(group);

        policyDao.storeObject(policy);
        Assertions.assertFalse(policyDao.getByUsername("test").isEmpty());
    }

    @Test
    void updateObject() {
        policyDao.storeObject(policy);
        Assertions.assertTrue(policyDao.updateObject("test", "test"));
    }

    @Test
    void deleteObject() {
        policyDao.storeObject(policy);
        Assertions.assertTrue(policyDao.deleteObject("test"));
    }
}
