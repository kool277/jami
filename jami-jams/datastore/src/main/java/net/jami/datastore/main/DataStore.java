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
package net.jami.datastore.main;

import lombok.Getter;
import lombok.Setter;

import net.jami.datastore.dao.ContactDao;
import net.jami.datastore.dao.ConversationDao;
import net.jami.datastore.dao.ConversationRequestDao;
import net.jami.datastore.dao.DeviceDao;
import net.jami.datastore.dao.GroupDao;
import net.jami.datastore.dao.PolicyDao;
import net.jami.datastore.dao.SystemDao;
import net.jami.datastore.dao.UserDao;
import net.jami.datastore.dao.UserGroupMappingsDao;
import net.jami.datastore.dao.UserProfileDao;
import net.jami.jams.common.authentication.AuthenticationSource;
import net.jami.jams.common.authentication.AuthenticationSourceInfo;
import net.jami.jams.common.authentication.AuthenticationSourceType;
import net.jami.jams.common.dao.connectivity.ConnectionPool;
import net.jami.jams.common.objects.user.User;
import net.jami.jams.common.objects.user.UserProfile;
import net.jami.jams.common.utils.X509Utils;

import org.flywaydb.core.Flyway;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Getter
@Setter
public class DataStore implements AuthenticationSource {

    public static ConnectionPool connectionPool;
    private UserDao userDao;
    private GroupDao groupDao;
    private PolicyDao policyDao;
    private DeviceDao deviceDao;
    private SystemDao systemDao;
    private ContactDao contactDao;
    private ConversationDao conversationDao;
    private ConversationRequestDao conversationRequestDao;
    private UserProfileDao userProfileDao;
    private UserGroupMappingsDao userGroupMappingsDao;
    public static final Integer RESULTS_PER_PAGE = 24;
    public static Integer NUM_PAGES;

    // Implicitly connect to derby.
    public DataStore(String connectionString) {
        Flyway flyway = Flyway.configure().dataSource(connectionString, "", "").load();
        flyway.migrate();
        connectionPool = new ConnectionPool(connectionString);
        userDao = new UserDao();
        groupDao = new GroupDao();
        policyDao = new PolicyDao();
        deviceDao = new DeviceDao();
        systemDao = new SystemDao();
        contactDao = new ContactDao();
        conversationDao = new ConversationDao();
        conversationRequestDao = new ConversationRequestDao();
        userProfileDao = new UserProfileDao();
        userGroupMappingsDao = new UserGroupMappingsDao();
    }

    @Override
    public boolean createUser(User user) {
        return userDao.storeObject(user);
    }

    @Override
    public List<UserProfile> searchUserProfiles(
            String queryString, String field, Optional<Integer> page) {
        List<UserProfile> userList;

        if (queryString.equals("*")) {
            userList = userProfileDao.getAllUserProfile();
        } else {
            if (field.equals("LOGON_NAME")) {
                userList = userProfileDao.searchUsername(queryString);
            } else if (field.equals("FULL_TEXT_NAME")) {
                userList = userProfileDao.searchFullName(queryString);
            } else {
                throw new IllegalArgumentException("Invalid field");
            }
        }

        if (userList == null) userList = new ArrayList<>();

        NUM_PAGES = (Integer) userList.size() / RESULTS_PER_PAGE;
        if (userList.size() % RESULTS_PER_PAGE != 0) NUM_PAGES++;

        if (page.isPresent() && !userList.isEmpty()) {
            if (userList.size() < RESULTS_PER_PAGE) userList = userList.subList(0, userList.size());
            else if (page.get() * RESULTS_PER_PAGE > userList.size())
                userList = userList.subList((page.get() - 1) * RESULTS_PER_PAGE, userList.size());
            else
                userList =
                        userList.subList(
                                (page.get() - 1) * RESULTS_PER_PAGE,
                                (page.get() * RESULTS_PER_PAGE));
        }

        return userList;
    }

    @Override
    public UserProfile getUserProfile(String username) {
        return userProfileDao.getByUsername(username).orElse(null);
    }

    @Override
    public boolean setUserProfile(UserProfile userProfile) {
        return userProfileDao.storeObject(userProfile);
    }

    public boolean updateUserProfile(UserProfile userProfile) {
        return userProfileDao.updateUserProfile(userProfile);
    }

    public boolean updateUserCertificate(User user) {
        return userDao.updateUserCertificate(
                user.getUsername(), X509Utils.getPEMStringFromCertificate(user.getCertificate()));
    }

    @Override
    public boolean authenticate(String username, String password) {
        return userDao.getByUsername(username)
                .map(user -> user.getPassword())
                .orElse("")
                .equals(password);
    }

    @Override
    public AuthenticationSourceInfo getInfo() {
        return new AuthenticationSourceInfo("LOCAL", AuthenticationSourceType.LOCAL);
    }

    @Override
    public boolean test() {
        return true;
    }

    @Override
    public boolean updatePassword(User user, String password) {
        return false;
    }
}
