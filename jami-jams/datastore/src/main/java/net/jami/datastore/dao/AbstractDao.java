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

import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;

import net.jami.datastore.main.DataStore;
import net.jami.jams.common.dao.connectivity.SQLConnection;
import net.jami.jams.common.serialization.database.DatabaseObject;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Slf4j
public abstract class AbstractDao<T> {

    @Getter @Setter private String tableName;
    @Getter @Setter protected Class<T> tClass;

    public abstract boolean storeObject(T object);

    protected Optional<T> getFirstObjectFromResultSet(String query) {
        return getFirstObjectFromResultSet(query, new ArrayList<>());
    }

    protected Optional<T> getFirstObjectFromResultSet(String query, String param) {
        return getFirstObjectFromResultSet(query, List.of(param));
    }

    protected Optional<T> getFirstObjectFromResultSet(String query, List<String> params) {
        SQLConnection connection = DataStore.connectionPool.getConnection();

        if (connection != null) {
            try {
                try (PreparedStatement ps = connection.getConnection().prepareStatement(query)) {
                    for (int i = 0; i < params.size(); i++) {
                        ps.setString(i + 1, params.get(i));
                    }
                    try (ResultSet rs = ps.executeQuery()) {
                        if (rs.next()) {
                            T obj = tClass.getConstructor(ResultSet.class).newInstance(rs);
                            return Optional.of(obj);
                        }
                    }
                }
            } catch (Exception e) {
                log.error(
                        "An error occurred while fetching the first result from the database: ", e);
            } finally {
                DataStore.connectionPool.returnConnection(connection);
            }
        }
        return Optional.empty();
    }

    protected List<T> getObjectsFromResultSet(String query) {
        return getObjectsFromResultSet(query, new ArrayList<>());
    }

    protected List<T> getObjectsFromResultSet(String query, String param) {
        return getObjectsFromResultSet(query, List.of(param));
    }

    protected List<T> getObjectsFromResultSet(String query, List<String> params) {
        SQLConnection connection = DataStore.connectionPool.getConnection();

        List<T> result = new ArrayList<>();

        if (connection != null) {
            try {
                try (PreparedStatement ps = connection.getConnection().prepareStatement(query)) {
                    for (int i = 0; i < params.size(); i++) {
                        ps.setString(i + 1, params.get(i));
                    }
                    try (ResultSet rs = ps.executeQuery()) {
                        while (rs.next()) {
                            result.add(tClass.getConstructor(ResultSet.class).newInstance(rs));
                        }
                    }
                }
            } catch (Exception e) {
                log.error("An error occurred while fetching results from the database: ", e);
            } finally {
                DataStore.connectionPool.returnConnection(connection);
            }
        }
        return result;
    }

    protected boolean executeUpdate(String query, List<String> params) {
        SQLConnection connection = DataStore.connectionPool.getConnection();

        if (connection != null) {
            try (PreparedStatement ps = connection.getConnection().prepareStatement(query)) {

                for (int i = 0; i < params.size(); i++) {
                    ps.setString(i + 1, params.get(i));
                }

                boolean executeUpdate = ps.executeUpdate() != 0;
                return executeUpdate;
            } catch (Exception e) {
                log.error("An error occurred while updating: ", e);
            } finally {
                DataStore.connectionPool.returnConnection(connection);
            }
        }
        return false;
    }

    protected boolean executeInsert(String query, DatabaseObject object) {
        SQLConnection connection = DataStore.connectionPool.getConnection();

        if (connection != null) {
            try {
                PreparedStatement ps = connection.getConnection().prepareStatement(query);
                ps = object.getInsert(ps);
                boolean executeUpdate = ps.executeUpdate() != 0;
                ps.close();

                return executeUpdate;
            } catch (Exception e) {
                log.error("An error occurred while inserting: ", e);
            } finally {
                DataStore.connectionPool.returnConnection(connection);
            }
        }
        return false;
    }
}
