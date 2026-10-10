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
package net.jami.jams.ad.connector;

import static org.junit.jupiter.api.Assertions.*;

import com.google.gson.Gson;

import net.jami.datastore.main.DataStore;
import net.jami.jams.common.authentication.activedirectory.ActiveDirectorySettings;
import net.jami.jams.common.objects.user.UserProfile;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class ADConnectorTest {
    private ADConnector adConnector;

    @BeforeEach
    void setUp() {
        Gson gson = new Gson();
        DataStore dataStore = new DataStore("jdbc:derby:memory:testdb;create=true");
        ActiveDirectorySettings activeDirectorySettings = new ActiveDirectorySettings();
        String settings = gson.toJson(activeDirectorySettings);
        adConnector = new ADConnector(settings, dataStore);
    }

    @Test
    void testGetUserProfile() {
        UserProfile userProfile = adConnector.getUserProfile("jdoe");
        assertNull(userProfile);
    }
}
