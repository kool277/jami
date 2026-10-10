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
package net.jami.jams.ca.workers.crl;

import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;

import net.jami.jams.ca.JamsCA;
import net.jami.jams.ca.workers.X509Worker;
import net.jami.jams.common.objects.requests.RevocationRequest;

import org.bouncycastle.asn1.x500.X500Name;
import org.bouncycastle.asn1.x509.CRLReason;
import org.bouncycastle.cert.X509CRLHolder;
import org.bouncycastle.cert.X509v2CRLBuilder;
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder;

import java.io.File;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.Date;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

@Slf4j
public class CRLWorker extends X509Worker<RevocationRequest> {

    @Getter private final AtomicReference<X509CRLHolder> existingCRL = new AtomicReference<>();

    @Getter
    private final CRLFileStorage crlFileStorage =
            new CRLFileStorage(System.getProperty("user.dir") + File.separator + "jams.crl");

    @Getter @Setter private AtomicBoolean stop = new AtomicBoolean(false);

    private RevocationCallback revocationCallback;

    public CRLWorker(PrivateKey privateKey, X509Certificate certificate) {
        super(privateKey, certificate);
        try {
            existingCRL.set(crlFileStorage.getData());
        } catch (Exception e) {
            log.warn(
                    "Unable to find existing CRL file, if this is the first"
                            + " time you are starting the server or no CRL existed, this is fine");
            X509v2CRLBuilder crlBuilder =
                    new X509v2CRLBuilder(
                            new X500Name((getCertificate()).getSubjectDN().getName()), new Date());
            try {
                existingCRL.set(
                        crlBuilder.build(
                                new JcaContentSignerBuilder("SHA512WITHRSA")
                                        .setProvider("BC")
                                        .build(getSigningKey())));
                crlFileStorage.storeData(existingCRL.get());
            } catch (Exception e1) {
                log.error("Unable to create blank CRL!");
            }
        }
        this.setDaemon(true);
        this.start();
        log.info("Instantiated & started a CRL Worker...");
    }

    // Basically we just publish it in the CRL.
    private void revokeCertificate(RevocationRequest revocationRequest) {
        try {
            X509v2CRLBuilder crlBuilder =
                    new X509v2CRLBuilder(
                            new X500Name((getCertificate()).getSubjectDN().getName()), new Date());
            if (revocationRequest != null) {
                crlBuilder.addCRLEntry(
                        revocationRequest.getIdentifier(),
                        new Date(),
                        CRLReason.privilegeWithdrawn);
            }
            crlBuilder.addCRL(existingCRL.get());
            existingCRL.set(
                    crlBuilder.build(
                            new JcaContentSignerBuilder("SHA512WITHRSA")
                                    .setProvider("BC")
                                    .build(getSigningKey())));
            boolean failedWrite = true;
            while (failedWrite) {
                try {
                    crlFileStorage.storeData(existingCRL.get());
                    failedWrite = false;
                } catch (Exception e) {
                    log.warn("An error occurred while attempting to write file. Trying again.");
                }
            }
            log.info("Revocation routine ran successfully.");
        } catch (Exception e) {
            log.error("An error occurred while attempting to sign CRL: " + e);
        }
    }

    public void setRevocationCallback(RevocationCallback revocationCallback) {
        this.revocationCallback = revocationCallback;
    }

    @Override
    public void run() {
        boolean needsRefresh = false;
        while (!stop.get()) {
            try {
                while (getInput().isEmpty()) {
                    if (needsRefresh) {
                        revokeCertificate(null);
                        needsRefresh = false;
                    }
                    synchronized (getInput()) {
                        getInput().wait(JamsCA.crlLifetime - 10_000);
                        needsRefresh = true;
                    }
                }
                while (!getInput().isEmpty()) {
                    RevocationRequest revocationRequest = getInput().poll();
                    revokeCertificate(revocationRequest);
                    needsRefresh = false;
                    log.info(
                            "Certificated with ID revoked successfully."
                                    + revocationRequest.getIdentifier());
                    if (revocationCallback != null) {
                        revocationCallback.onRevocationCompleted();
                    }
                }
            } catch (Exception e) {
                log.error("An error occurred in the CRL signing thread: " + e);
            }
        }
        log.info("Stopped CRL Worker Thread.");
    }
}
