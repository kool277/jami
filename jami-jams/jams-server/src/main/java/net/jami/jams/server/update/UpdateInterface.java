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

import lombok.Getter;
import lombok.Setter;

import org.zeromq.SocketType;
import org.zeromq.ZMQ;

import java.util.concurrent.atomic.AtomicBoolean;

@Getter
@Setter
public class UpdateInterface extends Thread {

    private AtomicBoolean updateAvailable = new AtomicBoolean(false);
    private volatile String versions;
    private ZMQ.Context context = ZMQ.context(1);
    private ZMQ.Socket sender = context.socket(SocketType.REQ);
    private ZMQ.Socket receiver = context.socket(SocketType.SUB);

    public UpdateInterface() {
        receiver.connect("tcp://localhost:4572");
        sender.connect("tcp://localhost:4573");
        receiver.subscribe("UPDATE");
        this.start();
    }

    public void approveUpdate() {
        sender.send("DO-UPDATE");
    }

    @Override
    public void run() {
        while (true) {
            try {
                receiver.recv();
                updateAvailable.set(true);
                versions = receiver.recvStr();
            } catch (Exception e) {
                System.out.println(e);
            }
        }
    }
}
