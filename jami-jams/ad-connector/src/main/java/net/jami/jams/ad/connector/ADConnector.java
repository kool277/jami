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

import com.google.gson.Gson;
import com.imperva.ddc.core.query.Endpoint;

import lombok.extern.slf4j.Slf4j;

import net.jami.datastore.main.DataStore;
import net.jami.jams.ad.connector.service.AuthenticationService;
import net.jami.jams.ad.connector.service.UserProfileService;
import net.jami.jams.common.authentication.AuthenticationSource;
import net.jami.jams.common.authentication.AuthenticationSourceInfo;
import net.jami.jams.common.authentication.AuthenticationSourceType;
import net.jami.jams.common.authentication.activedirectory.ActiveDirectorySettings;
import net.jami.jams.common.objects.user.User;
import net.jami.jams.common.objects.user.UserProfile;
import net.jami.jams.common.serialization.adapters.GsonFactory;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Slf4j
public class ADConnector implements AuthenticationSource {

    private static final ConcurrentLinkedQueue<Endpoint> endpoints = new ConcurrentLinkedQueue<>();
    public static ActiveDirectorySettings settings;
    private final AuthenticationService authenticationService = new AuthenticationService();
    private final UserProfileService userProfileService;
    private DataStore dataStore;

    public ADConnector(String settings, DataStore dataStore) {
        Gson gson = GsonFactory.createGson();
        ADConnector.settings = gson.fromJson(settings, ActiveDirectorySettings.class);
        for (int i = 0; i < 10; i++) {
            Endpoint endpoint = new Endpoint();
            endpoint.setSecuredConnection(ADConnector.settings.getIsSSL());
            endpoint.setPort(ADConnector.settings.getPort());
            endpoint.setHost(ADConnector.settings.getHost());
            endpoints.add(endpoint);
        }
        this.dataStore = dataStore;
        userProfileService = new UserProfileService(dataStore);
        // Configure scheduler to revoke users
        ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
        Runnable synchronizationTask = userProfileService::synchronizeUsersWithAD;
        long initialDelay = 1;
        long period = 1;

        // Schedule the task
        scheduler.scheduleAtFixedRate(synchronizationTask, initialDelay, period, TimeUnit.MINUTES);
        log.info("Started Active Directory Connector!");
    }

    public static Endpoint getConnection() {
        Endpoint endpoint = null;
        while (endpoint == null) {
            endpoint = endpoints.poll();
        }
        endpoint.setUserAccountName(
                ADConnector.settings.getRealm()
                        + "\\"
                        + settings.getUsername()); // * You can use the user's Distinguished Name as
        // well
        endpoint.setPassword(settings.getPassword());
        return endpoint;
    }

    public static Endpoint getConnection(String username, String password) {
        Endpoint endpoint = null;
        while (endpoint == null) {
            endpoint = endpoints.poll();
        }
        endpoint.setUserAccountName(
                ADConnector.settings.getRealm()
                        + "\\"
                        + username); // * You can use the user's Distinguished Name as well
        endpoint.setPassword(password);
        return endpoint;
    }

    public static void returnConnection(Endpoint connection) {
        connection.setUserAccountName(
                ADConnector.settings.getRealm() + "\\" + settings.getUsername());
        connection.setPassword(settings.getPassword());
        endpoints.add(connection);
    }

    @Override
    public boolean createUser(User user) {
        return false;
    }

    @Override
    public List<UserProfile> searchUserProfiles(
            String queryString, String field, Optional<Integer> page) {
        List<UserProfile> results =
                userProfileService.getUserProfile(queryString, field, false, page);
        // There is a possibility that the LDAP server is offline or inaccessible
        // In that case, we fallback to the local database
        if (results == null) {
            results = dataStore.searchUserProfiles(queryString, field, page);
        }

        return results;
    }

    @Override
    public UserProfile getUserProfile(String username) {
        List<UserProfile> results =
                userProfileService.getUserProfile(username, "LOGON_NAME", true, Optional.empty());
        if (results == null) {
            return dataStore.getUserProfile(username);
        }
        if (results.size() != 1) return null;
        return results.get(0);
    }

    @Override
    public boolean setUserProfile(UserProfile userProfile) {
        // does nothing as we are unable to edit user profiles.
        return false;
    }

    @Override
    public boolean authenticate(String username, String password) {
        try {
            return authenticationService.authenticateUser(username, password);
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public AuthenticationSourceInfo getInfo() {
        return new AuthenticationSourceInfo(settings.getRealm(), AuthenticationSourceType.AD);
    }

    @Override
    public boolean test() {
        return authenticate(settings.getUsername(), settings.getPassword());
    }

    @Override
    public boolean updatePassword(User user, String password) {
        return false;
    }
}
