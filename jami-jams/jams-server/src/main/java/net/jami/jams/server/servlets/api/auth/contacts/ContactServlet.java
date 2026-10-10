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
package net.jami.jams.server.servlets.api.auth.contacts;

import static net.jami.jams.server.Server.dataStore;

import com.google.gson.Gson;
import com.google.gson.JsonObject;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import net.jami.jams.common.objects.contacts.Contact;
import net.jami.jams.common.serialization.adapters.GsonFactory;
import net.jami.jams.common.serialization.tomcat.TomcatCustomErrorHandler;
import net.jami.jams.common.utils.ContactMerger;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;

@WebServlet("/api/auth/contacts")
public class ContactServlet extends HttpServlet {
    private static final Gson gson = GsonFactory.createGson();

    /**
     * @apiVersion 1.0.0
     * @api {get} /api/auth/contacts View contacts
     * @apiName getContact
     * @apiGroup Contacts
     * @apiSuccess (200) {body} Contact[] List of contacts for the user
     * @apiSuccessExample {json} Success-Response: [{ "uri": "jami://7e3ab29383", "added":
     *     18272662662 }, { "uri": "jami://7e3ab29383", "removed": 12387873 }, ]
     */
    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        String username = req.getAttribute("username").toString();
        List<Contact> contactList = dataStore.getContactDao().getByOwner(username);
        resp.getOutputStream().write(gson.toJson(contactList).getBytes());
        resp.flushBuffer();
    }

    /**
     * @apiVersion 1.0.0
     * @api {put} /api/auth/contacts Add contact
     * @apiName putContact
     * @apiGroup Contacts
     * @apiParam {body} Contact JSON representation of the contact object
     * @apiParamExample {json} Request-Example: { "uri": "jami://7e3ab29383" }
     * @apiSuccess (200) {null} null contact added successfully
     * @apiError (500) {null} null contact was unable to be added
     */
    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        String owner = req.getAttribute("username").toString();
        addContact(req, resp, owner);
    }

    public static void addContact(HttpServletRequest req, HttpServletResponse resp, String owner)
            throws IOException {
        JsonObject obj = gson.fromJson(req.getReader(), JsonObject.class);

        // TODO: Replace with mergetool.
        Contact contact = new Contact();
        contact.setDisplayName(obj.get("displayName").toString());
        contact.setAdded(System.currentTimeMillis() / 1000);
        contact.setRemoved(0L);
        contact.setOwner(owner);
        contact.setUri(obj.get("uri").getAsString());

        List<Contact> localList = dataStore.getContactDao().getByOwner(owner);

        List<Contact> remoteList = List.of(contact);
        List<Contact> result = ContactMerger.mergeContacts(localList, remoteList);

        if (dataStore.getContactDao().storeContactList(result)) resp.setStatus(200);
        else
            TomcatCustomErrorHandler.sendCustomError(
                    resp, 500, "A server error occurred while storing the contact.");
    }

    /**
     * @apiVersion 1.0.0
     * @api {delete} /api/auth/contacts Delete a contact
     * @apiName deleteContact
     * @apiGroup Contacts
     * @apiParam {query} uri uri of the contact to delete
     * @apiSuccess (200) {null} null contact deleted successfully
     * @apiError (500) {null} null contact was unable to be deleted
     */
    @Override
    protected void doDelete(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        String owner = req.getAttribute("username").toString();
        String uri = req.getParameter("uri");

        if (dataStore.getContactDao().removeContact(owner, uri)) resp.setStatus(200);
        else
            TomcatCustomErrorHandler.sendCustomError(
                    resp, 500, "A server error occurred while deleting the contact.");
    }

    /**
     * @apiVersion 1.0.0
     * @api {post} /api/auth/contacts Sync contact list
     * @apiName putContact
     * @apiGroup Contacts
     * @apiParam {body} Contact JSON representation of the contact object
     * @apiParamExample {json} Request-Example: [ {"uri":"tcp://def@local","added":1594742298377},
     *     {"uri":"tcp://abc@19293.com","removed":1594742298377} ]
     * @apiSuccess (200) {json} Contact[] contact added successfully
     * @apiError (500) {null} null contact was unable to be added
     */
    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        String owner = req.getAttribute("username").toString();
        addContacts(req, resp, owner);
    }

    public static void addContacts(HttpServletRequest req, HttpServletResponse resp, String owner)
            throws IOException {
        List<Contact> localList = dataStore.getContactDao().getByOwner(owner);
        List<Contact> remoteList = Arrays.asList(gson.fromJson(req.getReader(), Contact[].class));

        remoteList.forEach(contact -> contact.setOwner(owner));
        List<Contact> result = ContactMerger.mergeContacts(localList, remoteList);

        if (result.size() > 0 && !dataStore.getContactDao().storeContactList(result))
            TomcatCustomErrorHandler.sendCustomError(
                    resp, 500, "An error occurred while attempting to store contacts.");
        else {
            resp.getOutputStream().write(gson.toJson(result).getBytes());
            resp.flushBuffer();
        }
    }
}
