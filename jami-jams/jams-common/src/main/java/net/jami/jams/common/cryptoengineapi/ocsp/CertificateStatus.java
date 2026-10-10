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

public enum CertificateStatus {
    VALID,
    /** The certificate is valid * */
    REVOKED,
    /** The certificate has been revoked * */
    EXPIRED,
    /** The certificate is expired * */
    UNKNOWN;

    /** The certificate is unknown * */
    public static CertificateStatus fromString(String status) {
        switch (status) {
            case "V":
                return VALID;
            case "R":
                return REVOKED;
            case "E":
                return EXPIRED;
            default:
                throw new IllegalArgumentException("Did not find valid status: " + status);
        }
    }
}
