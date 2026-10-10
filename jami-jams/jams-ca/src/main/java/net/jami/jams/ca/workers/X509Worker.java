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
package net.jami.jams.ca.workers;

import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;

import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.concurrent.ConcurrentLinkedQueue;

@Getter
@Setter
@Slf4j
public abstract class X509Worker<T> extends Thread {

    private ConcurrentLinkedQueue<T> input = new ConcurrentLinkedQueue<>();
    private PrivateKey signingKey;
    private X509Certificate certificate;

    public X509Worker(PrivateKey privateKey, X509Certificate certificate) {
        this.signingKey = privateKey;
        this.certificate = certificate;
    }
}
