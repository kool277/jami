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

import net.jami.jams.common.jami.NameLookupResponse;
import net.jami.jams.common.serialization.adapters.GsonFactory;
import net.jami.jams.common.serialization.tomcat.TomcatCustomErrorHandler;

import java.io.IOException;

@WebServlet("/api/nameserver/name/*")
public class NameServlet extends HttpServlet {
    private final Gson gson = GsonFactory.createGson();

    /**
     * @apiVersion 1.0.0
     * @api {get} /api/nameserver/name/* Look up a user on the name server
     * @apiName getName
     * @apiGroup NameServer
     * @apiSuccess (200) {path} String username
     * @apiSuccessExample {json} Success-Response: { "publickey": "", "signature": "", "name":
     *     "sidokhine6", "addr": "0d1f0002ce728d6aa8b98b5227c75fc773735f9e" }
     * @apiError (404) {null} null user does not exist
     * @apiError (500) {null} null was unable to fetch user information
     */
    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        NameLookupResponse nameLookupResponse =
                nameServer.getAddressFromName(req.getPathInfo().replace("/", ""));
        resp.setContentType("application/json;charset=UTF-8");
        if (nameLookupResponse == null)
            TomcatCustomErrorHandler.sendCustomError(resp, 404, "name not found");
        else {
            resp.getOutputStream().write(gson.toJson(nameLookupResponse).getBytes());
            resp.flushBuffer();
        }
    }
}
