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
package net.jami.jams.server.servlets;

import static net.jami.jams.server.Server.certificateAuthority;
import static net.jami.jams.server.Server.dataStore;
import static net.jami.jams.server.servlets.api.auth.login.AuthRequestProcessor.processUsernamePasswordAuth;
import static net.jami.jams.server.servlets.api.auth.login.AuthRequestProcessor.processX509Auth;

import com.google.gson.Gson;

import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import net.jami.jams.ca.JamsCA;
import net.jami.jams.common.annotations.JsonContent;
import net.jami.jams.common.authmodule.AuthTokenResponse;
import net.jami.jams.common.objects.user.User;
import net.jami.jams.common.serialization.adapters.GsonFactory;
import net.jami.jams.common.serialization.tomcat.TomcatCustomErrorHandler;
import net.jami.jams.server.servlets.api.auth.login.LoginRequest;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.util.Base64;
import java.util.Optional;

@WebServlet("/api/login")
// This method returns the token which is used for all the next calls to the
// API.
public class LoginServlet extends HttpServlet {
    private final Gson gson = GsonFactory.createGson();

    /**
     * @apiVersion 1.0.0
     * @api {post} /api/login Obtain an 0Auth token
     * @apiName postLogin
     * @apiGroup Login
     * @apiParam {header} [authorization] classical HTTP auth header
     * @apiParam {attribute} [X509Certificate] X509 User certificate
     * @apiParam {body} [LoginRequest] username/password sent to server as JSON object
     * @apiSuccess (200) {body} AuthTokenResponse the 0Auth authentication token
     * @apiError (403) {null} null The user is unauthorized
     */
    @Override
    @JsonContent
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        AuthTokenResponse res = null;
        // Case 1: Authorization header.
        if (req.getHeader("authorization") != null) {
            res = processUsernamePasswordAuth(req.getHeader("authorization"));
        }
        // Case 2 SSL Certificate
        String clientCert = req.getHeader("X-Client-Cert");
        if (JamsCA.reverseProxy && clientCert != null) {
            try {
                // URL-decode the header value
                String decodedHeader = URLDecoder.decode(clientCert, StandardCharsets.UTF_8.name());

                // Remove the PEM header and footer
                String pem =
                        decodedHeader
                                .replace("-----BEGIN CERTIFICATE-----", "")
                                .replace("-----END CERTIFICATE-----", "")
                                .replaceAll("\\s+", ""); // Remove all whitespace characters

                // Decode the Base64 encoded certificate
                byte[] decodedBytes = Base64.getDecoder().decode(pem);

                // Generate the X509Certificate object
                CertificateFactory factory = CertificateFactory.getInstance("X.509");
                InputStream in = new ByteArrayInputStream(decodedBytes);
                X509Certificate certificate = (X509Certificate) factory.generateCertificate(in);

                // Process the certificate as needed
                res = processX509Auth(certificate);
            } catch (Exception e) {
                e.printStackTrace();
            }
        } else if (req.getAttribute("jakarta.servlet.request.X509Certificate") != null) {
            res =
                    processX509Auth(
                            (X509Certificate[])
                                    req.getAttribute("jakarta.servlet.request.X509Certificate"));
        } else {
            // Case 4: form submitted username/password
            LoginRequest object = gson.fromJson(req.getReader(), LoginRequest.class);
            if (object.getUsername() != null && object.getPassword() != null) {
                res = processUsernamePasswordAuth(object.getUsername(), object.getPassword());
                Optional<User> user = dataStore.getUserDao().getByUsername(object.getUsername());
                if (user.isPresent()
                        && certificateAuthority.getLatestCRL().get() != null
                        && !user.get().getAccessLevelName().equals("ADMIN")
                        && certificateAuthority
                                        .getLatestCRL()
                                        .get()
                                        .getRevokedCertificate(
                                                user.get().getCertificate().getSerialNumber())
                                != null) {
                    TomcatCustomErrorHandler.sendCustomError(
                            resp, 401, "Invalid credentials provided!");
                }
            }
        }
        resp.setContentType("application/json;charset=UTF-8");
        if (res == null)
            TomcatCustomErrorHandler.sendCustomError(resp, 401, "Invalid credentials provided!");
        else {
            resp.getOutputStream().write(gson.toJson(res).getBytes());
            resp.flushBuffer();
        }
    }
}
