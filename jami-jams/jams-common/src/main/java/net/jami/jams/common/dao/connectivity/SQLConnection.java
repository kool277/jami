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

import lombok.Getter;

import java.sql.Connection;

@Getter
public class SQLConnection {

    private static final long TIMEOUT = 30_000L;
    private final Connection connection;
    private final long creationTimestamp;

    public SQLConnection(Connection connection) {
        this.connection = connection;
        this.creationTimestamp = System.currentTimeMillis();
    }

    public boolean isStale() {
        return (System.currentTimeMillis() - creationTimestamp > TIMEOUT);
    }
}
