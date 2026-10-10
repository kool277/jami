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
package net.jami.jams.server.servlets.x509;

import static net.jami.jams.server.Server.dataStore;

import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import net.jami.jams.ca.JamsCA;
import net.jami.jams.common.objects.devices.Device;
import net.jami.jams.common.objects.user.User;

import org.bouncycastle.cert.ocsp.OCSPReq;
import org.bouncycastle.cert.ocsp.OCSPResp;
import org.bouncycastle.cert.ocsp.Req;

import java.io.IOException;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.List;

@WebServlet("/api/ocsp/*")
public class OCSPServlet extends HttpServlet {

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        resp.setContentType("application/ocsp-response");
        byte[] content = new byte[Integer.parseInt(req.getHeader("Content-Length"))];
        try {
            for (int i = 0; i < content.length; i++) req.getInputStream().read(content);

            OCSPReq ocspReq = new OCSPReq(content);
            List<BigInteger> ids = new ArrayList<>();

            for (Req request : ocspReq.getRequestList())
                ids.add(request.getCertID().getSerialNumber());

            String issuerId = req.getPathInfo().replace("/", "");

            /*
             * If there is no issuerId we are dealing with a certificate signed by the CA
             * root
             * Else the certificate is a device certificate signed by a user with and the
             * issuerId is his Jami Id
             */

            if (issuerId == "") {
                OCSPResp response =
                        JamsCA.getOCSPResponse(
                                ocspReq,
                                JamsCA.CA.getCertificate(),
                                JamsCA.CA.getPrivateKey(),
                                false);

                if (response != null) {
                    byte[] respBytes = response.getEncoded();
                    resp.getOutputStream().write(respBytes);
                    resp.flushBuffer();
                } else resp.setStatus(404);

                return;
            }

            User targetUser = dataStore.getUserDao().getByJamiId(issuerId).get(0);
            List<Device> devices = dataStore.getDeviceDao().getByOwner(targetUser.getUsername());

            boolean deviceDoesNotExist = true;
            for (Device d : devices) {
                for (BigInteger id : ids) {
                    if (d.getCertificate().getSerialNumber().equals(id)) {
                        deviceDoesNotExist = false;
                    }
                }
            }
            OCSPResp response =
                    JamsCA.getOCSPResponse(
                            ocspReq,
                            targetUser.getCertificate(),
                            targetUser.getPrivateKey(),
                            deviceDoesNotExist);

            if (response != null) {
                byte[] respBytes = response.getEncoded();
                resp.getOutputStream().write(respBytes);
                resp.flushBuffer();
            } else resp.setStatus(404);

        } catch (Exception e) {
            resp.sendError(404, "Unable to find the requested certificate!");
        }
    }
}
