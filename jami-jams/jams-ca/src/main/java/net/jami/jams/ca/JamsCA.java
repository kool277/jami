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
package net.jami.jams.ca;

import com.google.gson.Gson;

import lombok.extern.slf4j.Slf4j;

import net.jami.jams.ca.workers.crl.CRLWorker;
import net.jami.jams.ca.workers.crl.RevocationCallback;
import net.jami.jams.ca.workers.csr.CertificateWorker;
import net.jami.jams.ca.workers.ocsp.OCSPWorker;
import net.jami.jams.common.cryptoengineapi.CertificateAuthority;
import net.jami.jams.common.cryptoengineapi.CertificateAuthorityConfig;
import net.jami.jams.common.objects.devices.Device;
import net.jami.jams.common.objects.requests.RevocationRequest;
import net.jami.jams.common.objects.system.SystemAccount;
import net.jami.jams.common.objects.user.User;
import net.jami.jams.common.serialization.adapters.GsonFactory;

import org.bouncycastle.cert.X509CRLHolder;
import org.bouncycastle.cert.ocsp.OCSPException;
import org.bouncycastle.cert.ocsp.OCSPReq;
import org.bouncycastle.cert.ocsp.OCSPResp;
import org.bouncycastle.jce.provider.BouncyCastleProvider;

import java.security.PrivateKey;
import java.security.Security;
import java.security.cert.X509Certificate;
import java.util.Base64;
import java.util.concurrent.atomic.AtomicReference;

@Slf4j
public class JamsCA implements CertificateAuthority, RevocationCallback {

    // These are the workers which are responsible for CRL/OCSP, they have an odd relationship.
    private static CRLWorker crlWorker;
    private static OCSPWorker ocspWorker;
    public static volatile String serverDomain;
    // The default value is SHA512WITHRSA, this can be changed in the config file.
    public static volatile String signingAlgorithm = "SHA512WITHRSA";

    // Various times
    public static long crlLifetime = 360_000_000;
    public static long userLifetime = 360_000_000;
    public static long deviceLifetime = 360_000_000;

    // CA certificate & OCSP Certificates, because they are often used.
    public static SystemAccount CA;
    public static SystemAccount OCSP;
    // Whether JAMS is behind a reverse proxy or not.
    public static boolean reverseProxy = false;
    // Flag to indicate completion of the revokeCertificate method
    private boolean revokeCompleted = false;
    private final Object lock = new Object();

    static {
        Security.addProvider(new BouncyCastleProvider());
    }

    @Override
    public void init(String settings, SystemAccount ca, SystemAccount ocsp) {
        Gson gson = GsonFactory.createGson();
        CertificateAuthorityConfig config =
                gson.fromJson(settings, CertificateAuthorityConfig.class);
        CA = ca;
        OCSP = ocsp;
        serverDomain = config.getServerDomain();
        signingAlgorithm = config.getSigningAlgorithm();

        crlLifetime = config.getCrlLifetime();
        userLifetime = config.getUserLifetime();
        deviceLifetime = config.getDeviceLifetime();
        reverseProxy = config.getReverseProxy();

        if (deviceLifetime > userLifetime) {
            log.warn(
                    "Device lifetime is greater than user lifetime, this is not recommended, please change this in the config file.");
        }

        X509Certificate cert = ca.getCertificate();
        long caLifetime = cert.getNotAfter().getTime() - cert.getNotBefore().getTime();

        if (userLifetime > caLifetime) {
            log.warn(
                    "User lifetime is greater than CA lifetime, this is not recommended, please change this in the config file.");
        }

        if (ca != null && ocsp != null) {
            crlWorker = new CRLWorker(CA.getPrivateKey(), CA.getCertificate());
            crlWorker.setRevocationCallback(this);
            try {
                ocspWorker = new OCSPWorker(OCSP.getPrivateKey(), OCSP.getCertificate(), crlWorker);
            } catch (Exception e) {
                log.error(
                        "An error occurred while starting OCSP request processor: {}",
                        e.getMessage());
            }
        }
    }

    @Override
    public User getSignedCertificate(User user) {
        return CertificateWorker.getSignedCertificate(user);
    }

    @Override
    public User getRefreshedCertificate(User user) {
        return CertificateWorker.getRefreshedCertificate(user);
    }

    @Override
    public Device getSignedCertificate(User user, Device device) {
        return CertificateWorker.getSignedCertificate(user, device);
    }

    @Override
    public SystemAccount getSignedCertificate(SystemAccount systemAccount) {
        return CertificateWorker.getSignedCertificate(systemAccount);
    }

    @Override
    public void revokeCertificate(RevocationRequest revocationRequest) {
        crlWorker.getInput().add(revocationRequest);
        synchronized (crlWorker.getInput()) {
            crlWorker.getInput().notify();
        }
    }

    @Override
    public void onRevocationCompleted() {
        revokeCompleted = true;
        // Notify waiting threads
        synchronized (lock) {
            lock.notifyAll();
        }
    }

    public synchronized void waitForRevokeCompletion() throws InterruptedException {
        synchronized (lock) {
            while (!revokeCompleted) {
                lock.wait(); // Wait until revokeCertificate completes and notifies
            }
            // Reset the flag after processing the completion notification
            revokeCompleted = false;
        }
    }

    @Override
    public AtomicReference<X509CRLHolder> getLatestCRL() {
        return crlWorker.getExistingCRL();
    }

    @Override
    public String getLatestCRLPEMEncoded() {
        try {
            return Base64.getEncoder().encodeToString(getLatestCRL().get().getEncoded());
        } catch (Exception e) {
            log.error("Unable to return a valid CRL!");
            return null;
        }
    }

    public static OCSPResp getOCSPResponse(
            OCSPReq ocspRequest,
            X509Certificate certificate,
            PrivateKey privateKey,
            Boolean unknown)
            throws OCSPException {
        return ocspWorker.getOCSPResponse(ocspRequest, certificate, privateKey, unknown);
    }

    @Override
    public X509Certificate getCA() {
        return CA.getCertificate();
    }

    @Override
    public boolean shutdownThreads() {
        CRLWorker worker = crlWorker;
        if (worker != null) {
            worker.getStop().set(true);
            worker.interrupt();
            try {
                worker.join();
            } catch (InterruptedException _) {
                Thread.currentThread().interrupt();
                log.warn("Interrupted while waiting for the CRL worker to terminate.");
                return false;
            }
        }
        crlWorker = null;
        return true;
    }
}
