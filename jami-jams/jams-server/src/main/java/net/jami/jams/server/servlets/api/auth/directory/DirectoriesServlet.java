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
package net.jami.jams.server.servlets.api.auth.directory;

import static net.jami.jams.server.Server.userAuthenticationModule;

import com.google.gson.Gson;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import net.jami.jams.common.annotations.JsonContent;
import net.jami.jams.common.serialization.adapters.GsonFactory;

import java.io.IOException;

@WebServlet("/api/auth/directories")
public class DirectoriesServlet extends HttpServlet {
    private final Gson gson = GsonFactory.createGson();

    /**
     * @apiVersion 1.0.0
     * @api {get} /api/auth/directories Return the list of directories
     * @apiName getDirectories
     * @apiGroup Directories
     * @apiSuccess (200) {body} AuthModuleKey[] array of available authentication sources
     * @apiSuccessExample {json} Success-Response: [{ "realm":"savoirfairelinux", "type":"LDAP" }, {
     *     "realm":"LOCAL", "type":"LOCAL" }, ... { "realm":"savoirfairelinux-ad", "type":"AD" }]
     * @apiError (500) {null} null was unable to return any authentication sources
     */
    @Override
    @JsonContent
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        resp.getOutputStream()
                .write(gson.toJson(userAuthenticationModule.getAuthSources().keySet()).getBytes());
    }
}
