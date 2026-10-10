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

import lombok.extern.slf4j.Slf4j;

import net.jami.jams.common.objects.user.User;

import java.util.List;
import java.util.Optional;

@Slf4j
public class UserDao extends AbstractDao<User> {

    public UserDao() {
        this.setTableName("users");
        this.setTClass(User.class);
    }

    public List<User> getAll() {
        return getObjectsFromResultSet("SELECT * FROM users");
    }

    public Optional<User> getByUsername(String username) {
        return getFirstObjectFromResultSet("SELECT * FROM users WHERE username = ?", username);
    }

    public List<User> getByJamiId(String jamiId) {
        return getObjectsFromResultSet("SELECT * FROM users WHERE jamiId = ?", jamiId);
    }

    @Override
    public boolean storeObject(User object) {
        String query =
                "INSERT INTO users "
                        + "(username, password, userType, realm, ethAddress, ethKey, jamiId, certificate, privatekey, accessLevel, needsPasswordReset, salt) "
                        + " VALUES "
                        + "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        return executeInsert(query, object);
    }

    public boolean updateUserCertificate(String username, String certificate) {
        String query = "UPDATE users SET certificate = ? WHERE username = ?";
        return executeUpdate(query, List.of(certificate, username));
    }

    public boolean updateObject(String password, String username) {
        String query =
                "UPDATE users SET password = ?, needsPasswordReset = 'true' WHERE username = ?";
        return executeUpdate(query, List.of(password, username));
    }

    public boolean updateObject(String password, String salt, String username) {
        String query = "UPDATE users SET password = ?, salt = ? WHERE username = ?";
        return executeUpdate(query, List.of(password, salt, username));
    }
}
