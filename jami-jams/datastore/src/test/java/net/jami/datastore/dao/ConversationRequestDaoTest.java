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
import net.jami.jams.common.objects.conversations.ConversationRequest;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

class ConversationRequestDaoTest {
    private static ConversationRequestDao conversationRequestDao;
    private static ConversationRequest conversationRequest;

    @BeforeAll
    static void setUp() {
        DataStore dataStore = new DataStore("jdbc:derby:memory:testdb;create=true");
        SQLConnection connection = DataStore.connectionPool.getConnection();
        Assertions.assertNotNull(connection);

        conversationRequestDao = new ConversationRequestDao();
        Assertions.assertNotNull(conversationRequestDao);

        conversationRequest = new ConversationRequest();
        conversationRequest.setOwner("test");
        conversationRequest.setConversationId("test");
        conversationRequest.setSender("test");
        conversationRequest.setMetadatas("test");
        conversationRequest.setReceived(0L);
        conversationRequest.setDeclined(0L);
        Assertions.assertNotNull(conversationRequest);
    }

    @Test
    void storeObject() {
        Assertions.assertTrue(conversationRequestDao.storeObject(conversationRequest));
    }

    @Test
    void getByOwner() {
        conversationRequestDao.storeObject(conversationRequest);
        Assertions.assertFalse(conversationRequestDao.getByOwner("test").isEmpty());
    }

    @Test
    void storeEmptyConversationRequestList() {
        ArrayList<ConversationRequest> emptyConversationRequestList = new ArrayList<>();
        Assertions.assertFalse(
                conversationRequestDao.storeConversationRequestList(emptyConversationRequestList));
    }

    @Test
    void storeConversationRequestList() {
        ArrayList<ConversationRequest> conversationRequestList = new ArrayList<>();
        conversationRequestList.add(conversationRequest);
        Assertions.assertTrue(
                conversationRequestDao.storeConversationRequestList(conversationRequestList));
    }

    @Test
    void filterConversationRequests() {
        // Create a new conversation request with a different ownder and conversationId
        ConversationRequest conversationRequest2 = new ConversationRequest();
        conversationRequest2.setOwner("test2");
        conversationRequest2.setConversationId("test2");
        conversationRequest2.setSender(conversationRequest.getSender());
        conversationRequest2.setMetadatas(conversationRequest.getMetadatas());
        conversationRequest2.setReceived(conversationRequest.getReceived());
        conversationRequest2.setDeclined(conversationRequest.getDeclined());
        // Store the conversation requests
        conversationRequestDao.storeObject(conversationRequest);
        conversationRequestDao.storeObject(conversationRequest2);
        // Filter the conversation requests
        Conversation conversation = new Conversation();
        conversation.setOwner("test");
        conversation.setId("test");
        conversation.setCreated(0L);
        conversation.setRemoved(0L);
        conversation.setErased(0L);
        conversation.setMembers("test");
        conversation.setLastDisplayed("test");
        ArrayList<Conversation> conversationList = new ArrayList<>();
        conversationList.add(conversation);
        ArrayList<ConversationRequest> conversationRequestList = new ArrayList<>();
        conversationRequestList.add(conversationRequest);
        conversationRequestList.add(conversationRequest2);

        List<ConversationRequest> filteredConversationRequest =
                conversationRequestDao.filterConversationRequests(
                        conversationRequestList, conversationList);
        Assertions.assertEquals(1, filteredConversationRequest.size());
        ConversationRequest remainingConversationRequest = filteredConversationRequest.get(0);
        Assertions.assertEquals(
                conversationRequest2.getOwner(), remainingConversationRequest.getOwner());
    }
}
