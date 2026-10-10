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

package net.jami.jams.common.utils;

import net.jami.jams.common.objects.conversations.Conversation;
import net.jami.jams.common.objects.conversations.ConversationRequest;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

public class ConversationMerger {

    public static List<Conversation> mergeConversations(
            List<Conversation> remote, List<Conversation> local) {
        List<Conversation> output = new ArrayList<>();
        final HashMap<String, Conversation[]> conversationMap = new HashMap<>();
        remote.forEach(
                conversation -> {
                    conversationMap.putIfAbsent(
                            conversation.getId(), new Conversation[] {null, null});
                    conversationMap.get(conversation.getId())[0] = conversation;
                });
        local.forEach(
                conversation -> {
                    conversationMap.putIfAbsent(
                            conversation.getId(), new Conversation[] {null, null});
                    conversationMap.get(conversation.getId())[1] = conversation;
                });
        conversationMap.forEach(
                (k, v) -> {
                    if (v[0] == null) output.add(v[1]);
                    else if (v[1] == null) output.add(v[0]);
                    else {
                        // Merge policy we pick the conversation with the latest timestamp among
                        // created and removed
                        Conversation latestCreated =
                                v[0].getCreated() > v[1].getCreated() ? v[0] : v[1];
                        Conversation latestRemoved =
                                v[0].getRemoved() > v[1].getRemoved() ? v[0] : v[1];
                        if (latestCreated.getCreated() > latestRemoved.getRemoved()) {
                            output.add(latestCreated);
                        } else {
                            output.add(latestRemoved);
                        }
                    }
                });
        return output;
    }

    public static List<ConversationRequest> mergeConversationRequests(
            List<ConversationRequest> remote, List<ConversationRequest> local) {
        List<ConversationRequest> output = new ArrayList<>();
        final HashMap<String, ConversationRequest[]> conversationRequestMap = new HashMap<>();
        remote.forEach(
                conversationRequest -> {
                    conversationRequestMap.putIfAbsent(
                            conversationRequest.getConversationId(),
                            new ConversationRequest[] {null, null});
                    conversationRequestMap.get(conversationRequest.getConversationId())[0] =
                            conversationRequest;
                });
        local.forEach(
                conversationRequest -> {
                    conversationRequestMap.putIfAbsent(
                            conversationRequest.getConversationId(),
                            new ConversationRequest[] {null, null});
                    conversationRequestMap.get(conversationRequest.getConversationId())[1] =
                            conversationRequest;
                });
        conversationRequestMap.forEach(
                (k, v) -> {
                    if (v[0] == null) output.add(v[1]);
                    else if (v[1] == null) output.add(v[0]);
                    else {
                        // Merge policy we pick the conversation request with the latest timestamp
                        // among
                        // received and declined
                        ConversationRequest latestReceived =
                                v[0].getReceived() > v[1].getReceived() ? v[0] : v[1];
                        ConversationRequest latestDeclined =
                                v[0].getDeclined() > v[1].getDeclined() ? v[0] : v[1];
                        if (latestReceived.getReceived() > latestDeclined.getDeclined()) {
                            output.add(latestReceived);
                        } else {
                            output.add(latestDeclined);
                        }
                    }
                });
        return output;
    }
}
