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

import net.jami.datastore.main.DataStore;
import net.jami.jams.common.dao.connectivity.SQLConnection;
import net.jami.jams.common.objects.contacts.Contact;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;

class ContactDaoTest {
    private static ContactDao contactDao;
    private static Contact contact;

    @BeforeAll
    static void setUp() {
        DataStore dataStore = new DataStore("jdbc:derby:memory:testdb;create=true");
        SQLConnection connection = DataStore.connectionPool.getConnection();
        Assertions.assertNotNull(connection);

        contactDao = new ContactDao();
        Assertions.assertNotNull(contactDao);

        contact = new Contact();
        contact.setOwner("test");
        contact.setUri("test");
        contact.setDisplayName("test");
        contact.setAdded(0L);
        contact.setRemoved(0L);
        contact.setBanned(false);
        contact.setConfirmed(false);
        contact.setConversationId("test");
    }

    @Test
    void getByOwner() {
        contactDao.storeObject(contact);
        Assertions.assertFalse(contactDao.getByOwner("test").isEmpty());
    }

    @Test
    void storeEmptyContactList() {
        ArrayList<Contact> emptyContactList = new ArrayList<>();
        Assertions.assertFalse(contactDao.storeContactList(emptyContactList));
    }

    @Test
    void storeContactList() {
        ArrayList<Contact> contactList = new ArrayList<>();
        contactList.add(contact);
        Assertions.assertTrue(contactDao.storeContactList(contactList));
    }

    @Test
    void deleteContact() {
        contactDao.storeObject(contact);
        Assertions.assertFalse(contactDao.removeContact("owner", "uri"));
    }

    @Test
    void deleteNonExistentContact() {
        Assertions.assertFalse(contactDao.removeContact("owner", "uri"));
    }
}
