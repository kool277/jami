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
import net.jami.jams.common.objects.conversations.Conversation;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;

class ConversationDaoTest {
    private static ConversationDao conversationDao;
    private static Conversation conversation;

    @BeforeAll
    static void setUp() {
        DataStore dataStore = new DataStore("jdbc:derby:memory:testdb;create=true");
        SQLConnection connection = DataStore.connectionPool.getConnection();
        Assertions.assertNotNull(connection);

        conversationDao = new ConversationDao();
        Assertions.assertNotNull(conversationDao);

        conversation = new Conversation();
        conversation.setOwner("test");
        conversation.setId("test");
        conversation.setCreated(0L);
        conversation.setRemoved(0L);
        conversation.setErased(0L);
        conversation.setMembers("test");
        conversation.setLastDisplayed("test");
    }

    @Test
    void getByOwner() throws Exception {
        conversationDao.storeObject(conversation);
        Assertions.assertFalse(conversationDao.getByOwner("test").isEmpty());
    }

    @Test
    void storeEmptyConversationList() {
        ArrayList<Conversation> conversationList = new ArrayList<>();
        Assertions.assertFalse(conversationDao.storeConversationList(conversationList));
    }

    @Test
    void storeConversationList() {
        ArrayList<Conversation> conversationList = new ArrayList<>();
        conversationList.add(conversation);
        Assertions.assertTrue(conversationDao.storeConversationList(conversationList));
    }
}
