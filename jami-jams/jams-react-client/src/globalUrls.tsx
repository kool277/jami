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

const uri = "";
const current_uri = window.location.href;
const backend_address = new URL(
  process.env.NODE_ENV === "development"
    ? window.location.origin.replace(/\d+$/, "") + "8080"
    : window.location.href,
);
const url_path = backend_address.protocol + "//" + backend_address.hostname;
const url_port = backend_address.port;
const api_path_post_install_admin = "/api/install/start";
const api_path_post_auth_login = "/api/login";
const api_path_post_install_ca = "/api/install/ca";
const api_path_post_install_auth = "/api/install/auth";
const api_path_post_install_server = "/api/install/settings";
const api_path_get_install_lastKnownStep = "/api/install/lastStep";
const api_path_get_auth_user_search = "/api/auth/users";
const api_path_get_admin_devices = "/api/admin/devices";
const api_path_get_auth_devices = "/api/auth/devices";
const api_path_delete_admin_user_revoke = "/api/admin/user";
const api_path_delete_auth_user_revoke = "/api/auth/user";
const api_path_delete_admin_device_revoke = "/api/admin/device";
const api_path_delete_auth_device_revoke = "/api/auth/device";
const api_path_rename_device = "/api/auth/device";
const api_path_get_list_group = "/api/admin/groups";
const api_path_post_create_group = "/api/admin/group";
const api_path_delete_group = "/api/admin/group/";
const api_path_put_update_group = "/api/admin/group/";
const api_path_get_group = "/api/admin/group/";
const api_path_get_server_status = "/api/info";
const api_path_get_post_configuration_auth_service =
  "/api/configuration/authservice";
const api_path_get_post_configuration_global_settings =
  "/api/configuration/globalsettings";
const api_path_post_configuration_change_password = "/api/admin/user";
const api_path_post_configuration_register_license = "/api/admin/subscription";
const api_path_get_subscription_status = "/api/admin/subscription";
const api_path_get_directories = "/api/auth/directories";
const api_path_get_needs_update = "/api/admin/update";
const api_path_get_start_update = "/api/admin/update";
const api_path_post_create_user = "/api/admin/user";
const api_path_put_update_user = "/api/admin/user";
const api_path_get_auth_user = "/api/auth/user";
const api_path_get_admin_user = "/api/admin/user";
const api_path_post_update_user = "/api/auth/user";
const api_path_get_exists_user = "/api/admin/user";
const api_path_get_user_directory_search = "/api/auth/directory/search";
const api_path_post_create_user_profile = "/api/admin/directory/entry";
const api_path_put_update_user_profile = "/api/admin/directory/entry";
const api_path_get_user_search = "/api/admin/users";
const api_path_get_auth_contacts = "/api/auth/contacts";
const api_path_get_admin_contacts = "/api/admin/contacts";
const api_path_delete_auth_contacts = "/api/auth/contacts";
const api_path_delete_admin_contacts = "/api/admin/contacts";
const api_path_blueprints = "/api/admin/policy";
const api_path_get_user_profile = "/api/auth/userprofile/";
const api_path_get_ns_name_from_addr = "/api/nameserver/addr/";
const api_path_get_ns_addr_from_name = "/api/nameserver/name/";
const api_path_get_group_members = "/api/admin/group/members/";
const api_path_post_group_member = "/api/admin/group/members/";
const api_path_delete_group_member = "/api/admin/group/members/";
const api_path_get_admin_user_groups = "/api/admin/user/groups/";
const api_path_get_image = "/api/image/filehandler";
const api_path_post_image = "/api/image/filehandler";

export {
  uri,
  current_uri,
  backend_address,
  url_path,
  url_port,
  api_path_post_install_admin,
  api_path_post_auth_login,
  api_path_post_install_ca,
  api_path_post_install_auth,
  api_path_post_install_server,
  api_path_get_install_lastKnownStep,
  api_path_get_auth_user_search,
  api_path_get_admin_devices,
  api_path_get_auth_devices,
  api_path_delete_admin_user_revoke,
  api_path_delete_auth_user_revoke,
  api_path_delete_admin_device_revoke,
  api_path_delete_auth_device_revoke,
  api_path_rename_device,
  api_path_get_server_status,
  api_path_get_post_configuration_auth_service,
  api_path_get_post_configuration_global_settings,
  api_path_post_configuration_change_password,
  api_path_post_configuration_register_license,
  api_path_get_subscription_status,
  api_path_get_directories,
  api_path_get_needs_update,
  api_path_get_start_update,
  api_path_post_create_user,
  api_path_put_update_user,
  api_path_get_auth_user,
  api_path_get_admin_user,
  api_path_post_update_user,
  api_path_get_exists_user,
  api_path_get_user_directory_search,
  api_path_post_create_user_profile,
  api_path_put_update_user_profile,
  api_path_get_user_search,
  api_path_get_auth_contacts,
  api_path_get_admin_contacts,
  api_path_delete_auth_contacts,
  api_path_delete_admin_contacts,
  api_path_delete_group,
  api_path_get_list_group,
  api_path_post_create_group,
  api_path_put_update_group,
  api_path_get_group,
  api_path_blueprints,
  api_path_get_user_profile,
  api_path_get_ns_name_from_addr,
  api_path_get_ns_addr_from_name,
  api_path_get_group_members,
  api_path_post_group_member,
  api_path_delete_group_member,
  api_path_get_admin_user_groups,
  api_path_get_image,
  api_path_post_image,
};
