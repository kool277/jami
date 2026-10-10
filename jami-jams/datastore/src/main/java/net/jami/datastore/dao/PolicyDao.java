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

import net.jami.jams.common.objects.user.Policy;

import java.util.List;
import java.util.Optional;

@Slf4j
public class PolicyDao extends AbstractDao<Policy> {

    public PolicyDao() {
        this.setTableName("policies");
        this.setTClass(Policy.class);
    }

    public List<Policy> getAll() {
        return getObjectsFromResultSet("SELECT * FROM policies");
    }

    public Optional<Policy> getByName(String name) {
        String q = "SELECT * FROM policies WHERE name = ?";
        return getFirstObjectFromResultSet(q, List.of(name));
    }

    public Optional<Policy> getByUsername(String username) {
        // TODO this can return multiple policies
        String query =
                "SELECT * FROM usergroupmappings ugm"
                        + " JOIN groups g ON ugm.groupid = g.id"
                        + " JOIN policies p ON g.blueprint = p.name"
                        + " WHERE ugm.username = ?";
        return getFirstObjectFromResultSet(query, List.of(username));
    }

    @Override
    public boolean storeObject(Policy object) {
        String query = "INSERT INTO policies (name, policyData) VALUES (?, ?)";
        return executeInsert(query, object);
    }

    public boolean updateObject(String name, String policyData) {
        String query = "UPDATE policies SET policyData = ? WHERE name = ?";
        return executeUpdate(query, List.of(policyData, name));
    }

    public boolean deleteObject(String name) {
        String query = "DELETE FROM policies WHERE name = ?";
        return executeUpdate(query, List.of(name));
    }
}
