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
package net.jami.jams.ldap.connector;

import com.google.gson.Gson;

import lombok.extern.slf4j.Slf4j;

import net.jami.datastore.main.DataStore;
import net.jami.jams.common.authentication.AuthenticationSource;
import net.jami.jams.common.authentication.AuthenticationSourceInfo;
import net.jami.jams.common.authentication.AuthenticationSourceType;
import net.jami.jams.common.authentication.ldap.LDAPSettings;
import net.jami.jams.common.objects.user.User;
import net.jami.jams.common.objects.user.UserProfile;
import net.jami.jams.common.serialization.adapters.GsonFactory;
import net.jami.jams.ldap.connector.service.AuthenticationService;
import net.jami.jams.ldap.connector.service.UserProfileService;

import org.ldaptive.BindConnectionInitializer;
import org.ldaptive.ConnectionConfig;
import org.ldaptive.Credential;
import org.ldaptive.DefaultConnectionFactory;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Slf4j
public class LDAPConnector implements AuthenticationSource {

    private final AuthenticationService authenticationService;
    private final UserProfileService userProfileService;
    public static LDAPSettings settings;
    private DataStore dataStore;

    public LDAPConnector(String strSettings, DataStore dataStore) {
        Gson gson = GsonFactory.createGson();
        LDAPConnector.settings = gson.fromJson(strSettings, LDAPSettings.class);
        BindConnectionInitializer bindConnectionInitializer = new BindConnectionInitializer();
        bindConnectionInitializer.setBindDn(settings.getUsername());
        bindConnectionInitializer.setBindCredential(new Credential(settings.getPassword()));
        ConnectionConfig connConfig =
                ConnectionConfig.builder()
                        .url(settings.getHost())
                        .useStartTLS(settings.getUseStartTLS())
                        .connectionInitializers(bindConnectionInitializer)
                        .build();
        authenticationService = new AuthenticationService(new DefaultConnectionFactory(connConfig));
        this.dataStore = dataStore;
        userProfileService =
                new UserProfileService(dataStore, new DefaultConnectionFactory(connConfig));
        // Configure scheduler to revoke users
        ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
        Runnable synchronizationTask = userProfileService::synchronizeUsersWithLDAP;
        long initialDelay = 1;
        long period = 1;

        // Schedule the task
        scheduler.scheduleAtFixedRate(synchronizationTask, initialDelay, period, TimeUnit.MINUTES);
        log.info("Started LDAP Connector!");
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
        // does nothing since we are unable to edit LDAP profiles.
        return false;
    }

    @Override
    public boolean authenticate(String username, String password) {
        return authenticationService.authenticateUser(username, password);
    }

    @Override
    public AuthenticationSourceInfo getInfo() {
        return new AuthenticationSourceInfo(settings.getRealm(), AuthenticationSourceType.LDAP);
    }

    @Override
    public boolean test() {
        return (searchUserProfiles("*", "LOGON_NAME", Optional.empty()).size() != 0);
    }

    @Override
    public boolean updatePassword(User user, String password) {
        return false;
    }
}
