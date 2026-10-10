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

package net.jami.jams.server.servlets.api.admin.group;

import static net.jami.jams.server.Server.dataStore;

import com.google.gson.Gson;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import lombok.extern.slf4j.Slf4j;

import net.jami.jams.common.annotations.JsonContent;
import net.jami.jams.common.annotations.ScopedServletMethod;
import net.jami.jams.common.objects.user.AccessLevel;
import net.jami.jams.common.objects.user.Policy;
import net.jami.jams.common.serialization.adapters.GsonFactory;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

@WebServlet("/api/admin/policy/*")
@Slf4j
public class PolicyProfileServlet extends HttpServlet {
    private static final Gson gson = GsonFactory.createGson();

    @Override
    @ScopedServletMethod(securityGroups = {AccessLevel.ADMIN})
    @JsonContent
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws ServletException, IOException {
        String name = req.getPathInfo().replace("/", "");
        getPolicyAndSendResponse(resp, name);
    }

    public static void getPolicyAndSendResponse(HttpServletResponse resp, String name)
            throws IOException {
        if (name.equals("*")) {
            List<Policy> policies = dataStore.getPolicyDao().getAll();
            resp.getOutputStream().write(gson.toJson(policies).getBytes());
            resp.flushBuffer();
            resp.setStatus(200);
            return;
        }

        Optional<Policy> policy = dataStore.getPolicyDao().getByName(name);
        if (policy.isPresent()) {
            byte[] bytes = gson.toJson(policy.orElseThrow()).getBytes();
            resp.getOutputStream().write(bytes);
            resp.flushBuffer();
            resp.setStatus(200);
        } else {
            resp.sendError(404, "{\"message\": \"No policy found.\"}");
        }
    }
}
