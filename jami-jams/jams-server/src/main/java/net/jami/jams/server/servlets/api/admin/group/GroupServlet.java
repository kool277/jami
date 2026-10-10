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

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import lombok.extern.slf4j.Slf4j;

import net.jami.jams.common.annotations.JsonContent;
import net.jami.jams.common.annotations.ScopedServletMethod;
import net.jami.jams.common.objects.user.AccessLevel;
import net.jami.jams.common.objects.user.Group;
import net.jami.jams.common.serialization.adapters.GsonFactory;

import java.io.IOException;
import java.util.Optional;

@WebServlet("/api/admin/group/*")
@Slf4j
public class GroupServlet extends HttpServlet {
    private final Gson gson = GsonFactory.createGson();

    @Override
    @ScopedServletMethod(securityGroups = {AccessLevel.ADMIN})
    @JsonContent
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        String id = req.getPathInfo().replace("/", "");

        Optional<Group> singleGroup = dataStore.getGroupDao().getById(id);

        if (singleGroup.isPresent()) {
            resp.getOutputStream().write(gson.toJson(singleGroup.orElseThrow()).getBytes());
            resp.flushBuffer();
            resp.setStatus(200);
        } else {
            log.info("No group with this id was found!");
            resp.setStatus(404);
        }
    }

    @Override
    @ScopedServletMethod(securityGroups = {AccessLevel.ADMIN})
    @JsonContent
    protected void doPut(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String id = req.getPathInfo().replace("/", "");

        JsonObject obj = gson.fromJson(req.getReader(), JsonObject.class);

        String name = obj.get("name").getAsString();
        String blueprint = obj.get("blueprint").getAsString();

        if (dataStore.getGroupDao().updateObject(id, name, blueprint)) resp.setStatus(200);
        else resp.sendError(500, "An error occurred while attempting to update the group.");
    }

    @Override
    @ScopedServletMethod(securityGroups = {AccessLevel.ADMIN})
    @JsonContent
    protected void doDelete(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String groupId = req.getPathInfo().replace("/", "");

        if (dataStore.getGroupDao().deleteObject(groupId)) {
            if (dataStore.getUserGroupMappingsDao().deleteObject("*", groupId)) resp.setStatus(200);
            else
                resp.sendError(
                        500, "An error occurred while attempting to delete the group mappings.");
        } else {
            resp.sendError(500, "An error occurred while attempting to delete the group.");
        }
    }
}
