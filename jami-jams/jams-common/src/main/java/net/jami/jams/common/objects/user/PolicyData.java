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
package net.jami.jams.common.objects.user;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PolicyData {

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
    private Boolean allowLookup;
    private String uiCustomization;
}
