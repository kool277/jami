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

import static net.jami.jams.server.Server.dataStore;

import com.google.gson.Gson;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import net.jami.jams.common.annotations.ScopedServletMethod;
import net.jami.jams.common.objects.devices.Device;
import net.jami.jams.common.objects.responses.DeviceRevocationResponse;
import net.jami.jams.common.objects.user.AccessLevel;
import net.jami.jams.common.serialization.adapters.GsonFactory;
import net.jami.jams.server.core.workflows.RevokeDeviceFlow;

import java.io.IOException;

@WebServlet("/api/admin/device")
public class DeviceServlet extends HttpServlet {
    private final Gson gson = GsonFactory.createGson();

    // Get a detailed device info.
    @Override
    @ScopedServletMethod(securityGroups = {AccessLevel.ADMIN})
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        String username = req.getParameter("username");
        String deviceId = req.getParameter("deviceId");
        Device device =
                dataStore.getDeviceDao().getByDeviceIdAndOwner(deviceId, username).orElseThrow();
        resp.getOutputStream().write(gson.toJson(device).getBytes());
        resp.flushBuffer();
    }

    // Update device data.
    @Override
    @ScopedServletMethod(securityGroups = {AccessLevel.ADMIN})
    protected void doPut(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        String username = req.getParameter("username");
        String deviceId = req.getParameter("deviceId");
        String deviceName = req.getParameter("deviceName");

        if (dataStore.getDeviceDao().updateObject(deviceName, username, deviceId))
            resp.setStatus(200);
        else resp.sendError(500, "An error occurred while updating device information!");
    }

    // Revoke/delete/remove device.
    @Override
    @ScopedServletMethod(securityGroups = {AccessLevel.ADMIN})
    protected void doDelete(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        String username = req.getParameter("username");
        String deviceId = req.getParameter("deviceId");
        DeviceRevocationResponse devResponse = RevokeDeviceFlow.revokeDevice(username, deviceId);
        if (devResponse != null) {
            resp.getOutputStream().write(gson.toJson(devResponse).getBytes());
            resp.flushBuffer();
        } else resp.sendError(500, "An error occurred while revoking device!");
    }
}
