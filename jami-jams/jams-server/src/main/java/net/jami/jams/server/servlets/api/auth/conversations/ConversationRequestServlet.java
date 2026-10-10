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
package net.jami.jams.server.servlets.api.auth.conversations;

import static net.jami.jams.server.Server.dataStore;

import com.google.gson.Gson;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import net.jami.jams.common.objects.conversations.Conversation;
import net.jami.jams.common.objects.conversations.ConversationRequest;
import net.jami.jams.common.serialization.adapters.GsonFactory;
import net.jami.jams.common.serialization.tomcat.TomcatCustomErrorHandler;
import net.jami.jams.common.utils.ConversationMerger;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;

@WebServlet("/api/auth/conversationRequests")
public class ConversationRequestServlet extends HttpServlet {
    private static final Gson gson = GsonFactory.createGson();

    /**
     * @apiVersion 1.0.0
     * @api {post} /api/auth/conversationRequests Sync conversationRequest list
     * @apiName postConversationRequests
     * @apiGroup ConversationRequests
     * @apiParam {body} Conversation JSON representation of the conversationRequest object
     * @apiParamExample {json} Request-Example: [
     *     {"conversationId":"1231221","received":1594742298377},
     *     {"conversationId":"213123","declined":1594742298377} ]
     * @apiSuccess (200) {json} ConversationRequest[] user's converationRequests
     * @apiError (500) {null} null contact was unable to be added
     */
    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        String owner = req.getAttribute("username").toString();
        addConversationRequests(req, resp, owner);
    }

    public static void addConversationRequests(
            HttpServletRequest req, HttpServletResponse resp, String owner) throws IOException {
        List<ConversationRequest> localList =
                dataStore.getConversationRequestDao().getByOwner(owner);
        List<Conversation> conversationList = dataStore.getConversationDao().getByOwner(owner);
        List<ConversationRequest> remoteList =
                Arrays.asList(gson.fromJson(req.getReader(), ConversationRequest[].class));

        remoteList.forEach(conversationRequest -> conversationRequest.setOwner(owner));
        List<ConversationRequest> mergedConversationRequests =
                ConversationMerger.mergeConversationRequests(localList, remoteList);

        // Conversation requests should be deleted from the database if a conversation
        // is already created
        List<ConversationRequest> filteredConversationRequests =
                dataStore
                        .getConversationRequestDao()
                        .filterConversationRequests(mergedConversationRequests, conversationList);
        if (filteredConversationRequests.size() > 0
                && !dataStore
                        .getConversationRequestDao()
                        .storeConversationRequestList(filteredConversationRequests))
            TomcatCustomErrorHandler.sendCustomError(
                    resp, 500, "Unable to store conversationRequests!");
        else {
            resp.getOutputStream().write(gson.toJson(filteredConversationRequests).getBytes());
            resp.flushBuffer();
        }
    }
}
