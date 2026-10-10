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

import net.jami.jams.common.objects.contacts.Contact;

import java.lang.reflect.Type;

public class ContactAdapter implements JsonSerializer<Contact>, JsonDeserializer<Contact> {

    /**
     * { "added" : 1595523510, "banned" : false, "uri" : "520290d7f45e5811fe5af637d328e7fbf5e8cab9",
     * "removed" : 0, "conversationId": "6a61013979964f70c8fb9183a8b238d58a1846ed" }
     */
    @Override
    public Contact deserialize(JsonElement json, Type typeOfT, JsonDeserializationContext context)
            throws JsonParseException {
        JsonObject input = json.getAsJsonObject();
        Contact contact = new Contact();
        contact.setUri(input.get("uri").getAsString());
        contact.setConversationId(input.get("conversationId").getAsString());

        long timeAdded = 0L;
        if (input.has("added")) {
            timeAdded = input.get("added").getAsLong();
        }
        contact.setAdded(timeAdded);

        long timeRemoved = 0L;
        if (input.has("removed")) {
            timeRemoved = input.get("removed").getAsLong();
        }
        contact.setRemoved(timeRemoved);

        if (input.has("confirmed")) {
            contact.setConfirmed(input.get("confirmed").getAsBoolean());
        }

        if (input.has("banned")) {
            contact.setBanned(input.get("banned").getAsBoolean());
        }
        return contact;
    }

    @Override
    public JsonElement serialize(
            Contact contact, Type typeOfSrc, JsonSerializationContext context) {
        JsonObject output = new JsonObject();
        output.addProperty("uri", contact.getUri());
        output.addProperty("conversationId", contact.getConversationId());
        output.addProperty("added", contact.getAdded());
        output.addProperty("removed", contact.getRemoved());
        if (contact.getConfirmed() != null) {
            output.addProperty("confirmed", contact.getConfirmed());
        }
        if (contact.getBanned() != null) {
            output.addProperty("banned", contact.getBanned());
        }
        return output;
    }
}
