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
public class ConversationRequest implements DatabaseObject {

    private transient String owner;

    private String conversationId;
    private String sender; // 'from' became sender because 'from' is a reserved keyword in SQL
    private String metadatas;
    private Long received;
    private Long declined;

    public ConversationRequest(ResultSet rs) throws Exception {
        this.owner = rs.getString("owner");
        this.conversationId = rs.getString("conversationId");
        this.sender = rs.getString("sender");
        this.metadatas = rs.getString("metadatas");
        this.received = rs.getLong("received");
        this.declined = rs.getLong("declined");
    }

    @Override
    public PreparedStatement getInsert(PreparedStatement ps) throws Exception {
        ps.setString(1, owner);
        ps.setString(2, conversationId);
        ps.setString(3, sender);
        ps.setString(4, metadatas);
        ps.setLong(5, received);
        ps.setLong(6, declined);
        return ps;
    }

    @Override
    public PreparedStatement getDelete(PreparedStatement ps) throws Exception {
        ps.setString(1, owner);
        ps.setString(2, conversationId);
        return ps;
    }

    @Override
    public PreparedStatement getUpdate(PreparedStatement ps) throws Exception {
        ps.setString(1, sender);
        ps.setString(2, metadatas);
        ps.setLong(3, received);
        ps.setLong(4, declined);
        ps.setString(5, owner);
        ps.setString(6, conversationId);
        return ps;
    }
}
