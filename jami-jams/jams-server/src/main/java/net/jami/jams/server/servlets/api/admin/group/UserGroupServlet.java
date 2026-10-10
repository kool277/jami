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

package net.jami.jams.server.servlets.api.admin.group;

import static net.jami.jams.server.Server.dataStore;

import com.google.gson.Gson;
import com.google.gson.JsonObject;

import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import lombok.extern.slf4j.Slf4j;

import net.jami.jams.common.annotations.JsonContent;
import net.jami.jams.common.annotations.ScopedServletMethod;
import net.jami.jams.common.objects.user.AccessLevel;
import net.jami.jams.common.objects.user.UserGroupMapping;
import net.jami.jams.common.serialization.adapters.GsonFactory;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

@WebServlet("/api/admin/group/members/*")
@Slf4j
public class UserGroupServlet extends HttpServlet {
    private final Gson gson = GsonFactory.createGson();

    /**
     * @apiVersion 1.0.0
     * @api {get} /api/admin/group/[groupId]/members/ Get JAMS groups members
     * @apiName getGroupMembers
     * @apiGroup Group
     * @apiSuccess (200) {body} Array of usernames
     * @apiSuccessExample {json} Success-Response: { "usernames": ["user1", "user2", "user3"] }
     * @apiError (404) {null} null was unable to find members for this groups
     */
    @Override
    @ScopedServletMethod(securityGroups = {AccessLevel.ADMIN})
    @JsonContent
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String groupId = req.getPathInfo().replace("/", "");
        List<UserGroupMapping> result = dataStore.getUserGroupMappingsDao().getByGroupId(groupId);
        resp.getOutputStream().write(gson.toJson(result).getBytes());
        resp.flushBuffer();
        resp.setStatus(200);
    }

    @Override
    @ScopedServletMethod(securityGroups = {AccessLevel.ADMIN})
    @JsonContent
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String groupId = req.getPathInfo().replace("/", "");

        JsonObject obj = gson.fromJson(req.getReader(), JsonObject.class);
        String username = obj.get("username").getAsString();

        Optional<UserGroupMapping> existingMapping =
                dataStore.getUserGroupMappingsDao().getByGroupIdAndUsername(groupId, username);

        if (existingMapping.isPresent()) {
            resp.sendError(HttpServletResponse.SC_CONFLICT, "The user already part of the group!");
            return;
        }

        UserGroupMapping mapping = new UserGroupMapping();
        mapping.setGroupId(groupId);
        mapping.setUsername(username);

        if (dataStore.getUserGroupMappingsDao().storeObject(mapping)) {
            resp.setStatus(200);
        } else resp.sendError(500, "Unable to add user to group!");
    }

    @Override
    @ScopedServletMethod(securityGroups = {AccessLevel.ADMIN})
    @JsonContent
    protected void doDelete(HttpServletRequest req, HttpServletResponse resp) throws IOException {

        String groupId = req.getPathInfo().replace("/", "");

        JsonObject obj = gson.fromJson(req.getReader(), JsonObject.class);
        String username = obj.get("username").getAsString();

        if (dataStore.getUserGroupMappingsDao().deleteObject(username, groupId)) {
            resp.setStatus(200);
        } else {
            resp.sendError(500, "Unable to delete mapping between user and group!");
        }
    }
}
