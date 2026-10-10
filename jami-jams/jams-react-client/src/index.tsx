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

/*!

=========================================================
* Material Dashboard React - v1.9.0
=========================================================

* Product Page: https://www.creative-tim.com/product/material-dashboard-react
* Copyright 2020 Creative Tim (https://www.creative-tim.com)
* Licensed under MIT (https://github.com/creativetimofficial/material-dashboard-react/blob/master/LICENSE.md)

* Coded by Creative Tim

=========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

*/
import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "protected.route";
import { ConfiguredRoute } from "configured.route";
import auth from "./auth";

import {
  ThemeProvider,
  StyledEngineProvider,
  createTheme,
} from "@mui/material";

// core components
import UsersRoute from "routes/UsersRoute";
import UserRoute from "routes/UserRoute";
import CreateUserRoute from "routes/CreateUserRoute";
import GroupsRoute from "routes/GroupsRoute";
import GroupRoute from "routes/GroupRoute";
import BlueprintsRoute from "routes/BlueprintsRoute";
import BlueprintRoute from "routes/BlueprintRoute";
import SettingsRoute from "routes/SettingsRoute";

import SignIn from "layouts/SignIn";

import "assets/css/material-dashboard-react.css";
import "../node_modules/ubuntu-fontface/ubuntu.min.css";

import "./i18n";
import { grayColor } from "assets/jss/material-dashboard-react";

const theme = createTheme({
  palette: {
    primary: {
      main: "#005699",
    },
    secondary: {
      main: "#ffffff",
    },
  },
  typography: {
    allVariants: {
      color: grayColor[2],
    },
    fontFamily: ["Ubuntu", "sans-serif"].join(","),
  },
});

auth.checkServerInstalled(() => {
  auth.checkAdminAccountStatus(() => {
    auth.checkLastKnownStep(() => {
      const root = createRoot(document.getElementById("root")!);
      root.render(
        <StrictMode>
          <StyledEngineProvider injectFirst>
            <ThemeProvider theme={theme}>
              <Suspense fallback={<div>Loading...</div>}>
                <BrowserRouter>
                  <Routes>
                    <Route
                      path="/signin"
                      element={<ConfiguredRoute component={SignIn} />}
                    />
                    <Route
                      path="/users"
                      element={<ProtectedRoute component={UsersRoute} />}
                    />
                    <Route
                      path="/user/:username"
                      element={<ProtectedRoute component={UserRoute} />}
                    />
                    <Route
                      path="/createuser"
                      element={<ProtectedRoute component={CreateUserRoute} />}
                    />
                    <Route
                      path="/groups"
                      element={<ProtectedRoute component={GroupsRoute} />}
                    />
                    <Route
                      path="/group/:groupid"
                      element={<ProtectedRoute component={GroupRoute} />}
                    />
                    <Route
                      path="/blueprints"
                      element={<ProtectedRoute component={BlueprintsRoute} />}
                    />
                    <Route
                      path="/blueprint/:blueprintname"
                      element={<ProtectedRoute component={BlueprintRoute} />}
                    />
                    <Route
                      path="/settings"
                      element={<ProtectedRoute component={SettingsRoute} />}
                    />
                    <Route path="*" element={<Navigate to="/signin" />} />
                  </Routes>
                </BrowserRouter>
              </Suspense>
            </ThemeProvider>
          </StyledEngineProvider>
        </StrictMode>,
      );
    });
  });
});
