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
package net.jami.jams.common.serialization.adapters;

import com.google.gson.*;

import net.jami.jams.common.objects.conversations.ConversationRequest;

import java.lang.reflect.Type;

public class ConversationRequestAdapter
        implements JsonSerializer<ConversationRequest>, JsonDeserializer<ConversationRequest> {

    /**
     * { "conversationId" : "b158323bd68c7f71f606e0a4fb505f59a8212afe", "from" :
     * "89c5c8d61df665f9dde97a23666772bccb658c22", "metadatas" : { "avatar" : "", "title" : " " },
     * "received" : 1701188208 }
     */
    @Override
    public ConversationRequest deserialize(
            JsonElement json, Type typeOfT, JsonDeserializationContext context)
            throws JsonParseException {
        Gson gson = new Gson();
        JsonObject input = json.getAsJsonObject();
        ConversationRequest conversationRequest = new ConversationRequest();
        conversationRequest.setConversationId(input.get("conversationId").getAsString());
        conversationRequest.setSender(input.get("from").getAsString());

        conversationRequest.setMetadatas(gson.toJson(input.get("metadatas")));

        long timeReceived = 0L;
        if (input.has("received")) {
            timeReceived = input.get("received").getAsLong();
        }
        conversationRequest.setReceived(timeReceived);

        long timeDeclined = 0L;
        if (input.has("timeDeclined")) {
            timeDeclined = input.get("timeDeclined").getAsLong();
        }
        conversationRequest.setDeclined(timeDeclined);
        return conversationRequest;
    }

    @Override
    public JsonElement serialize(
            ConversationRequest conversationRequest,
            Type typeOfSrc,
            JsonSerializationContext context) {
        JsonObject output = new JsonObject();
        output.addProperty("conversationId", conversationRequest.getConversationId());
        output.addProperty("from", conversationRequest.getSender());
        JsonElement jsonMetadatas = JsonParser.parseString(conversationRequest.getMetadatas());
        output.add("metadatas", jsonMetadatas);
        output.addProperty("received", conversationRequest.getReceived());
        output.addProperty("declined", conversationRequest.getDeclined());
        return output;
    }
}
