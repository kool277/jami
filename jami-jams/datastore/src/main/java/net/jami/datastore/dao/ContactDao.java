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

import net.jami.datastore.main.DataStore;
import net.jami.jams.common.dao.connectivity.SQLConnection;
import net.jami.jams.common.objects.contacts.Contact;

import java.sql.PreparedStatement;
import java.util.List;

@Slf4j
public class ContactDao extends AbstractDao<Contact> {

    public ContactDao() {
        this.setTableName("contacts");
        this.setTClass(Contact.class);
    }

    public List<Contact> getByOwner(String owner) {
        return getObjectsFromResultSet("SELECT * FROM contacts WHERE owner = ?", owner);
    }

    // Not used because the strategy here is different.
    @Override
    public boolean storeObject(Contact object) {
        String query =
                "INSERT INTO contacts (owner, uri, displayName, added, removed, banned, confirmed, conversationId) VALUES "
                        + "(?, ?, ?, ?, ?, ?, ?, ?)";
        return executeInsert(query, object);
    }

    public boolean storeContactList(List<Contact> contactList) {
        if (contactList.isEmpty()) {
            log.error("Unable to store empty contact list.");
            return false;
        }

        SQLConnection connection = DataStore.connectionPool.getConnection();
        if (connection == null) {
            return false;
        }
        try {
            // Initiate transaction
            connection.getConnection().setAutoCommit(false);
            String update =
                    "UPDATE contacts SET displayName = ?, added = ?, removed = ?, banned = ?, confirmed = ?, conversationId = ? "
                            + "WHERE owner = ? AND uri = ?";

            String insert =
                    "INSERT INTO contacts (owner, uri, displayName, added, removed, banned, confirmed, conversationId) VALUES "
                            + "(?, ?, ?, ?, ?, ?, ?, ?)";
            for (Contact contact : contactList) {
                PreparedStatement updatePs = connection.getConnection().prepareStatement(update);
                contact.getUpdate(updatePs);
                int rowsUpdated = updatePs.executeUpdate();

                if (rowsUpdated == 0) {
                    // If no rows were updated, perform an insert
                    PreparedStatement insertPs =
                            connection.getConnection().prepareStatement(insert);
                    contact.getInsert(insertPs);
                    insertPs.executeUpdate();
                    insertPs.close();
                }
            }
            // Commit transaction
            connection.getConnection().commit();
            return true;
        } catch (Exception e) {
            log.error("An error occurred while attempting to update contacts: {}", e.getMessage());
            return false;
        } finally {
            DataStore.connectionPool.returnConnection(connection);
        }
    }

    public boolean removeContact(String owner, String uri) {
        String query = "UPDATE contacts SET removed = ? WHERE owner = ? AND uri = ?";
        String removedTimestamp = String.valueOf(System.currentTimeMillis() / 1000);
        return executeUpdate(query, List.of(removedTimestamp, owner, uri));
    }
}
