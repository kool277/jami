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
import net.jami.jams.common.serialization.adapters.GsonFactory;
import net.jami.jams.common.serialization.tomcat.TomcatCustomErrorHandler;
import net.jami.jams.common.utils.ConversationMerger;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;

@WebServlet("/api/auth/conversations")
public class ConversationServlet extends HttpServlet {
    private static final Gson gson = GsonFactory.createGson();

    /**
     * @apiVersion 1.0.0
     * @api {post} /api/auth/conversations Sync conversation list
     * @apiName postConversations
     * @apiGroup Conversations
     * @apiParam {body} Conversation JSON representation of the conversation object
     * @apiParamExample {json} Request-Example: [ {"id":"1231221","created":1594742298377},
     *     {"id":"213123","removed":1594742298377} ]
     * @apiSuccess (200) {json} Conversation[] user's conversations
     * @apiError (500) {null} null conversation was unable to be synced
     */
    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        String owner = req.getAttribute("username").toString();
        addConversations(req, resp, owner);
    }

    public static void addConversations(
            HttpServletRequest req, HttpServletResponse resp, String owner) throws IOException {
        List<Conversation> remoteList =
                Arrays.asList(gson.fromJson(req.getReader(), Conversation[].class));
        List<Conversation> localList = dataStore.getConversationDao().getByOwner(owner);
        remoteList.forEach(conversation -> conversation.setOwner(owner));
        List<Conversation> result = ConversationMerger.mergeConversations(localList, remoteList);

        if (result.size() > 0 && !dataStore.getConversationDao().storeConversationList(result))
            TomcatCustomErrorHandler.sendCustomError(resp, 500, "Unable to store conversations!");
        else {
            resp.getOutputStream().write(gson.toJson(result).getBytes());
            resp.flushBuffer();
        }
    }
}
