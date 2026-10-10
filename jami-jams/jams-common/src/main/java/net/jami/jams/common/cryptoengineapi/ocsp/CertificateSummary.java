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

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

import java.math.BigInteger;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

import javax.security.auth.x500.X500Principal;

@Getter
@Setter
@AllArgsConstructor
public class CertificateSummary {

    public static final DateTimeFormatter DATE_TIME_FORMATTER =
            DateTimeFormatter.ofPattern("yyMMddHHmmssZ");

    private final CertificateStatus status;
    private final LocalDateTime expirationTime;
    private final LocalDateTime revocationTime;
    private final RevocationReason revocationReason;
    private final BigInteger serialNumber;
    private final String fileName;
    private final X500Principal subjectDN;

    private final LocalDateTime thisUpdateTime;

    public CertificateStatus getStatus() {
        return status;
    }

    public LocalDateTime getExpirationTime() {
        return expirationTime;
    }

    public LocalDateTime getRevocationTime() {
        return revocationTime;
    }

    public RevocationReason getRevocationReason() {
        return revocationReason;
    }

    public BigInteger getSerialNumber() {
        return serialNumber;
    }

    public String getFileName() {
        return fileName;
    }

    public X500Principal getSubjectDN() {
        return subjectDN;
    }

    public LocalDateTime getThisUpdateTime() {
        return thisUpdateTime;
    }

    private CertificateSummary(Builder builder) {
        status = builder.status;
        expirationTime = builder.expirationTime;
        revocationTime = builder.revocationTime;
        revocationReason = builder.revocationReason;
        serialNumber = builder.serialNumber;
        fileName = builder.fileName;
        subjectDN = builder.subjectDN;
        thisUpdateTime =
                builder.thisUpdateTime == null ? LocalDateTime.now() : builder.thisUpdateTime;
    }

    public static Builder newBuilder() {
        return new Builder();
    }

    public static final class Builder {
        private CertificateStatus status = CertificateStatus.UNKNOWN;
        private LocalDateTime expirationTime = null;
        private LocalDateTime revocationTime = null;
        private RevocationReason revocationReason = null;
        private BigInteger serialNumber = null;
        private String fileName = null;
        private X500Principal subjectDN = null;

        private LocalDateTime thisUpdateTime = null;

        private Builder() {}

        public Builder withStatus(CertificateStatus val) {
            status = val;
            return this;
        }

        public Builder withExpirationTime(LocalDateTime val) {
            expirationTime = val;
            return this;
        }

        public Builder withRevocationTime(LocalDateTime val) {
            revocationTime = val;
            return this;
        }

        public Builder withRevocationReason(RevocationReason val) {
            revocationReason = val;
            return this;
        }

        public Builder withSerialNumber(BigInteger val) {
            serialNumber = val;
            return this;
        }

        public Builder withFileName(String val) {
            fileName = val;
            return this;
        }

        public Builder withSubjectDN(X500Principal val) {
            subjectDN = val;
            return this;
        }

        public Builder withThisUpdateTime(LocalDateTime val) {
            thisUpdateTime = val;
            return this;
        }

        public CertificateSummary build() {
            return new CertificateSummary(this);
        }
    }
}
