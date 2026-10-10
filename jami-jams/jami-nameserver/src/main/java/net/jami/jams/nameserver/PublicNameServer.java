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
package net.jami.jams.nameserver;

import com.google.gson.Gson;
import com.google.gson.JsonObject;

import lombok.extern.slf4j.Slf4j;

import net.jami.jams.common.jami.NameLookupResponse;
import net.jami.jams.common.jami.NameRegistrationRequest;
import net.jami.jams.common.jami.NameServer;
import net.jami.jams.common.serialization.adapters.GsonFactory;

import java.net.HttpURLConnection;
import java.net.URL;

@Slf4j
public class PublicNameServer implements NameServer {

    private final String nameserverURI;
    private final Gson gson = GsonFactory.createGson();

    public PublicNameServer(String nameserverURI) {
        this.nameserverURI = nameserverURI;
    }

    @Override
    public Integer registerName(String username, NameRegistrationRequest nameRegistrationRequest) {
        try {
            URL url = new URL(nameserverURI + "/name/" + username);
            HttpURLConnection con = (HttpURLConnection) url.openConnection();
            con.setRequestMethod("POST");
            con.setDoOutput(true);
            con.getOutputStream().write(gson.toJson(nameRegistrationRequest).getBytes());
            con.getOutputStream().close();
            return con.getResponseCode();
        } catch (Exception e) {
            return 500;
        }
    }

    @Override
    public NameLookupResponse getAddressFromName(String username) {
        try {
            URL url = new URL(nameserverURI + "/name/" + username);
            HttpURLConnection con = (HttpURLConnection) url.openConnection();
            con.setRequestMethod("GET");
            if (con.getResponseCode() == 200) {
                StringBuilder responseData = new StringBuilder();
                int respSize = Integer.parseInt(con.getHeaderField("Content-Length"));
                int currentSize = 0;
                while (currentSize < respSize) {
                    responseData.append((char) con.getInputStream().read());
                    currentSize++;
                }
                log.info("Response received from public name server {} ", responseData);
                return gson.fromJson(responseData.toString(), NameLookupResponse.class);
            }
            return null;
        } catch (Exception e) {
            log.info("An error occurred while querying the public name server {} ", e.toString());
            return null;
        }
    }

    @Override
    public String getNameFromAddress(String address) {
        try {
            URL url = new URL(nameserverURI + "/addr/" + address);
            HttpURLConnection con = (HttpURLConnection) url.openConnection();
            con.setRequestMethod("GET");
            if (con.getResponseCode() != 200) {
                return null;
            }

            String responseData = new String(con.getInputStream().readAllBytes());

            log.info("Response received from public name server {} ", responseData);
            JsonObject json = gson.fromJson(responseData.toString(), JsonObject.class);
            return json.get("name").getAsString();
        } catch (Exception e) {
            log.info("An error occurred while querying the public name server {} ", e.toString());
            return null;
        }
    }

    @Override
    public String getURI() {
        return this.nameserverURI;
    }
}
