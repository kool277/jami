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

import static net.jami.jams.server.Server.certificateAuthority;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;

@WebServlet("/api/auth/crl")
public class CRLServlet extends HttpServlet {

    private static final String CRL_HEAD = "-----BEGIN X509 CRL-----\n";
    private static final String CRL_TAIL = "\n-----END X509 CRL-----";

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        String stringBuilder = CRL_HEAD + certificateAuthority.getLatestCRLPEMEncoded() + CRL_TAIL;
        resp.getOutputStream().write(stringBuilder.getBytes());
        resp.flushBuffer();
    }
}
