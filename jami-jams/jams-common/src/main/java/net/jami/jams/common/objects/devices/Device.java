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
package net.jami.jams.common.objects.devices;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import net.jami.jams.common.objects.roots.X509Entity;
import net.jami.jams.common.serialization.database.DatabaseObject;
import net.jami.jams.common.utils.X509Utils;

import java.sql.PreparedStatement;
import java.sql.ResultSet;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Device extends X509Entity implements DatabaseObject {

    private String deviceId;

    private transient String owner;

    private String displayName;

    public Device(ResultSet rs) throws Exception {
        this.deviceId = rs.getString("deviceId");
        this.owner = rs.getString("owner");
        this.displayName = rs.getString("displayName");
        this.setCertificate(X509Utils.getCertificateFromPEMString(rs.getString("certificate")));
        this.setPrivateKey(X509Utils.getKeyFromPEMString(rs.getString("privatekey")));
    }

    @Override
    public PreparedStatement getInsert(PreparedStatement ps) throws Exception {
        ps.setString(1, deviceId);
        ps.setString(2, owner);
        ps.setString(3, displayName);
        ps.setString(4, X509Utils.getPEMStringFromCertificate(this.getCertificate()));
        // Devices do not have private keys exposed.
        ps.setString(5, "");
        return ps;
    }

    @Override
    public PreparedStatement getDelete(PreparedStatement ps) throws Exception {
        return null;
    }

    @Override
    public PreparedStatement getUpdate(PreparedStatement ps) throws Exception {
        return null;
    }
}
