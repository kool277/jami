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

package net.jami.jams.server.servlets.api.admin.users;

import static net.jami.jams.server.Server.dataStore;

import com.google.gson.Gson;

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

@WebServlet("/api/admin/user/groups/*")
@Slf4j
public class UserGroupsServlet extends HttpServlet {
    private final Gson gson = GsonFactory.createGson();

    /**
     * @apiVersion 1.0.0
     * @api {get} /api/admin/user/[username]/groups/ Get JAMS user groups
     * @apiName getUserGroups
     * @apiGroup User
     * @apiSuccess (200) {body} User json user object representation
     * @apiSuccessExample {json} Success-Response: { "groups":
     *     ["a5085350-3348-11eb-adc1-0242ac120002", "abde9b76-3348-11eb-adc1-0242ac120002"] }
     * @apiError (404) {null} null was unable to find groups for this user
     */
    @Override
    @ScopedServletMethod(securityGroups = {AccessLevel.ADMIN})
    @JsonContent
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String username = req.getPathInfo().replace("/", "");
        List<UserGroupMapping> result = dataStore.getUserGroupMappingsDao().getByUsername(username);
        resp.getOutputStream().write(gson.toJson(result).getBytes());
        resp.flushBuffer();
        resp.setStatus(200);
    }
}
