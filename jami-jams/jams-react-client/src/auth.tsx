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

import configApiCall from "api";
import axios from "axios";

import {
  api_path_post_install_admin,
  api_path_post_auth_login,
  api_path_get_server_status,
  api_path_get_install_lastKnownStep,
  api_path_get_directories,
  api_path_get_subscription_status,
  api_path_get_needs_update,
} from "globalUrls";

class Auth {
  authenticated: boolean;
  admin: boolean;
  installed: boolean;
  uri: string;
  username: string;
  localVersion: string;
  remoteVersion: string;
  activated: boolean;
  updateAvailable: boolean;

  constructor() {
    this.authenticated = false;
    this.admin = false;
    this.installed = false;
    this.uri = "";
    this.username = "";
    this.localVersion = "";
    this.remoteVersion = "";
    this.activated = false;
    this.updateAvailable = false;
  }

  setJWT(accessToken: string) {
    window.localStorage.removeItem("access_token");
    window.localStorage.setItem("access_token", accessToken);
  }

  setScope(scope: boolean) {
    window.localStorage.removeItem("scope");
    window.localStorage.setItem("scope", scope.toString());
  }

  setLocalDirectory(localDirectory: boolean) {
    window.localStorage.removeItem("localDirectory");
    window.localStorage.setItem("localDirectory", localDirectory.toString());
  }

  deleteJWT() {
    window.localStorage.removeItem("access_token");
  }

  setUsername(username: string) {
    window.localStorage.removeItem("username");
    window.localStorage.setItem("username", username);
  }

  deleteUserhame() {
    window.localStorage.removeItem("username");
  }

  login(jsonData: { username: string; password: string }, cb: () => void) {
    this.deleteJWT();
    axios(configApiCall(api_path_post_auth_login, "POST", jsonData, null))
      .then((response) => {
        if (response.status === 200) {
          this.setJWT(response.data["access_token"]);
          this.setScope(response.data["scope"] === "ADMIN");
          this.setUsername(jsonData.username);
          this.authenticated = true;
        }
        cb();
      })
      .catch(() => {
        this.setJWT("");
        this.setUsername("");
        this.authenticated = false;
        cb();
      });
  }

  logout(cb: () => void) {
    this.deleteJWT();
    this.authenticated = false;
    this.deleteUserhame();
    cb();
  }

  isAuthenticated() {
    return this.authenticated;
  }

  isLocalDirectory() {
    return window.localStorage.getItem("localDirectory") === "true";
  }

  checkDirectoryType(cb: () => void) {
    axios(configApiCall(api_path_get_directories, "GET", null, null))
      .then((response) => {
        if (response.data.length === 1) {
          this.setLocalDirectory(true);
        } else if (response.data.length === 2) {
          this.setLocalDirectory(false);
        } else {
          console.log(
            "Error getting on checkDirectoryType: Size of directory types is " +
              response.data.length,
          );
        }
        cb();
      })
      .catch((error) => {
        console.log("Error getting on checkDirectoryType: " + error);
        cb();
      });
  }

  checkAdminAccountStatus(cb: () => void) {
    axios(configApiCall(api_path_post_install_admin, "GET", null, null))
      .then((response) => {
        if (response["headers"]["showlogin"] === "true") {
          this.admin = true;
        }
        cb();
      })
      .catch((error) => {
        if (error.response && error.response.status === 404) {
          this.admin = true;
        } else {
          console.error(
            "Error during API request on checkAdminAccountStatus: " + error,
          );
        }
        cb();
      });
  }

  checkServerInstalled(cb: () => void) {
    axios(configApiCall(api_path_get_server_status, "GET", null, null))
      .then((response) => {
        if (response.data["installed"] === "true") {
          this.installed = true;
        } else {
          this.installed = false;
        }
        cb();
      })
      .catch((error) => {
        if (error.response && error.response.status === 401) {
          this.authenticated = false;
        } else {
          console.error(
            "Error during API request on checkServerInstalled: " + error,
          );
        }
      });
  }

  checkLastKnownStep(cb: () => void) {
    if (this.installed) {
      this.authenticated = true;
      cb();
    } else {
      axios(
        configApiCall(api_path_get_install_lastKnownStep, "GET", null, null),
      )
        .then((response) => {
          this.uri = response.data["uri"];
          this.authenticated = true;
          cb();
        })
        .catch((error) => {
          if (error.response && error.response.status === 401) {
            this.authenticated = false;
          } else {
            console.error(
              "Error during API request on checkLastKnownStep: " + error,
            );
          }
          cb();
        });
    }
  }

  checkForUpdates(cb: () => void) {
    if (!this.hasAdminScope()) {
      return;
    }
    if (this.installed && this.authenticated) {
      axios(configApiCall(api_path_get_subscription_status, "GET", null, null))
        .then((response) => {
          this.activated = response.data["activated"];
          cb();
        })
        .catch((error) => {
          if (error.response && error.response.status === 401) {
            this.authenticated = false;
          } else {
            console.error(
              "Error during API request on checkForUpdates: " + error,
            );
          }
          cb();
        });
    } else {
      axios(
        configApiCall(api_path_get_install_lastKnownStep, "GET", null, null),
      )
        .then((response) => {
          this.uri = response.data["uri"];
          this.authenticated = true;
          cb();
        })
        .catch(() => {
          cb();
        });
    }
  }

  getUpdates(cb: () => void) {
    if (this.installed && this.authenticated) {
      axios(configApiCall(api_path_get_needs_update, "GET", null, null)).then(
        (response) => {
          if (response.data["updateAvailable"]) {
            this.remoteVersion =
              response.data["remoteVersions"]["jams-server.jar"]["version"];
          } else {
            this.updateAvailable = false;
          }
          cb();
        },
      );
    } else {
      axios(
        configApiCall(api_path_get_install_lastKnownStep, "GET", null, null),
      )
        .then((response) => {
          this.uri = response.data["uri"];
          this.authenticated = true;
          cb();
        })
        .catch(() => {
          cb();
        });
    }
  }

  isActivated() {
    return this.activated;
  }

  isServerInstalled() {
    return this.installed;
  }

  isUpdateAvailable() {
    return this.updateAvailable;
  }

  getLocalVersion() {
    return this.localVersion;
  }

  getRemoteVersion() {
    return this.remoteVersion;
  }

  hasAdmin() {
    return this.admin;
  }

  hasAdminScope() {
    return window.localStorage.getItem("scope") === "true";
  }

  getUsername() {
    return window.localStorage.getItem("username");
  }

  isInstalled() {
    return this.installed;
  }
}

export default new Auth();
