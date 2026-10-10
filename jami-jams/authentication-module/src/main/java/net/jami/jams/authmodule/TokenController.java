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
package net.jami.jams.authmodule;

import static net.jami.jams.common.objects.user.AccessLevel.DEVICE;

import com.nimbusds.jose.JOSEObjectType;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;

import net.jami.jams.common.authmodule.AuthTokenResponse;
import net.jami.jams.common.objects.user.User;

import java.security.PrivateKey;
import java.util.Date;
import java.util.UUID;

public class TokenController {

    private static PrivateKey signingKey;

    public TokenController(PrivateKey signingKey) {
        TokenController.signingKey = signingKey;
    }

    public AuthTokenResponse getToken(User user, String deviceId) {
        AuthTokenResponse authTokenResponse = new AuthTokenResponse();
        JWSHeader jwsHeader =
                new JWSHeader.Builder(JWSAlgorithm.RS256).type(JOSEObjectType.JWT).build();
        JWTClaimsSet.Builder builder =
                new JWTClaimsSet.Builder()
                        .issuer("JAMS")
                        .subject(user.getUsername())
                        .audience("JAMS")
                        .claim("oneTimePassword", user.getNeedsPasswordReset())
                        .expirationTime(new Date(System.currentTimeMillis() + 30 * 60 * 1000))
                        .notBeforeTime(new Date(System.currentTimeMillis()))
                        .issueTime(new Date(System.currentTimeMillis()))
                        .jwtID(UUID.randomUUID().toString());
        if (deviceId != null) {
            builder.claim("scope", DEVICE);
            builder.claim("deviceId", deviceId);
            authTokenResponse.setScope(DEVICE);
        } else {
            builder.claim("scope", user.getAccessLevel());
            authTokenResponse.setScope(user.getAccessLevel());
        }
        JWTClaimsSet jwtClaims = builder.build();
        SignedJWT signedJWT = new SignedJWT(jwsHeader, jwtClaims);
        try {
            signedJWT.sign(new RSASSASigner(signingKey));
            authTokenResponse.setAccess_token(signedJWT.serialize());
            authTokenResponse.setExpires_in(30 * 60L);
            authTokenResponse.setToken_type("Bearer");
            return authTokenResponse;
        } catch (Exception e) {
            return null;
        }
    }
}
