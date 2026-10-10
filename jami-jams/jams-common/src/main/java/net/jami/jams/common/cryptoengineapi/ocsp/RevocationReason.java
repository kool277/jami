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

import java.util.HashMap;

/**
 * Enumeration of certificate revocation reasons
 *
 * @author wdawson
 * @see java.security.cert.CRLReason
 */
public enum RevocationReason {

    /**
     * Code = 0, Name = unspecified
     *
     * <p>Can be used to revoke certificates for reasons other than the specific codes.
     */
    UNSPECIFIED(0, "unspecified"),

    /**
     * Code = 1, Name = keyCompromise
     *
     * <p>Used in revoking an end-entity certificate. It indicates that it is known or suspected
     * that the subject's private key, or other aspects of the subject validated in the certificate,
     * have been compromised.
     */
    KEY_COMPROMISE(1, "keyCompromise"),

    /**
     * Code = 2, Name = CACompromise
     *
     * <p>Used in revoking a CA-certificate. It indicates that it is known or suspected that the
     * subject's private key, or other aspects of the subject validated in the certificate, have
     * been compromised.
     */
    CA_COMPROMISE(2, "CACompromise"),

    /**
     * Code = 3, Name = affiliationChanged
     *
     * <p>Indicates that the subject's name or other information in the certificate has been
     * modified but there is no cause to suspect that the private key has been compromised.
     */
    AFFILIATION_CHANGED(3, "affiliationChanged"),

    /**
     * Code = 4, Name = superseded
     *
     * <p>Indicates that the certificate has been superseded but there is no cause to suspect that
     * the private key has been compromised.
     */
    SUPERSEDED(4, "superseded"),

    /**
     * Code = 5, Name = cessationOfOperation
     *
     * <p>Indicates that the certificate is no longer needed for the purpose for which it was issued
     * but there is no cause to suspect that the private key has been compromised.
     */
    CESSATION_OF_OPERATION(5, "cessationOfOperation"),

    /**
     * Code = 6, Name = certificateHold
     *
     * <p>Indicates that the certificate is temporarily revoked but there is no cause to suspect
     * that the private kye has been compromised; the certificate can later be revoked with another
     * reason code, or unrevoked and returned to use.
     */
    CERTIFICATE_HOLD(6, "certificateHold"),

    /**
     * Code = 7, Name = unused
     *
     * <p>This code is obsolete and unused.
     */
    UNUSED(7, "unused"),

    /**
     * Code = 8, Name = removeFromCRL
     *
     * <p>Indicates that the certificate has been unrevoked. NOTE: This is specific to the
     * CertificateHold reason and is only used in DeltaCRLs.
     */
    REMOVE_FROM_CRL(8, "removeFromCRL"),

    /**
     * Code = 9, Name = privilegeWithdrawn
     *
     * <p>Indicates that a certificate (public-key or attribute certificate) was revoked because a
     * privilege contained within that certificate has been withdrawn. Unused in OpenSSL.
     */
    PRIVILEGE_WITHDRAWN(9, "privilegeWithdrawn"),

    /**
     * Code = 10, Name = AACompromise
     *
     * <p>Indicates that it is known or suspected that aspects of the AA validated in the attribute
     * certificate, have been compromised. It applies to authority attribute (AA) certificates only.
     * Unused in OpenSSL.
     */
    AA_COMPROMISE(10, "AACompromise");

    private static final int NUM_CODES = 11;

    private final int code;
    private final String name;

    RevocationReason(int code, String name) {
        this.code = code;
        this.name = name;
    }

    public int getCode() {
        return code;
    }

    public String getName() {
        return name;
    }

    // Map for quick lookups by name.
    private static final HashMap<String, RevocationReason> nameToReason = new HashMap<>();

    /**
     * Return the RevocationReason with the given code.
     *
     * @param code The code.
     * @return The RevocationReason.
     */
    public static RevocationReason fromCode(int code) {
        if (code > NUM_CODES - 1 || code < 0 || code == 7) {
            throw new IllegalArgumentException("CRL Reason code not recognized: " + code);
        }

        return RevocationReason.values()[code];
    }

    public static void initMap() {
        nameToReason.put(UNSPECIFIED.getName(), UNSPECIFIED);
        nameToReason.put(KEY_COMPROMISE.getName(), KEY_COMPROMISE);
        nameToReason.put(CA_COMPROMISE.getName(), CA_COMPROMISE);
        nameToReason.put(AFFILIATION_CHANGED.getName(), AFFILIATION_CHANGED);
        nameToReason.put(SUPERSEDED.getName(), SUPERSEDED);
        nameToReason.put(CESSATION_OF_OPERATION.getName(), CESSATION_OF_OPERATION);
        nameToReason.put(CERTIFICATE_HOLD.getName(), CERTIFICATE_HOLD);
        nameToReason.put(REMOVE_FROM_CRL.getName(), REMOVE_FROM_CRL);
        nameToReason.put(PRIVILEGE_WITHDRAWN.getName(), PRIVILEGE_WITHDRAWN);
        nameToReason.put(AA_COMPROMISE.getName(), AA_COMPROMISE);
    }

    /**
     * Return the RevocationReason with the given name.
     *
     * @param name The name.
     * @return The RevocationReason.
     */
    public static RevocationReason fromName(String name) {
        return nameToReason.get(name);
    }
}
