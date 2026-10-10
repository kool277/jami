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

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import lombok.extern.slf4j.Slf4j;

import net.jami.jams.common.annotations.JsonContent;
import net.jami.jams.common.annotations.ScopedServletMethod;
import net.jami.jams.common.objects.user.AccessLevel;
import net.jami.jams.common.objects.user.Group;

import java.io.IOException;
import java.util.UUID;

@WebServlet("/api/admin/group")
@Slf4j
public class AddGroupServlet extends HttpServlet {

    @Override
    @ScopedServletMethod(securityGroups = {AccessLevel.ADMIN})
    @JsonContent
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        Group group = new Group();
        UUID uuid = UUID.randomUUID();
        group.setId(uuid.toString());

        JsonObject body = JsonParser.parseReader(req.getReader()).getAsJsonObject();
        group.setName(body.get("name").getAsString());
        group.setBlueprint(body.get("blueprintName").getAsString());

        if (dataStore.getGroupDao().storeObject(group)) {
            JsonObject data = new JsonObject();
            data.addProperty("id", uuid.toString());
            resp.getOutputStream().write(data.toString().getBytes());
            resp.flushBuffer();
            resp.setStatus(200);
        } else resp.sendError(500, "An error occurred while attempting to create the group.");
    }
}
