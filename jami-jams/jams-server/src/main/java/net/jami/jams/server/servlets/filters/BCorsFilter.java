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

import jakarta.servlet.annotation.WebFilter;
import jakarta.servlet.annotation.WebInitParam;

@WebFilter(
        urlPatterns = {"*"},
        initParams = {
            @WebInitParam(name = "cors.allowed.origins", value = "*"),
            @WebInitParam(name = "cors.allowed.methods", value = "PUT, POST, GET, OPTIONS, DELETE"),
            @WebInitParam(name = "cors.allowed.headers", value = "Content-Type, Authorization"),
            @WebInitParam(name = "cors.preflight.maxage", value = "3600")
        })
public class BCorsFilter extends org.apache.catalina.filters.CorsFilter {}
