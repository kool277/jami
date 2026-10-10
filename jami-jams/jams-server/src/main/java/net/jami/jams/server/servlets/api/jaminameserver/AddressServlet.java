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
package net.jami.jams.server.servlets.api.jaminameserver;

import static net.jami.jams.server.Server.nameServer;

import com.google.gson.Gson;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import net.jami.jams.common.annotations.JsonContent;
import net.jami.jams.common.serialization.adapters.GsonFactory;
import net.jami.jams.common.serialization.tomcat.TomcatCustomErrorHandler;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

@WebServlet("/api/nameserver/addr/*")
public class AddressServlet extends HttpServlet {

    /**
     * @apiVersion 1.0.0
     * @api {get} /api/nameserver/addr/* Lookup user from address
     * @apiName getAddr
     * @apiGroup NameServer
     * @apiSuccess (200) {path} String username
     * @apiSuccessExample {json} Success-Response: { "name": "sidokhine6" }
     * @apiError (404) {null} null Address does not exist
     * @apiError (500) {null} null was unable to fetch user information
     */
    @Override
    @JsonContent
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        String[] path = req.getPathInfo().split("/");
        String username = nameServer.getNameFromAddress(path[path.length - 1]);
        resp.setContentType("application/json;charset=UTF-8");
        if (username == null) {
            TomcatCustomErrorHandler.sendCustomError(resp, 404, "Address not found!");
            return;
        }

        Gson gson = GsonFactory.createGson();
        Map<String, String> response = new HashMap<>();
        response.put("name", username);
        resp.getWriter().write(gson.toJson(response));
    }
}
