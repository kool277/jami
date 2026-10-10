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
package net.jami.jams.common.objects.conversations;

import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import net.jami.jams.common.serialization.database.DatabaseObject;

import java.sql.PreparedStatement;
import java.sql.ResultSet;

@Getter
@Setter
@NoArgsConstructor
@EqualsAndHashCode
public class Conversation implements DatabaseObject {

    private transient String owner;

    private String id;
    private Long created;
    private Long removed;
    private Long erased;
    private String members;
    private String lastDisplayed;

    public Conversation(ResultSet rs) throws Exception {
        this.owner = rs.getString("owner");
        this.id = rs.getString("id");
        this.created = rs.getLong("created");
        this.removed = rs.getLong("removed");
        this.erased = rs.getLong("erased");
        this.members = rs.getString("members");

        this.lastDisplayed = rs.getString("lastDisplayed");
    }

    @Override
    public PreparedStatement getInsert(PreparedStatement ps) throws Exception {
        ps.setString(1, owner);
        ps.setString(2, id);
        ps.setLong(3, created);
        ps.setLong(4, removed);
        ps.setLong(5, erased);
        ps.setString(6, members);
        ps.setString(7, lastDisplayed);
        return ps;
    }

    @Override
    public PreparedStatement getDelete(PreparedStatement ps) throws Exception {
        return null;
    }

    @Override
    public PreparedStatement getUpdate(PreparedStatement ps) throws Exception {
        ps.setLong(1, created);
        ps.setLong(2, removed);
        ps.setLong(3, erased);
        ps.setString(4, members);
        ps.setString(5, lastDisplayed);
        ps.setString(6, owner);
        ps.setString(7, id);
        return ps;
    }
}
