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
package net.jami.jams.common.objects.responses;

import com.google.gson.Gson;

import lombok.Getter;
import lombok.Setter;

import net.jami.jams.common.objects.user.PolicyData;
import net.jami.jams.common.serialization.adapters.GsonFactory;
import net.jami.jams.common.utils.X509Utils;

import java.security.cert.X509Certificate;

@Getter
@Setter
public class DeviceRegistrationResponse {

    private String certificateChain;
    private String displayName;
    private String nameServer;
    private String deviceReceipt;
    private String receiptSignature;
    private String userPhoto;
    // Backward compatibility fix so all the fields are included here.
    private Boolean publicInCalls;
    private Boolean proxyEnabled;
    private String dhtProxyListUrl;
    private String proxyServer;
    private Boolean accountPublish;
    private Boolean autoAnswer;
    private String turnServer;
    private String turnServerUserName;
    private String turnServerPassword;
    private Boolean videoEnabled;
    private Boolean turnEnabled;
    private Boolean accountDiscovery;
    private Boolean peerDiscovery;
    private Boolean upnpEnabled;
    private Boolean rendezVous;
    private String defaultModerators;
    private String uiCustomization;

    public void setCertificateChain(X509Certificate[] certificateChain) {
        StringBuilder stringBuilder = new StringBuilder();
        for (int i = certificateChain.length - 1; i > -1; i--) {
            stringBuilder
                    .append(X509Utils.getPEMStringFromCertificate(certificateChain[i]))
                    .append("\n");
        }
        // remove the last \n because it's useless.
        stringBuilder.deleteCharAt(stringBuilder.length() - 1);
        this.certificateChain = stringBuilder.toString();
    }

    public void setPolicyData(String policyData) {
        Gson gson = GsonFactory.createGson();
        PolicyData policy = gson.fromJson(policyData, PolicyData.class);
        this.publicInCalls = policy.getPublicInCalls();
        this.proxyEnabled = policy.getProxyEnabled();
        this.dhtProxyListUrl = policy.getDhtProxyListUrl();
        this.proxyServer = policy.getProxyServer();
        this.accountPublish = policy.getAccountPublish();
        this.autoAnswer = policy.getAutoAnswer();
        this.turnServer = policy.getTurnServer();
        this.turnServerUserName = policy.getTurnServerUserName();
        this.turnServerPassword = policy.getTurnServerPassword();
        this.videoEnabled = policy.getVideoEnabled();
        this.turnEnabled = policy.getTurnEnabled();
        this.accountDiscovery = policy.getAccountDiscovery();
        this.peerDiscovery = policy.getPeerDiscovery();
        this.upnpEnabled = policy.getUpnpEnabled();
        this.rendezVous = policy.getRendezVous();
        this.defaultModerators = policy.getDefaultModerators();
        this.uiCustomization = policy.getUiCustomization();
    }
}
