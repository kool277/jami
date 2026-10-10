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
package net.jami.jams.common.objects.roots;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class X509Fields {

    private String commonName;
    private String uid;
    private String country;
    private String state;
    private String organization;
    private String organizationUnit;
    private Long lifetime;

    public String getDN() {
        StringBuilder stringBuilder = new StringBuilder();
        // This makes no sense without a Common Name;
        if (commonName != null) {
            stringBuilder.append("CN=").append(commonName);
        } else return null;
        if (uid != null) {
            stringBuilder.append(",").append("UID=").append(uid);
        }
        if (country != null) stringBuilder.append(",").append("C=").append(country);
        if (state != null) stringBuilder.append(",").append("ST=").append(state);
        if (organization != null) stringBuilder.append(",").append("O=").append(organization);
        if (organizationUnit != null)
            stringBuilder.append(",").append("OU=").append(organizationUnit);
        return stringBuilder.toString();
    }
}
