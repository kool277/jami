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
import net.jami.jams.common.objects.devices.Device;
import net.jami.jams.common.utils.X509Utils;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.io.InputStream;

class DeviceDaoTest {
    private static DeviceDao deviceDao;
    private static Device device;
    private static String strPrivateKey;
    private static String strCertificate;

    @BeforeAll
    static void setUp() throws Exception {
        DataStore dataStore = new DataStore("jdbc:derby:memory:testdb;create=true");
        SQLConnection connection = DataStore.connectionPool.getConnection();
        Assertions.assertNotNull(connection);

        deviceDao = new DeviceDao();
        Assertions.assertNotNull(deviceDao);

        InputStream path;
        ClassLoader classLoader = Thread.currentThread().getContextClassLoader();
        path = classLoader.getResourceAsStream("cakey.txt");
        strPrivateKey = new String(path.readAllBytes());
        path = classLoader.getResourceAsStream("cacert.txt");
        strCertificate = new String(path.readAllBytes());

        device = new Device();
        device.setDeviceId("test");
        device.setOwner("test");
        device.setDisplayName("test");
        device.setCertificate(X509Utils.getCertificateFromPEMString(strCertificate));
        device.setPrivateKey(X509Utils.getKeyFromPEMString(strPrivateKey));
    }

    @Test
    void getByOwner() {
        deviceDao.storeObject(device);
        Assertions.assertFalse(deviceDao.getByOwner("test").isEmpty());
    }

    @Test
    void getByDeviceIdAndOwner() {
        deviceDao.storeObject(device);
        Assertions.assertFalse(deviceDao.getByDeviceIdAndOwner("test", "test").isEmpty());
    }

    @Test
    void updateObject() {
        deviceDao.storeObject(device);
        Assertions.assertTrue(deviceDao.updateObject("test", "test", "test"));
    }
}
