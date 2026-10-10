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

package net.jami.jams.server.servlets.api.admin.directory;

import static net.jami.jams.server.Server.dataStore;
import static net.jami.jams.server.Server.userAuthenticationModule;

import com.google.gson.Gson;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import lombok.extern.slf4j.Slf4j;

import net.jami.jams.common.annotations.JsonContent;
import net.jami.jams.common.annotations.ScopedServletMethod;
import net.jami.jams.common.authentication.AuthenticationSourceType;
import net.jami.jams.common.authmodule.AuthModuleKey;
import net.jami.jams.common.objects.user.AccessLevel;
import net.jami.jams.common.objects.user.User;
import net.jami.jams.common.objects.user.UserProfile;
import net.jami.jams.common.serialization.adapters.GsonFactory;

import java.io.IOException;
import java.util.HashMap;

@Slf4j
@WebServlet("/api/admin/directory/entry")
public class DirectoryEntryServlet extends HttpServlet {
    private final Gson gson = GsonFactory.createGson();

    @Override
    @ScopedServletMethod(securityGroups = {AccessLevel.ADMIN})
    @JsonContent
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        // Create a user profile.
        String realm = "LOCAL";
        UserProfile userProfile = gson.fromJson(req.getReader(), UserProfile.class);

        userAuthenticationModule
                .getAuthSources()
                .get(new AuthModuleKey(realm, AuthenticationSourceType.LOCAL))
                .setUserProfile(userProfile);
        resp.setStatus(200);
        HashMap<String, String> profileName = new HashMap<>();
        profileName.put("username", userProfile.getUsername());
        resp.getOutputStream().write(gson.toJson(profileName).getBytes());
        resp.flushBuffer();
    }

    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse resp)
            throws IOException, SecurityException {
        // Update a user's profile.
        // Check if he is AD/LDAP - then return a 500, because we are unable to update those profile
        // datas.
        UserProfile userProfile = gson.fromJson(req.getReader(), UserProfile.class);

        String username = req.getAttribute("username").toString();

        User targetUser =
                dataStore.getUserDao().getByUsername(userProfile.getUsername()).orElseThrow();
        User callingUser = dataStore.getUserDao().getByUsername(username).orElseThrow();

        if (targetUser.getUserType() != AuthenticationSourceType.LOCAL) {
            resp.sendError(
                    403,
                    "The user is not a local user, therefore we are unable to change his data!");
            return;
        }

        if (callingUser.getAccessLevel() == AccessLevel.ADMIN
                || (callingUser.getAccessLevel() == AccessLevel.USER
                        && callingUser.getUsername().equals(targetUser.getUsername()))) {
            if (dataStore.updateUserProfile(userProfile)) resp.setStatus(200);
            else resp.sendError(500, "Unable to update the user's profile information");

            return;
        }
        resp.sendError(
                403,
                "The user is either not an admin account or is attempting to edit a profile that is not his own!");
    }

    @Override
    @ScopedServletMethod(securityGroups = {AccessLevel.ADMIN})
    protected void doDelete(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        // This method will probably never be implemented.
    }
}
