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
package net.jami.jams.server.servlets.api.admin.devices;

import static net.jami.jams.server.Server.certificateAuthority;
import static net.jami.jams.server.Server.dataStore;

import com.google.gson.Gson;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import net.jami.jams.common.annotations.JsonContent;
import net.jami.jams.common.annotations.ScopedServletMethod;
import net.jami.jams.common.objects.devices.Device;
import net.jami.jams.common.objects.user.AccessLevel;
import net.jami.jams.common.serialization.adapters.GsonFactory;

import java.io.IOException;
import java.util.List;

@WebServlet("/api/admin/devices")
public class DevicesServlet extends HttpServlet {
    private final Gson gson = GsonFactory.createGson();

    // Get a list of devices for a user.
    @Override
    @ScopedServletMethod(securityGroups = {AccessLevel.ADMIN})
    @JsonContent
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        String username = req.getParameter("username");
        List<Device> devices = dataStore.getDeviceDao().getByOwner(username);
        if (certificateAuthority.getLatestCRL() != null) {
            devices.forEach(
                    device -> {
                        device.setRevoked(
                                certificateAuthority
                                                .getLatestCRL()
                                                .get()
                                                .getRevokedCertificate(
                                                        device.getCertificate().getSerialNumber())
                                        != null);
                    });
        } else devices.forEach(device -> device.setRevoked(false));

        resp.getOutputStream().write(gson.toJson(devices).getBytes());
        resp.flushBuffer();
    }
}
