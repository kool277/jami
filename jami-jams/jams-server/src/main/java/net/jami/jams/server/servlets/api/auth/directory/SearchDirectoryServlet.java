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
package net.jami.jams.server.servlets.api.auth.directory;

import static net.jami.jams.server.Server.certificateAuthority;
import static net.jami.jams.server.Server.dataStore;
import static net.jami.jams.server.Server.nameServer;
import static net.jami.jams.server.Server.userAuthenticationModule;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import lombok.extern.slf4j.Slf4j;

import net.jami.datastore.main.DataStore;
import net.jami.jams.common.annotations.JsonContent;
import net.jami.jams.common.authentication.AuthenticationSource;
import net.jami.jams.common.authentication.AuthenticationSourceType;
import net.jami.jams.common.authmodule.AuthModuleKey;
import net.jami.jams.common.objects.user.AccessLevel;
import net.jami.jams.common.objects.user.Policy;
import net.jami.jams.common.objects.user.PolicyData;
import net.jami.jams.common.objects.user.User;
import net.jami.jams.common.objects.user.UserProfile;
import net.jami.jams.common.serialization.adapters.GsonFactory;

import org.bouncycastle.cert.X509CRLEntryHolder;
import org.bouncycastle.cert.X509CRLHolder;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@WebServlet("/api/auth/directory/search")
public class SearchDirectoryServlet extends HttpServlet {
    private final Gson gson = GsonFactory.createGson();

    // The search directory function does not automatically create users, this would
    // be costly at this point
    // right now, we will implement it when Jami supports lists of users. this is a
    // work in progress as it
    // requires changes on the name server as well.
    List<UserProfile> userProfiles = new ArrayList<>();

    @Override
    @JsonContent
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String pageParam = req.getParameter("page");
        Optional<Integer> page;
        if (pageParam == null) page = Optional.empty();
        else page = Optional.ofNullable(Integer.parseInt(pageParam));

        ConcurrentHashMap<AuthModuleKey, AuthenticationSource> authSources =
                new ConcurrentHashMap<>(userAuthenticationModule.getAuthSources());

        // Check if the actual user is allowed to lookup in the directory
        String username = req.getAttribute("username").toString();

        try {
            Policy policy = dataStore.getPolicyDao().getByUsername(username).orElseThrow();
            PolicyData policyData = gson.fromJson(policy.getPolicyData(), PolicyData.class);

            if (!policyData.getAllowLookup()) {
                resp.sendError(403, "Operation not allowed!");
                return;
            }
        } catch (Exception e1) {
            log.warn("No policy available for user - not adding a policy component to response");
        }

        if (authSources.size() > 1) {
            authSources.forEach(
                    (k, v) -> {
                        if (k.getType() == AuthenticationSourceType.LOCAL) authSources.remove(k);
                    });
        }

        String queryString = req.getParameter("queryString");

        authSources.forEach(
                (k, v) -> {
                    if (queryString.equals("*")) {
                        userProfiles = v.searchUserProfiles(queryString, "FULL_TEXT_NAME", page);
                    }
                    userProfiles = v.searchUserProfiles(queryString, "FULL_TEXT_NAME", page);
                    if (userProfiles.isEmpty()
                            && userProfiles.addAll(
                                    v.searchUserProfiles(queryString, "LOGON_NAME", page))) {
                        Set<UserProfile> s =
                                new TreeSet<UserProfile>(
                                        new Comparator<UserProfile>() {
                                            @Override
                                            public int compare(UserProfile o1, UserProfile o2) {
                                                if (o1.getUsername().equals(o2.getUsername()))
                                                    return 0;
                                                return 1;
                                            }
                                        });
                        s.addAll(userProfiles);
                        userProfiles = new ArrayList<>(s);
                    }
                    userProfiles.forEach(
                            profile -> {
                                List<User> results = new ArrayList<>();
                                while (results.isEmpty()) {
                                    results =
                                            dataStore
                                                    .getUserDao()
                                                    .getByUsername(profile.getUsername())
                                                    .map(user -> List.of(user))
                                                    .orElseGet(() -> List.of());
                                    if (results.isEmpty()) {
                                        User user = new User();
                                        user.setUsername(profile.getUsername());
                                        user.setRealm(k.getRealm());
                                        user.setUserType(k.getType());
                                        user.setAccessLevel(AccessLevel.USER);
                                        userAuthenticationModule.createUser(
                                                user.getUserType(),
                                                user.getRealm(),
                                                nameServer,
                                                user);
                                    } else {
                                        profile.setId(results.get(0).getJamiId());
                                    }
                                }
                            });
                });

        JsonObject obj = new JsonObject();
        JsonArray profilesArray = gson.toJsonTree(userProfiles).getAsJsonArray();

        for (int i = 0; i < profilesArray.size(); i++) {
            JsonObject profile = profilesArray.get(i).getAsJsonObject();
            String usernamerev = profile.get("username").getAsString();

            User user = dataStore.getUserDao().getByUsername(usernamerev).orElse(null);
            if (user != null) {
                X509CRLHolder crl = certificateAuthority.getLatestCRL().get();
                if (crl != null) {
                    X509CRLEntryHolder revoked =
                            crl.getRevokedCertificate(user.getCertificate().getSerialNumber());
                    profile.addProperty("revoked", revoked != null);
                } else {
                    profile.addProperty("revoked", false);
                }
            }
        }

        obj.add("profiles", profilesArray);
        obj.addProperty("numPages", DataStore.NUM_PAGES);

        resp.getOutputStream().write(gson.toJson(obj).getBytes());
        resp.flushBuffer();
        resp.setStatus(200);
    }
}
