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
package net.jami.jams.common.serialization;

import com.google.gson.Gson;

import net.jami.jams.common.authentication.AuthenticationSourceType;
import net.jami.jams.common.objects.contacts.Contact;
import net.jami.jams.common.objects.conversations.Conversation;
import net.jami.jams.common.objects.conversations.ConversationRequest;
import net.jami.jams.common.objects.devices.Device;
import net.jami.jams.common.objects.requests.DeviceRegistrationRequest;
import net.jami.jams.common.objects.responses.DeviceRevocationResponse;
import net.jami.jams.common.objects.roots.X509Entity;
import net.jami.jams.common.objects.user.AccessLevel;
import net.jami.jams.common.objects.user.User;
import net.jami.jams.common.serialization.adapters.GsonFactory;
import net.jami.jams.common.utils.X509Utils;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;

class GsonFactoryTest {

    static String strPrivateKey;
    static String strCertificate;
    static String strPkcs10Request;

    private static Gson gson;

    @BeforeAll
    public static void loadProps() throws IOException {
        gson = GsonFactory.createGson();
        InputStream path;
        ClassLoader classLoader = Thread.currentThread().getContextClassLoader();
        path = classLoader.getResourceAsStream("cakey.txt");
        strPrivateKey = new String(path.readAllBytes());
        path = classLoader.getResourceAsStream("cacert.txt");
        strCertificate = new String(path.readAllBytes());
        path = classLoader.getResourceAsStream("pkcs10request.txt");
        strPkcs10Request = new String(path.readAllBytes());
    }

    @Test
    void X509EntitySerializationAndDeserialization() {
        X509Entity entity = new X509Entity();
        entity.setCertificate(X509Utils.getCertificateFromPEMString(strCertificate));
        entity.setPrivateKey(X509Utils.getKeyFromPEMString(strPrivateKey));
        String x = gson.toJson(entity);
        Assertions.assertNotNull(x, "Serialization failed!");
        entity = null;
        entity = gson.fromJson(x, X509Entity.class);
        Assertions.assertNotNull(entity.getCertificate(), "Certificate was not parsed!");
        Assertions.assertNotNull(entity.getPrivateKey(), "Private key was not parsed!");
    }

    @Test
    void ContactSerializationAndDeserialization() {
        Contact contact = new Contact();
        contact.setUri("testUri");
        contact.setAdded(0L);
        contact.setRemoved(0L);
        contact.setBanned(false);
        contact.setConfirmed(false);
        contact.setConversationId("testConversationId");
        String x = gson.toJson(contact);
        Assertions.assertNotNull(x, "Serialization failed!");
        contact = null;
        contact = gson.fromJson(x, Contact.class);
        Assertions.assertEquals(contact.getUri(), "testUri");
        Assertions.assertEquals(contact.getAdded(), 0L);
        Assertions.assertEquals(contact.getRemoved(), 0L);
        Assertions.assertFalse(contact.getBanned());
        Assertions.assertFalse(contact.getConfirmed());
        Assertions.assertEquals(contact.getConversationId(), "testConversationId");
    }

    @Test
    void ConversationSerializationAndDeserialization() {
        Conversation conversation = new Conversation();
        conversation.setId("testId");
        conversation.setCreated(0L);
        conversation.setRemoved(0L);
        conversation.setErased(0L);
        conversation.setMembers(gson.toJson("testMembers"));
        conversation.setLastDisplayed("testLastDisplayed");
        String x = gson.toJson(conversation);
        Assertions.assertNotNull(x, "Serialization failed!");
        conversation = null;
        conversation = gson.fromJson(x, Conversation.class);
        Assertions.assertEquals(conversation.getId(), "testId");
        Assertions.assertEquals(conversation.getCreated(), 0L);
        Assertions.assertEquals(conversation.getRemoved(), 0L);
        Assertions.assertEquals(conversation.getErased(), 0L);
        Assertions.assertEquals(conversation.getMembers(), gson.toJson("testMembers"));
        Assertions.assertEquals(conversation.getLastDisplayed(), "testLastDisplayed");
    }

    @Test
    void ConversationRequestSerializationAndDeserialization() {
        ConversationRequest conversationRequest = new ConversationRequest();
        conversationRequest.setConversationId("testConversationId");
        conversationRequest.setSender("testSender");
        conversationRequest.setMetadatas("testMetadatas");
        conversationRequest.setReceived(0L);
        conversationRequest.setDeclined(0L);
        String x = gson.toJson(conversationRequest);
        Assertions.assertNotNull(x, "Serialization failed!");
        conversationRequest = null;
        conversationRequest = gson.fromJson(x, ConversationRequest.class);
        Assertions.assertEquals(conversationRequest.getConversationId(), "testConversationId");
        Assertions.assertEquals(conversationRequest.getSender(), "testSender");
        Assertions.assertEquals(conversationRequest.getMetadatas(), gson.toJson("testMetadatas"));
        Assertions.assertEquals(conversationRequest.getReceived(), 0L);
        Assertions.assertEquals(conversationRequest.getDeclined(), 0L);
    }

    @Test
    void CSRDeserializeTest() {
        String input = "{\"csr\":\"" + strPkcs10Request + "\"}";
        DeviceRegistrationRequest request = gson.fromJson(input, DeviceRegistrationRequest.class);
        Assertions.assertNotNull(request.getCsr(), "CSR Should not have been null!");
    }

    @Test
    void DeviceSerializeTest() {
        Device device = new Device();
        device.setDeviceId("testDeviceId");
        device.setOwner("testOwner");
        device.setDisplayName("testDisplayName");
        device.setCertificate(X509Utils.getCertificateFromPEMString(strCertificate));
        device.setPrivateKey(X509Utils.getKeyFromPEMString(strPrivateKey));
        String serializedDevice = gson.toJson(device);
        Assertions.assertNotNull(serializedDevice, "Serialization failed!");
    }

    @Test
    void DeviceRevocationResponseSerializeTest() {
        DeviceRevocationResponse deviceRevocationResponse = new DeviceRevocationResponse();
        deviceRevocationResponse.setSuccess(true);
        deviceRevocationResponse.setTimestamp("test");
        String serializedDeviceRevocationResponse = gson.toJson(deviceRevocationResponse);
        Assertions.assertNotNull(serializedDeviceRevocationResponse, "Serialization failed!");
    }

    @Test
    void UserSerializationAndDeserialization() {
        User user = new User();
        user.setUsername("testUsername");
        user.setUserType(AuthenticationSourceType.LOCAL);
        user.setRealm("testRealm");
        user.setAccessLevel(AccessLevel.USER);
        user.setNeedsPasswordReset(false);
        user.setEthAddress("testEthAddress");
        user.setJamiId("testJamiId");
        user.setCertificate(X509Utils.getCertificateFromPEMString(strCertificate));
        user.setRevoked(false);
        String x = gson.toJson(user);
        Assertions.assertNotNull(x, "Serialization failed!");
        user = null;
        user = gson.fromJson(x, User.class);
        Assertions.assertEquals(user.getUsername(), "testUsername");
        Assertions.assertEquals(user.getUserType(), AuthenticationSourceType.LOCAL);
        Assertions.assertEquals(user.getRealm(), "testRealm");
        Assertions.assertEquals(user.getAccessLevel(), AccessLevel.USER);
        Assertions.assertFalse(user.getNeedsPasswordReset());
        Assertions.assertEquals(user.getEthAddress(), "testEthAddress");
        Assertions.assertEquals(user.getJamiId(), "testJamiId");
        Assertions.assertNotNull(
                X509Utils.getPEMStringFromCertificate(user.getCertificate()), strCertificate);
    }
}
