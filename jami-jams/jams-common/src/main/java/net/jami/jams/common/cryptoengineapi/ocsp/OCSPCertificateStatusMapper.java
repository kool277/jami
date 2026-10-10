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
package net.jami.jams.common.cryptoengineapi.ocsp;

import static net.jami.jams.common.cryptoengineapi.ocsp.RevocationReason.PRIVILEGE_WITHDRAWN;
import static net.jami.jams.common.cryptoengineapi.ocsp.RevocationReason.SUPERSEDED;

import org.bouncycastle.cert.ocsp.CertificateStatus;
import org.bouncycastle.cert.ocsp.RevokedStatus;
import org.bouncycastle.cert.ocsp.UnknownStatus;

import java.time.ZoneId;
import java.util.Date;

public class OCSPCertificateStatusMapper {

    public static CertificateStatus getStatus(CertificateSummary certificateSummary) {
        switch (certificateSummary.getStatus()) {
            case VALID:
                return CertificateStatus.GOOD;
            case REVOKED:
                return new RevokedStatus(
                        Date.from(
                                certificateSummary
                                        .getRevocationTime()
                                        .atZone(ZoneId.systemDefault())
                                        .toInstant()),
                        PRIVILEGE_WITHDRAWN.getCode());
            case EXPIRED:
                return new RevokedStatus(
                        Date.from(
                                certificateSummary
                                        .getExpirationTime()
                                        .atZone(ZoneId.systemDefault())
                                        .toInstant()),
                        SUPERSEDED.getCode());
            case UNKNOWN:
                return new UnknownStatus();
            default:
                throw new IllegalArgumentException(
                        "Unknown status! " + certificateSummary.getStatus().name());
        }
    }
}
