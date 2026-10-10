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
package net.jami.jams.server.servlets.api.auth.login;

import static net.jami.jams.server.Server.userAuthenticationModule;

import net.jami.jams.authmodule.UserAuthenticationModule;
import net.jami.jams.common.authmodule.AuthTokenResponse;

import java.security.cert.X509Certificate;

public class AuthRequestProcessor {

    // This case does not talk to the authentication module, only to the ca
    public static AuthTokenResponse processX509Auth(X509Certificate[] certificates) {
        return userAuthenticationModule.authenticateUser(certificates);
    }

    // This is only called when JAMS is behind a reverse proxy
    public static AuthTokenResponse processX509Auth(X509Certificate certificate) {
        return ((UserAuthenticationModule) userAuthenticationModule).authenticateUser(certificate);
    }

    public static AuthTokenResponse processUsernamePasswordAuth(String username, String password) {
        return userAuthenticationModule.authenticateUser(username, password);
    }

    public static AuthTokenResponse processUsernamePasswordAuth(String authorization) {
        String[] credentials = Decoders.decodeAuthHeader(authorization);
        if (credentials != null && credentials.length == 2) {
            return userAuthenticationModule.authenticateUser(credentials[0], credentials[1]);
        }
        return null;
    }
}
