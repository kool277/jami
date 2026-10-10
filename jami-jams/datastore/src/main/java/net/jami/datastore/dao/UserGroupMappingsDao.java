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

import net.jami.jams.common.objects.user.UserGroupMapping;

import java.util.List;
import java.util.Optional;

@Slf4j
public class UserGroupMappingsDao extends AbstractDao<UserGroupMapping> {

    public UserGroupMappingsDao() {
        this.setTableName("usergroupmappings");
        this.setTClass(UserGroupMapping.class);
    }

    public List<UserGroupMapping> getByGroupId(String groupId) {
        return getObjectsFromResultSet(
                "SELECT * FROM usergroupmappings WHERE groupId = ?", groupId);
    }

    public List<UserGroupMapping> getByUsername(String username) {
        return getObjectsFromResultSet(
                "SELECT * FROM usergroupmappings WHERE username = ?", username);
    }

    public Optional<UserGroupMapping> getByGroupIdAndUsername(String groupId, String username) {
        // TODO The primary key should be (groupId, username)
        String query = "SELECT * FROM usergroupmappings WHERE groupId = ? AND username = ?";
        List<String> params = List.of(groupId, username);
        return getFirstObjectFromResultSet(query, params);
    }

    @Override
    public boolean storeObject(UserGroupMapping object) {
        String query =
                "INSERT INTO usergroupmappings " + "(username, groupId)" + " VALUES " + "(?, ?)";
        return executeInsert(query, object);
    }

    public boolean deleteObject(String username, String groupId) {
        if (username.equals("*")) {
            String query = "DELETE FROM usergroupmappings WHERE groupId = ?";
            return executeUpdate(query, List.of(groupId));
        }

        String query = "DELETE FROM usergroupmappings WHERE username = ? AND groupId = ?";
        return executeUpdate(query, List.of(username, groupId));
    }
}
