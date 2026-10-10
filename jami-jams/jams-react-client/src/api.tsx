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

/*
 *     JAMS - Jami Account Management Server
 *     Copyright (C) 2019 Savoir-faire Linux Inc.
 *
 *     Author: Mohammed Raza <mohammed.raza@savoirfairelinux.com>
 *
 *     This program is free software: you can redistribute it and/or modify
 *     it under the terms of the GNU Affero General Public License as published by
 *     the Free Software Foundation, either version 3 of the License, or
 *     (at your option) any later version.
 *
 *     This program is distributed in the hope that it will be useful,
 *     but WITHOUT ANY WARRANTY; without even the implied warranty of
 *     MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *     GNU Affero General Public License for more details.
 *
 *     You should have received a copy of the GNU Affero General Public License
 *     along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { AxiosRequestConfig } from "axios";
import {
  url_path,
  url_port,
  api_path_get_auth_user_search,
  api_path_get_auth_devices,
  api_path_get_admin_devices,
  api_path_post_configuration_change_password,
  api_path_post_create_user,
  api_path_post_update_user,
  api_path_get_user_directory_search,
  api_path_blueprints,
} from "./globalUrls";

interface Credentials {
  username: string;
  password: string;
}

const configApiCall = (
  api_path: string,
  request_type: string,
  data: any,
  credentials: Credentials | null,
): AxiosRequestConfig => {
  // build config call
  const config: AxiosRequestConfig = {
    url: url_path + ":" + url_port + api_path,
    method: request_type,
    headers: {},
  };

  // pass credentials in the header
  if (credentials) {
    const base64 = btoa(
      credentials["username"] + ":" + credentials["password"],
    );
    config.headers!["Authorization"] = "Basic " + base64;
  }

  const jwt = localStorage.getItem("access_token");
  if (jwt) {
    config.headers!["Authorization"] = "Bearer " + jwt;
  }

  config.headers!["Content-type"] = "application/json;charset=UTF-8";

  // pass data in the header
  if (data) {
    if (
      api_path === api_path_get_user_directory_search ||
      api_path === api_path_get_auth_user_search ||
      (api_path === api_path_post_create_user && request_type === "POST") ||
      (api_path.includes(api_path_blueprints) && request_type === "POST") ||
      api_path === api_path_post_update_user ||
      api_path === api_path_get_auth_devices ||
      api_path === api_path_get_admin_devices ||
      api_path === api_path_post_configuration_change_password
    ) {
      if (request_type === "GET" || request_type === "DELETE") {
        config["params"] = data;
      } else {
        config["data"] = data;
      }
    } else {
      config["data"] = JSON.stringify(data);
    }
  }

  return config;
};

export default configApiCall;
