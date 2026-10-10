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
package net.jami.jams.ca.workers.crl;

import net.jami.jams.common.serialization.fs.FileStorage;

import org.bouncycastle.cert.X509CRLHolder;

public class CRLFileStorage extends FileStorage<X509CRLHolder> {

    public CRLFileStorage(String file) {
        super(file);
    }

    @Override
    public X509CRLHolder getObject(byte[] bytes) throws Exception {
        return new X509CRLHolder(bytes);
    }

    @Override
    public byte[] getBytesFromObject(X509CRLHolder object) throws Exception {
        return object.getEncoded();
    }
}
