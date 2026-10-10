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

package net.jami.jams.server.servlets.filters;

import static net.jami.jams.server.servlets.filters.FilterUtils.doAuthCheck;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.annotation.WebFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import lombok.extern.slf4j.Slf4j;

import net.jami.jams.common.serialization.tomcat.TomcatCustomErrorHandler;
import net.jami.jams.server.Server;

import java.io.IOException;

/**
 * Since we have the @ScopedServletMethod annotation, the admin filter became absolutely useless as
 * we can simply scope things.
 */
@WebFilter(urlPatterns = {"/api/auth/*", "/api/admin/*"})
@Slf4j
public class DApiFilter implements Filter {

    @Override
    public void doFilter(
            ServletRequest servletRequest, ServletResponse servletResponse, FilterChain filterChain)
            throws IOException, ServletException {
        HttpServletRequest request = (HttpServletRequest) servletRequest;
        HttpServletResponse response = (HttpServletResponse) servletResponse;
        response.setContentType("application/json;charset=UTF-8");

        if (!Server.isInstalled.get()) {
            TomcatCustomErrorHandler.sendCustomError(
                    response, 404, "Setup has not yet been completed!");
            return;
        }

        boolean authsuccess = false;
        boolean isLogin = false;
        boolean isOCSPCheck = false;

        if (request.getServletPath().contains("login")) isLogin = true;
        else if (request.getServletPath().contains("ocsp")) isOCSPCheck = true;
        else authsuccess = doAuthCheck(request);
        if (authsuccess || isLogin || isOCSPCheck) {
            filterChain.doFilter(servletRequest, servletResponse);
            return;
        }

        TomcatCustomErrorHandler.sendCustomError(response, 401, "You are not authenticated!");
    }
}
