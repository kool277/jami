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
import net.jami.jams.common.objects.system.SystemAccount;
import net.jami.jams.common.objects.system.SystemAccountType;
import net.jami.jams.common.utils.X509Utils;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.io.InputStream;

class SystemDaoTest {
    private static SystemDao systemDao;
    private static SystemAccount systemAccount;

    @BeforeAll
    static void setUp() throws Exception {
        DataStore dataStore = new DataStore("jdbc:derby:memory:testdb;create=true");
        SQLConnection connection = DataStore.connectionPool.getConnection();
        Assertions.assertNotNull(connection);

        systemDao = new SystemDao();
        Assertions.assertNotNull(systemDao);

        InputStream path;
        ClassLoader classLoader = Thread.currentThread().getContextClassLoader();
        path = classLoader.getResourceAsStream("cakey.txt");
        String strPrivateKey = new String(path.readAllBytes());
        path = classLoader.getResourceAsStream("cacert.txt");
        String strCertificate = new String(path.readAllBytes());

        systemAccount = new SystemAccount();
        systemAccount.setSystemAccountType(SystemAccountType.CA);
        systemAccount.setCertificate(X509Utils.getCertificateFromPEMString(strCertificate));
        systemAccount.setPrivateKey(X509Utils.getKeyFromPEMString(strPrivateKey));
    }

    @Test
    void getCA() {
        systemAccount.setSystemAccountType(SystemAccountType.CA);
        systemDao.storeObject(systemAccount);
        Assertions.assertFalse(systemDao.getCA().isEmpty());
    }

    @Test
    void getOCSP() {
        systemAccount.setSystemAccountType(SystemAccountType.OCSP);
        systemDao.storeObject(systemAccount);
        Assertions.assertFalse(systemDao.getOCSP().isEmpty());
    }
}
