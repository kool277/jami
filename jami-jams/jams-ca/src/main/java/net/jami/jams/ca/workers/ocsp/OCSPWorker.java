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
package net.jami.jams.ca.workers.ocsp;

import static net.jami.jams.ca.JamsCA.*;

import lombok.Getter;
import lombok.extern.slf4j.Slf4j;

import net.jami.jams.ca.workers.crl.CRLWorker;
import net.jami.jams.common.cryptoengineapi.ocsp.CertificateStatus;
import net.jami.jams.common.cryptoengineapi.ocsp.CertificateSummary;
import net.jami.jams.common.cryptoengineapi.ocsp.OCSPCertificateStatusMapper;

import org.bouncycastle.asn1.ocsp.OCSPObjectIdentifiers;
import org.bouncycastle.asn1.x509.Extension;
import org.bouncycastle.asn1.x509.Extensions;
import org.bouncycastle.asn1.x509.SubjectPublicKeyInfo;
import org.bouncycastle.cert.X509CRLEntryHolder;
import org.bouncycastle.cert.X509CertificateHolder;
import org.bouncycastle.cert.jcajce.JcaX509CertificateHolder;
import org.bouncycastle.cert.ocsp.*;
import org.bouncycastle.operator.ContentSigner;
import org.bouncycastle.operator.DefaultDigestAlgorithmIdentifierFinder;
import org.bouncycastle.operator.DigestCalculatorProvider;
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder;
import org.bouncycastle.operator.jcajce.JcaContentVerifierProviderBuilder;
import org.bouncycastle.operator.jcajce.JcaDigestCalculatorProviderBuilder;

import java.math.BigInteger;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Date;

@Slf4j
public class OCSPWorker {

    // OCSP requests are answered synchronously on the caller's thread, so this is a plain
    // request handler rather than a background worker.
    @Getter private final PrivateKey signingKey;
    @Getter private final X509Certificate certificate;

    private final CRLWorker crlWorker;
    private final RespID responderID;
    private final ContentSigner contentSigner;
    private final JcaContentVerifierProviderBuilder contentVerifierProvider =
            new JcaContentVerifierProviderBuilder().setProvider("BC");

    // To process OCSP requests we need access to the CRL, hence we might as well just pass it here.
    public OCSPWorker(PrivateKey privateKey, X509Certificate certificate, CRLWorker crlWorker)
            throws Exception {
        this.signingKey = privateKey;
        this.certificate = certificate;
        this.crlWorker = crlWorker;
        DigestCalculatorProvider digestCalculatorProvider =
                new JcaDigestCalculatorProviderBuilder().setProvider("BC").build();
        // only SHA-1 is supported for responder IDs.
        this.responderID =
                new RespID(
                        SubjectPublicKeyInfo.getInstance(
                                CA.getCertificate().getPublicKey().getEncoded()),
                        digestCalculatorProvider.get(
                                new DefaultDigestAlgorithmIdentifierFinder().find("SHA-1")));
        this.contentSigner =
                new JcaContentSignerBuilder("SHA256withRSA")
                        .setProvider("BC")
                        .build(CA.getPrivateKey());
        log.info("Instantiated OCSP Worker...");
    }

    public OCSPResp getOCSPResponse(
            OCSPReq ocspRequest,
            X509Certificate certificate,
            PrivateKey privateKey,
            Boolean unknown)
            throws OCSPException {
        try {
            if (validateRequest(ocspRequest) != null)
                throw new OCSPException(
                        "Request is not valid"); // this means the request is invalid and we should
            // notify the client.
            // If the request was valid, we move on to other things.
            BasicOCSPRespBuilder responseBuilder = new BasicOCSPRespBuilder(responderID);
            // Add appropriate extensions
            Collection<Extension> responseExtensions = new ArrayList<>();
            // nonce
            Extension nonceExtension =
                    ocspRequest.getExtension(OCSPObjectIdentifiers.id_pkix_ocsp_nonce);
            if (nonceExtension != null) responseExtensions.add(nonceExtension);
            Extension[] extensions =
                    responseExtensions.toArray(new Extension[responseExtensions.size()]);
            responseBuilder.setResponseExtensions(new Extensions(extensions));

            for (Req request : ocspRequest.getRequestList())
                addResponse(responseBuilder, request, unknown);

            BasicOCSPResp basicResponse =
                    responseBuilder.build(
                            new JcaContentSignerBuilder("SHA256withRSA")
                                    .setProvider("BC")
                                    .build(privateKey),
                            new X509CertificateHolder[] {new JcaX509CertificateHolder(certificate)},
                            new Date());
            return new OCSPRespBuilder().build(OCSPRespBuilder.SUCCESSFUL, basicResponse);
        } catch (Exception e) {
            log.error(
                    "An OCSP request error occurred while verifying signature: {}", e.getMessage());
            return null;
        }
    }

    private OCSPResp validateRequest(OCSPReq ocspRequest) throws Exception {
        if (ocspRequest == null
                || (ocspRequest.isSigned()
                        && !ocspRequest.isSignatureValid(
                                contentVerifierProvider.build(ocspRequest.getCerts()[0])))) {
            return new OCSPRespBuilder().build(OCSPRespBuilder.MALFORMED_REQUEST, null);
        }
        return null;
    }

    private CertificateSummary getCertificateSummary(BigInteger serial, Boolean unknown) {

        if (unknown) {
            return CertificateSummary.newBuilder()
                    .withStatus(CertificateStatus.UNKNOWN)
                    .withSerialNumber(serial)
                    .build();
        }

        X509CRLEntryHolder x509CRLEntryHolder =
                crlWorker.getExistingCRL().get().getRevokedCertificate(serial);

        if (x509CRLEntryHolder != null)
            return CertificateSummary.newBuilder()
                    .withStatus(CertificateStatus.REVOKED)
                    .withSerialNumber(serial)
                    .withRevocationTime(
                            LocalDateTime.ofInstant(
                                    x509CRLEntryHolder.getRevocationDate().toInstant(),
                                    ZoneId.systemDefault()))
                    .build();
        return CertificateSummary.newBuilder()
                .withStatus(CertificateStatus.VALID)
                .withSerialNumber(serial)
                .build();
    }

    private void addResponse(BasicOCSPRespBuilder responseBuilder, Req request, Boolean unknown)
            throws OCSPException {
        CertificateID certificateID = request.getCertID();
        // Build Extensions
        Extensions requestExtensions = request.getSingleRequestExtensions();
        if (requestExtensions != null) {
            Extension nonceExtension =
                    requestExtensions.getExtension(OCSPObjectIdentifiers.id_pkix_ocsp_nonce);
            Extensions extensions = new Extensions(nonceExtension);
            responseBuilder.addResponse(
                    certificateID,
                    OCSPCertificateStatusMapper.getStatus(
                            getCertificateSummary(request.getCertID().getSerialNumber(), unknown)),
                    new Date(),
                    new Date(new Date().getTime() + crlLifetime),
                    extensions);
        } else {
            responseBuilder.addResponse(
                    certificateID,
                    OCSPCertificateStatusMapper.getStatus(
                            getCertificateSummary(request.getCertID().getSerialNumber(), unknown)),
                    new Date(),
                    new Date(new Date().getTime() + crlLifetime));
        }
    }
}
