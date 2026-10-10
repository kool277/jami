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
package net.jami.jams.common.utils;

import lombok.extern.slf4j.Slf4j;

import net.jami.jams.common.updater.FileDescription;

import org.bouncycastle.util.encoders.Hex;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.jar.JarFile;
import java.util.stream.Stream;

@Slf4j
public class VersioningUtils {

    public static HashMap<String, FileDescription> checkVersion(String baseLocation) {
        try {
            MessageDigest messageDigest = MessageDigest.getInstance("MD5");
            HashMap<String, FileDescription> res = new HashMap<>();
            ArrayList<Path> files = new ArrayList<>();
            if (baseLocation == null) baseLocation = System.getProperty("user.dir");
            Stream<Path> stream = Files.walk(Paths.get(baseLocation));
            stream.filter(Files::isRegularFile).forEach(files::add);
            stream.close();
            files.forEach(
                    e -> {
                        String fileName = e.toString();
                        if (fileName.endsWith(".jar")) {
                            try {
                                JarFile file = new JarFile(e.toFile());
                                String version =
                                        file.getManifest()
                                                .getMainAttributes()
                                                .getValue("Implementation-Version");
                                String className =
                                        file.getManifest()
                                                .getMainAttributes()
                                                .getValue("Main-Class");
                                String md5 =
                                        Hex.toHexString(
                                                messageDigest.digest(
                                                        Files.readAllBytes(e.toAbsolutePath())));
                                String[] arr = e.toString().split(File.separator);
                                res.put(
                                        arr[arr.length - 1],
                                        new FileDescription(
                                                arr[arr.length - 1], version, md5, className));
                                log.info("Found version {} of {}", version, fileName);
                            } catch (Exception e1) {
                                log.error(
                                        "An error occurred while detecting version for file: {}",
                                        e1.getMessage());
                            }
                        }
                    });
            return res;
        } catch (Exception e) {
            log.error("An error occurred while listing file versions: {}", e.getMessage());
            return null;
        }
    }
}
