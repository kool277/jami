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
package net.jami.jams.server.servlets.api.auth.device;

import static net.jami.jams.server.Server.certificateAuthority;
import static net.jami.jams.server.Server.dataStore;

import com.google.gson.Gson;
import com.google.gson.JsonObject;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import net.jami.jams.common.annotations.ScopedServletMethod;
import net.jami.jams.common.objects.devices.Device;
import net.jami.jams.common.objects.requests.DeviceRegistrationRequest;
import net.jami.jams.common.objects.responses.DeviceRegistrationResponse;
import net.jami.jams.common.objects.responses.DeviceRevocationResponse;
import net.jami.jams.common.objects.user.AccessLevel;
import net.jami.jams.common.serialization.adapters.GsonFactory;
import net.jami.jams.common.serialization.tomcat.TomcatCustomErrorHandler;
import net.jami.jams.server.core.workflows.RegisterDeviceFlow;
import net.jami.jams.server.core.workflows.RevokeDeviceFlow;

import java.io.IOException;

@WebServlet("/api/auth/device/*")
public class DeviceServlet extends HttpServlet {
    private final Gson gson = GsonFactory.createGson();

    /**
     * @apiVersion 1.0.0
     * @api {get} /api/auth/device Get device info
     * @apiName getDevice
     * @apiGroup Device
     * @apiParam {path} deviceId id of the device
     * @apiSuccess (200) {body} Device device information
     * @apiSuccessExample {json} Success-Response: { "certificate":"pem_encoded_certificate",
     *     "displayName":"My Galaxy S8", "deviceId":"6aec6252ad", "revoked":true }
     * @apiError (500) {null} null Device was unable to be retrieved
     */
    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        String username = req.getAttribute("username").toString();
        String deviceId = req.getPathInfo().replace("/", "");

        Device device =
                dataStore.getDeviceDao().getByDeviceIdAndOwner(deviceId, username).orElseThrow();

        if (certificateAuthority.getLatestCRL().get() != null)
            device.setRevoked(
                    certificateAuthority
                                    .getLatestCRL()
                                    .get()
                                    .getRevokedCertificate(
                                            device.getCertificate().getSerialNumber())
                            != null);
        else device.setRevoked(false);

        resp.getOutputStream().write(gson.toJson(device).getBytes());
        resp.flushBuffer();
    }

    /**
     * @apiVersion 1.0.0
     * @api {post} /api/auth/device Enroll a device
     * @apiName postDevice
     * @apiGroup Device
     * @apiParam {body} DeviceRegistrationRequest device registration request
     * @apiParamExample {json} Request-Example: { "csr":"pem_encoded_csr", "deviceName":"My Galaxy
     *     S8" }
     * @apiSuccess (200) {body} DeviceRegistrationResponse registration response
     * @apiError (500) {null} null Device was unable to be enrolled
     * @apiSuccessExample {json} Success-Response: {
     *     "certificateChain":"pem_encoded_certificate_chain", "displayName":"John Doe",
     *     "nameServer":"https://mydomain.com", "deviceReceipt": "device_receipt_object",
     *     "receiptSignature":"receipt_signature_object", "userPhoto":"base64_encoded_photo" }
     */
    @Override
    @ScopedServletMethod(securityGroups = {AccessLevel.USER})
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        Gson gson = GsonFactory.createGson();
        String username = req.getAttribute("username").toString();

        DeviceRegistrationRequest request =
                gson.fromJson(req.getReader(), DeviceRegistrationRequest.class);
        DeviceRegistrationResponse devResponse =
                RegisterDeviceFlow.registerDevice(username, request);

        if (devResponse == null) {
            TomcatCustomErrorHandler.sendCustomError(
                    resp, 500, "A server error occurred while enrolling the device.");
            return;
        }

        String filteredJson = gson.toJson(devResponse);
        JsonObject obj = gson.fromJson(filteredJson, JsonObject.class);

        renameKeys(obj);

        resp.getOutputStream().write((obj.toString()).getBytes());
        resp.flushBuffer();
    }

    /**
     * Modifies in place obj to rename a key
     *
     * @param obj
     * @param oldKey
     * @param newKey
     */
    private static void renameKey(JsonObject obj, String oldKey, String newKey) {
        if (obj.get(oldKey) != null) {
            obj.add(newKey, obj.get(oldKey));
            obj.remove(oldKey);
        }
    }

    /**
     * Modifies in place obj to rename keys
     *
     * @param obj
     */
    public static void renameKeys(JsonObject obj) {
        renameKey(obj, "videoEnabled", "Account.videoEnabled");
        renameKey(obj, "publicInCalls", "DHTRelay.PublicInCalls");
        renameKey(obj, "autoAnswer", "Account.autoAnswer");
        renameKey(obj, "peerDiscovery", "Account.peerDiscovery");
        renameKey(obj, "accountDiscovery", "Account.accountDiscovery");
        renameKey(obj, "accountPublish", "Account.accountPublish");

        renameKey(obj, "rendezVous", "Account.rendezVous");
        renameKey(obj, "upnpEnabled", "Account.upnpEnabled");

        renameKey(obj, "turnEnabled", "TURN.enable");
        renameKey(obj, "turnServer", "TURN.server");
        renameKey(obj, "turnServerUserName", "TURN.username");
        renameKey(obj, "turnServerPassword", "TURN.password");
        renameKey(obj, "proxyEnabled", "Account.proxyEnabled");
        renameKey(obj, "proxyServer", "Account.proxyServer");
        renameKey(obj, "dhtProxyListUrl", "Account.dhtProxyListUrl");
        renameKey(obj, "displayName", "Account.displayName");
        renameKey(obj, "defaultModerators", "Account.defaultModerators");
        renameKey(obj, "uiCustomization", "Account.uiCustomization");
    }

    /**
     * @apiVersion 1.0.0
     * @api {put} /api/auth/device Change the name of a device
     * @apiName putDevice
     * @apiGroup Device
     * @apiParam {path} deviceId id of the device
     * @apiParam {query} deviceName new name for the device
     * @apiSuccess (200) {null} null name changed successfully
     * @apiError (500) {null} null device name was unable to be changed
     */
    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        String username = req.getAttribute("username").toString();
        String deviceId = req.getPathInfo().replace("/", "");
        String deviceName = req.getParameter("deviceName");

        if (dataStore.getDeviceDao().updateObject(deviceName, username, deviceId))
            resp.setStatus(200);
        else
            TomcatCustomErrorHandler.sendCustomError(
                    resp, 500, "A server error occurred while updating the device information.");
    }

    /**
     * @apiVersion 1.0.0
     * @api {delete} /api/auth/device Deactivate a device
     * @apiName deleteDevice
     * @apiGroup Device
     * @apiParam {path} deviceId id of the device
     * @apiSuccess (200) {null} null device deactivated successfully
     * @apiError (500) {null} null device was unable to be deactivated
     */
    @Override
    @ScopedServletMethod(securityGroups = {AccessLevel.USER})
    protected void doDelete(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        String deviceId = req.getPathInfo().replace("/", "");
        // If the device does not belong to the user throw a 403
        String owner = req.getAttribute("username").toString();

        long deviceIdCount =
                dataStore.getDeviceDao().getByOwner(owner).stream()
                        .filter(device -> device.getDeviceId().equals(deviceId))
                        .count();

        if (deviceIdCount == 0) {
            TomcatCustomErrorHandler.sendCustomError(
                    resp, 403, "You do not have sufficient rights to revoke this device!");
            return;
        }

        DeviceRevocationResponse devResponse = RevokeDeviceFlow.revokeDevice(owner, deviceId);
        if (devResponse != null) {
            resp.getOutputStream().write(gson.toJson(devResponse).getBytes());
            resp.flushBuffer();
        } else
            TomcatCustomErrorHandler.sendCustomError(
                    resp, 500, "A server error occurred while revoking the device.");
    }
}
