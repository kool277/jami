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
package net.jami.jams.common.dao.connectivity;

import lombok.extern.slf4j.Slf4j;

import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.concurrent.ConcurrentLinkedQueue;

@Slf4j
public class ConnectionPool {

    private static final int MAX_POOL_SIZE = 15;

    private volatile ConcurrentLinkedQueue<SQLConnection> connectionPool =
            new ConcurrentLinkedQueue<>();
    private volatile ConcurrentLinkedQueue<SQLConnection> usedConnections =
            new ConcurrentLinkedQueue<>();
    private final String connectionURI;

    // Load Derby class.
    public ConnectionPool(String connectionURI) {
        this.connectionURI = connectionURI;
        try {
            Class.forName("org.apache.derby.jdbc.EmbeddedDriver");
            while (connectionPool.size() < MAX_POOL_SIZE) {
                try {
                    connectionPool.add(createConnection(this.connectionURI));
                } catch (Exception e) {
                    log.error("An error occurred while creating a link with the database: ", e);
                }
            }
        } catch (Exception e) {
            log.error("An error occurred while loading ApacheDerby class driver: ", e);
        }
    }

    public synchronized SQLConnection getConnection() {
        try {
            if (connectionPool.isEmpty()) {
                if (usedConnections.size() < MAX_POOL_SIZE) {
                    connectionPool.add(createConnection(this.connectionURI));
                } else {
                    throw new RuntimeException(
                            "Maximum pool size reached, no available connections!");
                }
            }

            SQLConnection connection = connectionPool.poll();

            if (connection.isStale()) {
                connection.getConnection().close();
                connection = createConnection(this.connectionURI);
            }

            connection.getConnection().setAutoCommit(true);
            usedConnections.add(connection);

            return connection;

        } catch (Exception e) {
            log.error("A connection error occurred: ", e);
            return null;
        }
    }

    public boolean returnConnection(SQLConnection sqlConnection) {
        connectionPool.add(sqlConnection);
        return usedConnections.remove(sqlConnection);
    }

    private SQLConnection createConnection(String connectionURI) throws SQLException {
        return new SQLConnection(DriverManager.getConnection(connectionURI));
    }
}
