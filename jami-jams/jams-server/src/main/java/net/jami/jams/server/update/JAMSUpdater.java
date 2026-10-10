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

import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;

import net.jami.jams.common.serialization.adapters.GsonFactory;
import net.jami.jams.common.updater.AppUpdater;
import net.jami.jams.common.updater.FileDescription;
import net.jami.jams.server.Server;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.HashMap;
import java.util.Timer;
import java.util.concurrent.atomic.AtomicBoolean;

@Slf4j
@Getter
@Setter
public class JAMSUpdater implements AppUpdater {

    protected static volatile String UPDATE_SERVER_URI;
    private static volatile Long UPDATE_INTERVAL;

    public static final AtomicBoolean updateAvailable = new AtomicBoolean(false);
    private final AtomicBoolean doUpdate;
    private final UpdateCheckTask updateCheckTask = new UpdateCheckTask();
    private final UpdateDownloader updateDownloader = new UpdateDownloader();
    private final Timer timer = new Timer();
    // These get written to from the server, so we set them to volatile for visibility purposes.
    public static volatile X509Certificate certificate;
    public static volatile PrivateKey privateKey;

    private final Gson gson = GsonFactory.createGson();

    public JAMSUpdater(AtomicBoolean doUpdate) {

        // read config json
        InputStream input = this.getClass().getClassLoader().getResourceAsStream("oem/config.json");
        Reader reader = new InputStreamReader(input);
        JsonObject jsonObject = gson.fromJson(reader, JsonObject.class);
        UPDATE_SERVER_URI = jsonObject.get("UPDATE_URL").getAsString();
        UPDATE_INTERVAL = jsonObject.get("UPDATE_INTERVAL").getAsLong();

        this.doUpdate = doUpdate;
        timer.schedule(updateCheckTask, 0, UPDATE_INTERVAL);
    }

    @Override
    public HashMap<String, FileDescription> getLocalVersions() {
        return updateCheckTask.getLocalData();
    }

    @Override
    public HashMap<String, FileDescription> getRemoteVersions() {
        return updateCheckTask.getRemoteData();
    }

    @Override
    public boolean getUpdateAvailable() {
        return updateAvailable.get();
    }

    @Override
    public void setLicense(X509Certificate certificate, PrivateKey privateKey) {
        JAMSUpdater.certificate = certificate;
        JAMSUpdater.privateKey = privateKey;
    }

    @Override
    public void doUpdate() {
        // Some logic here about replacing the existing files.
        boolean res = updateDownloader.downloadFiles(getRemoteVersions());
        // Notify back up-stream to the launcher that we want the update to happen.
        if (res) Server.updateInterface.approveUpdate();
        else
            log.error(
                    "An error occurred while attempting to perform the update. This could be a hardware problem or a corrupt file. Try the download again.");
    }
}
