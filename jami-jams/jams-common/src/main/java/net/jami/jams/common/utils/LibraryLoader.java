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

import org.apache.xbean.classloader.JarFileClassLoader;

import java.io.File;
import java.net.URL;
import java.util.ArrayList;

@Slf4j
public class LibraryLoader {

    public static JarFileClassLoader classLoader;

    public static void loadlibs(String libDir, Class parentClass) {
        try {
            File dependencyDirectory = new File(libDir);
            File[] files = dependencyDirectory.listFiles();
            ArrayList<URL> urls = new ArrayList<>();
            assert files != null;
            for (int i = 0; i < files.length; i++) {
                if (files[i].getName().endsWith(".jar")) {
                    urls.add(files[i].toURI().toURL());
                    log.info(files[i] + " library loaded successfully.");
                }
            }
            classLoader =
                    new JarFileClassLoader(
                            "Scheduler CL" + System.currentTimeMillis(),
                            urls.toArray(new URL[urls.size()]),
                            parentClass.getClassLoader());
        } catch (Exception e) {
            log.error("An error occurred while loading libraries.");
        }
    }
}
