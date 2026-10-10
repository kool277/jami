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
package net.jami.jams.server.servlets.api.install;

import static net.jami.jams.server.Server.userAuthenticationModule;

import com.google.gson.Gson;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import lombok.extern.slf4j.Slf4j;

import net.jami.jams.common.annotations.ScopedServletMethod;
import net.jami.jams.common.authentication.AuthenticationSourceType;
import net.jami.jams.common.objects.requests.CreateAuthSourceRequest;
import net.jami.jams.common.objects.user.AccessLevel;
import net.jami.jams.common.serialization.adapters.GsonFactory;

import java.io.IOException;

@WebServlet("/api/install/auth")
@Slf4j
public class CreateAuthSourceServlet extends HttpServlet {
    private final Gson gson = GsonFactory.createGson();

    @Override
    @ScopedServletMethod(securityGroups = {AccessLevel.ADMIN})
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        super.doGet(req, resp);
    }

    @Override
    @ScopedServletMethod(securityGroups = {AccessLevel.ADMIN})
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        CreateAuthSourceRequest authSourceRequest =
                gson.fromJson(req.getReader(), CreateAuthSourceRequest.class);
        CachedObjects.localAuthSettings = null;
        CachedObjects.activeDirectorySettings = null;
        CachedObjects.ldapSettings = null;
        boolean error = false;
        switch (authSourceRequest.getType()) {
            case LOCAL:
                CachedObjects.localAuthSettings = authSourceRequest.getLocalAuthSettings();
                break;
            case LDAP:
                if (userAuthenticationModule.testModuleConfiguration(
                        AuthenticationSourceType.LDAP,
                        gson.toJson(authSourceRequest.getLdapSettings()))) {
                    CachedObjects.ldapSettings = authSourceRequest.getLdapSettings();
                } else error = true;
                break;
            case AD:
                if (userAuthenticationModule.testModuleConfiguration(
                        AuthenticationSourceType.AD,
                        gson.toJson(authSourceRequest.getActiveDirectorySettings()))) {
                    CachedObjects.activeDirectorySettings =
                            authSourceRequest.getActiveDirectorySettings();
                } else error = true;
                break;
        }
        if (error)
            resp.sendError(
                    500,
                    "The supplied configuration is invalid or the connectivity tests has failed");
        else CachedObjects.endpoint = "/api/install/settings";
    }
}
