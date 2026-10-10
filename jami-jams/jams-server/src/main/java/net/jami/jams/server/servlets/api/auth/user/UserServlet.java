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
package net.jami.jams.server.servlets.api.auth.user;

import static net.jami.jams.server.Server.certificateAuthority;
import static net.jami.jams.server.Server.dataStore;

import com.google.gson.Gson;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import net.jami.jams.common.annotations.ScopedServletMethod;
import net.jami.jams.common.authentication.AuthenticationSourceType;
import net.jami.jams.common.objects.user.AccessLevel;
import net.jami.jams.common.objects.user.User;
import net.jami.jams.common.serialization.adapters.GsonFactory;

import java.io.IOException;
import java.util.Optional;

@WebServlet("/api/auth/user")
public class UserServlet extends HttpServlet {
    private final Gson gson = GsonFactory.createGson();

    // User can "read" himself.
    /**
     * @apiVersion 1.0.0
     * @api {get} /api/auth/user Get JAMS user info
     * @apiName getUser
     * @apiGroup User
     * @apiSuccess (200) {body} User json user object representation
     * @apiSuccessExample {json} Success-Response: { "username":"jdoe", "password":null,
     *     "userType":"AD", "realm":"savoirfairelinux", "accessLevel":"USER",
     *     "needsPasswordReset":false, "ethAddress":"8272773ac", "ethKey":"192938ae72772ab",
     *     "jamiId":"6e3552723df", "certificate":"pem_formatted_certificate",
     *     "privateKey":"pem_formatted_key", "revoked":false }
     * @apiError (500) {null} null was unable to fetch user information
     */
    @Override
    @ScopedServletMethod(securityGroups = {AccessLevel.USER})
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        String username = req.getAttribute("username").toString();
        Optional<User> result = dataStore.getUserDao().getByUsername(username);
        if (result.isEmpty()) {
            resp.sendError(404, "User was not found!");
            return;
        }

        User user = result.get();
        if (certificateAuthority.getLatestCRL().get() != null) {
            user.setRevoked(
                    certificateAuthority
                                    .getLatestCRL()
                                    .get()
                                    .getRevokedCertificate(user.getCertificate().getSerialNumber())
                            != null);
        } else user.setRevoked(false);
        resp.setStatus(200);
        resp.getOutputStream().write(gson.toJson(user).getBytes());
        resp.flushBuffer();
    }

    // The user can update 3 fields: password,privatekey,publickey
    // For now we do not consider the possibility for privatekey, publickey for other reasons.
    /**
     * @apiVersion 1.0.0
     * @api {put} /api/auth/user Modify the user's info (for now just the password)
     * @apiName putUser
     * @apiGroup User
     * @apiParam {query} password new password
     * @apiSuccess (200) {null} null password changed successfully
     * @apiError (500) {null} null was unable to change password
     */
    @Override
    @ScopedServletMethod(securityGroups = AccessLevel.USER)
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String username = req.getAttribute("username").toString();

        // Check if he is AD/LDAP - then return a 403, because we are unable to set such password.
        User user = dataStore.getUserDao().getByUsername(username).orElseThrow();
        if (user.getUserType() != AuthenticationSourceType.LOCAL) {
            resp.sendError(403, "Unable to change user data as user is not a local user.");
            return;
        }

        String password = req.getParameter("password");

        if (dataStore.getUserDao().updateObject(password, username)) resp.setStatus(200);
        else
            resp.sendError(
                    500, "An error occurred while attempting to update the user's data field.");
    }
}
