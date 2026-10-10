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
package net.jami.jams.ldap.connector.service;

import static net.jami.jams.ldap.connector.LDAPConnector.settings;

import lombok.extern.slf4j.Slf4j;

import org.ldaptive.ConnectionFactory;
import org.ldaptive.Credential;
import org.ldaptive.auth.AuthenticationRequest;
import org.ldaptive.auth.AuthenticationResponse;
import org.ldaptive.auth.Authenticator;
import org.ldaptive.auth.FormatDnResolver;
import org.ldaptive.auth.SimpleBindAuthenticationHandler;

@Slf4j
public class AuthenticationService {

    private final ConnectionFactory connectionFactory;

    public AuthenticationService(ConnectionFactory connectionFactory) {
        this.connectionFactory = connectionFactory;
    }

    public boolean authenticateUser(String username, String password) {
        try {
            FormatDnResolver dnResolver = new FormatDnResolver();
            dnResolver.setFormat(settings.getUsernameField() + "=%s," + settings.getBaseDN());
            SimpleBindAuthenticationHandler bindAuthenticationHandler =
                    new SimpleBindAuthenticationHandler(connectionFactory);
            Authenticator auth = new Authenticator();
            auth.setDnResolver(dnResolver);
            auth.setAuthenticationHandler(bindAuthenticationHandler);
            AuthenticationResponse resp =
                    auth.authenticate(
                            new AuthenticationRequest(username, new Credential(password)));
            log.info(
                    "User "
                            + username
                            + " has tried to authenticate with result: "
                            + resp.getAuthenticationResultCode());
            return resp.isSuccess();
        } catch (Exception e) {
            log.info("An error occurred while processing authentication request: " + e);
            return false;
        }
    }
}
