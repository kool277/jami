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
package launcher.zmq;

import lombok.Getter;

import org.zeromq.ZMQ;

import java.util.concurrent.atomic.AtomicBoolean;

@Getter
public class MessageReceiver extends Thread {

    private final ZMQ.Socket socket;
    private final AtomicBoolean atomicBoolean;

    public MessageReceiver(ZMQ.Socket socket, AtomicBoolean atomicBoolean) {
        this.socket = socket;
        this.atomicBoolean = atomicBoolean;
    }

    @Override
    public void run() {
        while (true) {
            try {
                String message = socket.recvStr();
                if (message.equals("DO-UPDATE")) {
                    // Use wait-notify mechanism to avoid burning CPU cycles.
                    synchronized (atomicBoolean) {
                        atomicBoolean.set(true);
                        atomicBoolean.notify();
                    }
                }
            } catch (Exception e) {
                System.out.println("Some exception occurred!");
            }
        }
    }
}
