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
package net.jami.jams.server.servlets.api.install;

import net.jami.jams.common.authentication.activedirectory.ActiveDirectorySettings;
import net.jami.jams.common.authentication.ldap.LDAPSettings;
import net.jami.jams.common.authentication.local.LocalAuthSettings;
import net.jami.jams.common.cryptoengineapi.CertificateAuthorityConfig;
import net.jami.jams.common.objects.requests.CreateCARequest;

public class CachedObjects {

    public static String endpoint = "start";
    public static CertificateAuthorityConfig certificateAuthorityConfig;
    public static CreateCARequest createCARequest;
    public static LDAPSettings ldapSettings;
    public static ActiveDirectorySettings activeDirectorySettings;
    public static LocalAuthSettings localAuthSettings;
}
