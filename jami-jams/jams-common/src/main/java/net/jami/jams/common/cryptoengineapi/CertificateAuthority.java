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
package net.jami.jams.common.cryptoengineapi;

import net.jami.jams.common.objects.devices.Device;
import net.jami.jams.common.objects.requests.RevocationRequest;
import net.jami.jams.common.objects.system.SystemAccount;
import net.jami.jams.common.objects.user.User;

import org.bouncycastle.cert.X509CRLHolder;

import java.security.cert.X509Certificate;
import java.util.concurrent.atomic.AtomicReference;

public interface CertificateAuthority {
    // Return a signed X509 certificate based on various constraints.
    void init(String settings, SystemAccount ca, SystemAccount ocsp);

    User getSignedCertificate(User user);

    User getRefreshedCertificate(User user);

    Device getSignedCertificate(User user, Device device);

    SystemAccount getSignedCertificate(SystemAccount systemAccount);

    void revokeCertificate(RevocationRequest revocationRequest);

    void waitForRevokeCompletion() throws InterruptedException;

    AtomicReference<X509CRLHolder> getLatestCRL();

    String getLatestCRLPEMEncoded();

    X509Certificate getCA();

    boolean shutdownThreads();
}
