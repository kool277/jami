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
package net.jami.jams.server.servlets.api.admin.contacts;

import static net.jami.jams.server.Server.dataStore;

import com.google.gson.Gson;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import net.jami.jams.common.annotations.JsonContent;
import net.jami.jams.common.annotations.ScopedServletMethod;
import net.jami.jams.common.objects.contacts.Contact;
import net.jami.jams.common.objects.user.AccessLevel;
import net.jami.jams.common.serialization.adapters.GsonFactory;
import net.jami.jams.common.serialization.tomcat.TomcatCustomErrorHandler;

import java.io.IOException;
import java.util.List;

@WebServlet("/api/admin/contacts")
public class ContactServlet extends HttpServlet {
    private final Gson gson = GsonFactory.createGson();

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
    @ScopedServletMethod(securityGroups = {AccessLevel.ADMIN})
    @JsonContent
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        String username = req.getParameter("username");
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
    @ScopedServletMethod(securityGroups = {AccessLevel.ADMIN})
    protected void doPut(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        String username = req.getParameter("username");
        net.jami.jams.server.servlets.api.auth.contacts.ContactServlet.addContact(
                req, resp, username);
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
    @ScopedServletMethod(securityGroups = {AccessLevel.ADMIN})
    protected void doDelete(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        String owner = req.getParameter("username");
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
    @ScopedServletMethod(securityGroups = {AccessLevel.ADMIN})
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        String username = req.getParameter("username");
        net.jami.jams.server.servlets.api.auth.contacts.ContactServlet.addContacts(
                req, resp, username);
    }
}
