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
package net.jami.jams.server.servlets.api.auth.policyData;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import net.jami.jams.common.serialization.tomcat.TomcatCustomErrorHandler;
import net.jami.jams.server.core.workflows.RegisterDeviceFlow;
import net.jami.jams.server.servlets.api.auth.device.DeviceServlet;

import java.io.IOException;

@WebServlet("/api/auth/policyData")
public class PolicyDataServlet extends HttpServlet {

    /**
     * @apiVersion 1.0.0
     * @api {get} /api/auth/policyData Get policy data
     * @apiName getPolicyData
     * @apiGroup Policy Data
     * @apiSuccess (200) {body} Policy Data
     * @apiSuccessExample {json} Success-Response: [{ "allowCertFromHistory": true, "allowLookup":
     *     true, "allowCertFromContact": true, "allowCertFromTrusted": true, "Account.videoEnabled":
     *     true, "DHTRelay.PublicInCalls": false, "Account.autoAnswer": false,
     *     "Account.peerDiscovery": true, "Account.accountDiscovery": false,
     *     "Account.accountPublish": false, "Account.rendezVous": false, "Account.upnpEnabled":
     *     true, "Account.defaultModerators": "", "Account.uiCustomization":
     *     "{\"areTipsEnabled\":false,\"backgroundType\":\"default\"}" }]
     * @apiError (404) {null} null Policy Data was unable to be retrieved
     * @apiError (500) {null} null Policy Data was unable to be retrieved
     */
    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        String username = req.getAttribute("username").toString();

        String policyData = RegisterDeviceFlow.getPolicyData(username);

        if (policyData == null) {
            TomcatCustomErrorHandler.sendCustomError(
                    resp, 404, "Policy Data not found for this user");
            return;
        }

        JsonObject obj = JsonParser.parseString(policyData).getAsJsonObject();
        DeviceServlet.renameKeys(obj);

        resp.getOutputStream().write(obj.toString().getBytes());
        resp.flushBuffer();
        resp.setStatus(200);
    }
}
