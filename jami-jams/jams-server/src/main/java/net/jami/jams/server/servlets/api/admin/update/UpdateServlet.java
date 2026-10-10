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
package net.jami.jams.server.servlets.api.admin.update;

import static net.jami.jams.server.Server.appUpdater;

import com.google.gson.Gson;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import net.jami.jams.common.annotations.JsonContent;
import net.jami.jams.common.annotations.ScopedServletMethod;
import net.jami.jams.common.objects.user.AccessLevel;
import net.jami.jams.common.serialization.adapters.GsonFactory;
import net.jami.jams.common.updater.FullSystemStatusResponse;

import java.io.IOException;

@WebServlet("/api/admin/update")
public class UpdateServlet extends HttpServlet {
    private final Gson gson = GsonFactory.createGson();

    // Return the current version number and the available version number.
    @Override
    @ScopedServletMethod(securityGroups = {AccessLevel.ADMIN})
    @JsonContent
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        FullSystemStatusResponse response = new FullSystemStatusResponse();
        response.setLocalVersions(appUpdater.getLocalVersions());
        response.setRemoteVersions(appUpdater.getRemoteVersions());
        response.setUpdateAvailable(appUpdater.getUpdateAvailable());
        resp.getOutputStream().write(gson.toJson(response).getBytes());
        resp.flushBuffer();
    }

    // This is the do-update button.
    @Override
    @ScopedServletMethod(securityGroups = {AccessLevel.ADMIN})
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) {
        if (appUpdater.getUpdateAvailable()) appUpdater.doUpdate();
    }
}
