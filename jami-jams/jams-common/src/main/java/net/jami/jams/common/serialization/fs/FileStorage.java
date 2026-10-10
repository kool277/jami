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
package net.jami.jams.common.serialization.fs;

import lombok.Getter;
import lombok.Setter;

import java.io.File;
import java.io.FileDescriptor;
import java.io.FileInputStream;
import java.io.FileOutputStream;

@Getter
@Setter
public abstract class FileStorage<T> {

    private File file;
    private FileInputStream fileInputStream;
    private FileOutputStream fileOutputStream;
    private FileDescriptor fileDescriptor;

    public FileStorage(String file) {
        this.file = new File(file);
    }

    public abstract T getObject(byte[] bytes) throws Exception;

    public abstract byte[] getBytesFromObject(T object) throws Exception;

    public T getData() throws Exception {
        fileInputStream = new FileInputStream(file);
        return getObject(fileInputStream.readAllBytes());
    }

    public void storeData(T data) throws Exception {
        fileOutputStream = new FileOutputStream(file);
        fileDescriptor = fileOutputStream.getFD();
        fileOutputStream.write(getBytesFromObject(data));
        fileOutputStream.flush();
        fileDescriptor.sync();
    }
}
