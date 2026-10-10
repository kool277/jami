/*
 * Copyright (C) 2020-2024 by Savoir-faire Linux
 * Authors: William Enright <william.enright@savoirfairelinux.com>
 *          Ndeye Anna Ndiaye <anna.ndiaye@savoirfairelinux.com>
 *          Johnny Flores <johnny.flores@savoirfairelinux.com>
 *          Mohammed Raza <mohammed.raza@savoirfairelinux.com>
 *          Felix Sidokhine <felix.sidokhine@savoirfairelinux.com>
 *
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

package net.jami.datastore.dao;

import lombok.extern.slf4j.Slf4j;

import net.jami.jams.common.objects.system.SystemAccount;

import java.util.Optional;

@Slf4j
public class SystemDao extends AbstractDao<SystemAccount> {

    public SystemDao() {
        this.setTableName("system");
        this.setTClass(SystemAccount.class);
    }

    public Optional<SystemAccount> getCA() {
        return getFirstObjectFromResultSet("SELECT * FROM system WHERE entity = 'CA'");
    }

    public Optional<SystemAccount> getOCSP() {
        return getFirstObjectFromResultSet("SELECT * FROM system WHERE entity = 'OCSP'");
    }

    @Override
    public boolean storeObject(SystemAccount object) {
        String query = "INSERT INTO system (entity,certificate,privatekey) VALUES (?, ?, ?)";
        return executeInsert(query, object);
    }
}
