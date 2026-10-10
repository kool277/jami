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
package net.jami.jams.server.update;

import com.google.gson.Gson;
import com.google.gson.JsonObject;

import lombok.extern.slf4j.Slf4j;

import net.jami.jams.common.serialization.adapters.GsonFactory;
import net.jami.jams.common.updater.FileDescription;
import net.jami.jams.server.licensing.LicenseService;

import org.apache.http.HttpResponse;
import org.apache.http.client.HttpClient;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.ssl.SSLContexts;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.security.KeyStore;
import java.security.cert.Certificate;
import java.util.HashMap;

import javax.net.ssl.SSLContext;

@Slf4j
public class UpdateDownloader {

    private SSLContext sslContext;
    private static final String KEYSTORE_TYPE = "JKS";
    private static volatile String UPDATE_SERVER_URL;

    private final HashMap<String, FileDescription> remoteChecksums = new HashMap<>();

    private final Gson gson = GsonFactory.createGson();

    public UpdateDownloader() {

        InputStream input = this.getClass().getClassLoader().getResourceAsStream("oem/config.json");

        if (input == null) {
            log.warn("Missing OEM configuration! Please contact software developer.");
            System.exit(-1);
        }
        Reader reader = new InputStreamReader(input);
        JsonObject jsonObject = gson.fromJson(reader, JsonObject.class);
        UPDATE_SERVER_URL = jsonObject.get("UPDATE_URL").getAsString();
    }

    public boolean downloadFiles(HashMap<String, FileDescription> files) {
        // I know this contradicts my dogma, but this really would have been an overkill for this
        // project,
        // I just claim that everything which is not core gets dumped to the lib directory.
        // We can perpetually reload this,it doesn't really harm anything.
        // Build the SSL context here, (this is fairly simple)
        KeyStore ks = null;
        try {
            ks = KeyStore.getInstance(KEYSTORE_TYPE);
            ks.load(null);
            LicenseService licenseService = new LicenseService();
            licenseService.loadLicense();
            ks.setKeyEntry(
                    "licenses",
                    JAMSUpdater.privateKey,
                    "".toCharArray(),
                    new Certificate[] {JAMSUpdater.certificate});
            sslContext = SSLContexts.createSystemDefault();

        } catch (Exception e) {
            log.warn("An error occurred while downloading the update: " + e);
        }

        // temp folder for safe download and integrity check
        File tmpFolder = new File(System.getProperty("user.dir") + "/tmp/");

        if (!tmpFolder.exists()) {
            try {
                tmpFolder.mkdirs();
            } catch (Exception e) {
                log.error("An error occurred while creating folder: " + e);
                return false;
            }
        }

        files.forEach(
                (k, v) -> {
                    try {
                        File tmpFile =
                                new File(
                                        System.getProperty("user.dir") + "/tmp/" + v.getFileName());
                        if (tmpFile.exists()) {

                            try {
                                tmpFile.delete();
                            } catch (Exception e) {
                                log.warn(
                                        "An error occurred while deleting file: "
                                                + v.getFileName()
                                                + " with error "
                                                + e);
                            }
                        }
                        HttpClient httpClient =
                                HttpClients.custom().setSSLContext(sslContext).build();
                        HttpResponse httpResponse =
                                httpClient.execute(
                                        new HttpGet(
                                                UPDATE_SERVER_URL + "/updates/" + v.getFileName()));
                        if (httpResponse.getStatusLine().getStatusCode() != 200) return;
                        FileOutputStream fos =
                                new FileOutputStream(tmpFolder.getPath() + "/" + v.getFileName());
                        httpResponse.getEntity().writeTo(fos);
                        fos.close();
                    } catch (Exception e1) {
                        log.warn("An error occurred while downloading the update: " + e1);
                    }
                });

        return true;
    }
}
