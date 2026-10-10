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

import net.jami.jams.common.objects.conversations.Conversation;

import java.lang.reflect.Type;

public class ConversationAdapter
        implements JsonSerializer<Conversation>, JsonDeserializer<Conversation> {

    /**
     * { "created" : 1701180312, "erased" : 1701180454, "id" :
     * "63afe87b8b18a3cfc40a4524ebd441c4a7d2336a", "lastDisplayed" :
     * "63afe87b8b18a3cfc40a4524ebd441c4a7d2336a", "members" : [ { "uri" :
     * "7172ad8cf00c93235886d8ce1b2889638c0da68d" }, { "uri" :
     * "bf82b61537582a53fb0a28553f77060cc7a332c3" } ], "removed" : 1701180454 }
     */
    @Override
    public Conversation deserialize(
            JsonElement json, Type typeOfT, JsonDeserializationContext context)
            throws JsonParseException {
        Gson gson = new Gson();
        JsonObject input = json.getAsJsonObject();
        Conversation conversation = new Conversation();
        conversation.setId(input.get("id").getAsString());
        conversation.setCreated(input.get("created").getAsLong());

        long timeRemoved = 0L;
        if (input.has("removed")) {
            timeRemoved = input.get("removed").getAsLong();
        }
        conversation.setRemoved(timeRemoved);

        long timeErased = 0L;
        if (input.has("erased")) {
            timeErased = input.get("erased").getAsLong();
        }
        conversation.setErased(timeErased);
        if (input.has("members")) {
            conversation.setMembers(gson.toJson(input.get("members")));
        }
        conversation.setLastDisplayed(input.get("lastDisplayed").getAsString());
        return conversation;
    }

    @Override
    public JsonElement serialize(
            Conversation conversation, Type typeOfSrc, JsonSerializationContext context) {
        JsonObject output = new JsonObject();
        output.addProperty("id", conversation.getId());
        output.addProperty("created", conversation.getCreated());
        output.addProperty("removed", conversation.getRemoved());
        output.addProperty("erased", conversation.getErased());
        JsonElement jsonMembers = JsonParser.parseString(conversation.getMembers());
        output.add("members", jsonMembers);
        output.addProperty("lastDisplayed", conversation.getLastDisplayed());
        return output;
    }
}
