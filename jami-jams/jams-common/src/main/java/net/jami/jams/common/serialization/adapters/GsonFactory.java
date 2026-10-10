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

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

import net.jami.jams.common.objects.contacts.Contact;
import net.jami.jams.common.objects.conversations.Conversation;
import net.jami.jams.common.objects.conversations.ConversationRequest;
import net.jami.jams.common.objects.devices.Device;
import net.jami.jams.common.objects.roots.X509Entity;
import net.jami.jams.common.objects.user.User;

import org.bouncycastle.pkcs.PKCS10CertificationRequest;

import java.security.PrivateKey;
import java.security.cert.X509Certificate;

public class GsonFactory {
    public static Gson createGson() {
        GsonBuilder gsonBuilder = new GsonBuilder();
        gsonBuilder.registerTypeAdapter(User.class, new UserAdapter());
        gsonBuilder.registerTypeAdapter(Contact.class, new ContactAdapter());
        gsonBuilder.registerTypeAdapter(Conversation.class, new ConversationAdapter());
        gsonBuilder.registerTypeAdapter(
                ConversationRequest.class, new ConversationRequestAdapter());
        gsonBuilder.registerTypeAdapter(PKCS10CertificationRequest.class, new CSRDeserializer());
        gsonBuilder.registerTypeAdapter(Device.class, new DeviceAdapter());
        gsonBuilder.registerTypeAdapter(PrivateKey.class, new PrivateKeyAdapter());
        gsonBuilder.registerTypeAdapter(X509Certificate.class, new X509CertificateAdapter());
        gsonBuilder.registerTypeAdapter(X509Entity.class, new X509EntityAdapter());
        Gson gson = gsonBuilder.create();
        return gson;
    }
}
