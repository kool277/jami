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
package net.jami.jams.ca.workers.csr;

import lombok.extern.slf4j.Slf4j;

import net.jami.jams.ca.workers.csr.builders.DeviceBuilder;
import net.jami.jams.ca.workers.csr.builders.SystemAccountBuilder;
import net.jami.jams.ca.workers.csr.builders.UserBuilder;
import net.jami.jams.common.objects.devices.Device;
import net.jami.jams.common.objects.system.SystemAccount;
import net.jami.jams.common.objects.user.User;

@Slf4j
public class CertificateWorker {

    public static final long SHIFT = 43200000L;

    // The CSR here is null because we generate a certificate and keypair.
    public static SystemAccount getSignedCertificate(SystemAccount systemAccount) {
        switch (systemAccount.getSystemAccountType()) {
            case CA:
                return SystemAccountBuilder.generateCA(systemAccount);
            case OCSP:
                return SystemAccountBuilder.generateOCSP(systemAccount);
            default:
                return null;
        }
    }

    public static User getSignedCertificate(User user) {
        return UserBuilder.generateUser(user);
    }

    public static User getRefreshedCertificate(User user) {
        return UserBuilder.refreshUser(user);
    }

    public static Device getSignedCertificate(User user, Device device) {
        return DeviceBuilder.generateDevice(user, device);
    }
}
