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

package launcher;

import launcher.zmq.MessageReceiver;

import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;

import org.zeromq.SocketType;
import org.zeromq.ZMQ;

import java.io.File;
import java.io.IOException;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicBoolean;

@Slf4j
@Getter
@Setter
public class AppStarter extends Thread {

    private final AtomicBoolean doUpdate = new AtomicBoolean(false);
    public static ZMQ.Context context = ZMQ.context(1);
    private static ZMQ.Socket publisher;
    private static ZMQ.Socket receiver;
    private MessageReceiver messageReceiver;
    private static String[] parentArgs;
    private long jamsProcessId = -1L;

    /**
     * The launcher is essentially responsible of firing up the main application JAR. The
     * problematic here is whenever we will fire up a JAR (but then we need to be able to kill and
     * restart his PID, or whenever we fork via a main).
     */
    private void setupZmqBridge() {
        publisher = context.socket(SocketType.PUB);
        publisher.bind("tcp://*:4572");
        // Use this to updater.
        receiver = context.socket(SocketType.REP);
        receiver.bind("tcp://*:4573");
        messageReceiver = new MessageReceiver(receiver, doUpdate);
        messageReceiver.start();
    }

    private void unpackUpdate() {
        for (File f :
                Objects.requireNonNull(
                        new File(System.getProperty("user.dir") + "/tmp/").listFiles())) {
            if (f.getName().contains("jams-server")) {
                if (!f.renameTo(new File(System.getProperty("user.dir") + "/" + f.getName()))) {
                    log.info("An error occurred while attempting to move the file!");
                } else {
                    f.delete();
                }
            } else {
                if (!f.renameTo(
                        new File(System.getProperty("user.dir") + "/libs/" + f.getName()))) {
                    log.info("An error occurred while attempting to move the file!");
                } else {
                    f.delete();
                }
            }
        }
        // delete tmp folder
        new File(System.getProperty("user.dir") + "/tmp/").delete();
    }

    public AppStarter(String[] args) {
        parentArgs = args;
        try {
            jamsProcessId = startAccountManagementServer(args);

            // Get a ProcessHandle for the process with the given PID
            ProcessHandle jamsProcessHandle =
                    ProcessHandle.of(jamsProcessId)
                            .orElseThrow(
                                    () ->
                                            new IllegalArgumentException(
                                                    "No process with PID " + jamsProcessId));

            // Create a separate thread to wait for the child process to finish
            Thread waitForProcessThread =
                    new Thread(
                            () -> {
                                try {
                                    jamsProcessHandle
                                            .onExit()
                                            .thenAccept(
                                                    ph -> {
                                                        log.info("JAMS has ended prematurely.");
                                                        System.exit(1);
                                                    })
                                            .get(); // Wait for the process to finish
                                } catch (Exception e) {
                                    e.printStackTrace();
                                }
                            });
            waitForProcessThread.start();

            setupZmqBridge();
            Runtime.getRuntime()
                    .addShutdownHook(
                            new Thread(
                                    () -> {
                                        log.info("Shutting down…");
                                        ProcessHandle.of(jamsProcessId)
                                                .ifPresentOrElse(
                                                        process -> process.destroyForcibly(),
                                                        () ->
                                                                log.warn(
                                                                        "No process with PID "
                                                                                + jamsProcessId));
                                    }));
        } catch (Exception e) {
            log.warn(
                    "An error occurred while attempting to create and bind publisher and/or receiver. Please contact software developer.");
            System.exit(-1);
        }
    }

    public static void main(String[] args) {
        AppStarter appStarter = new AppStarter(args);
        appStarter.start();
    }

    // How this works - once the JAMSUpdater has notified back upstream to do an
    // update, we lockdown
    // and run the good old routine
    @Override
    public void run() {
        // TODO: Hack this a bit to get it to work better - passing arguments damnit.
        while (true) {
            try {
                if (doUpdate.get()) {
                    // Stop current process
                    ProcessHandle.of(jamsProcessId).get().destroyForcibly();
                    // transfer newly downloaded files to the right folder.
                    doUpdate.set(false);
                    // Upack the update.
                    unpackUpdate();
                    // Restart the main JAR and set the processId to it.
                    jamsProcessId = startAccountManagementServer(parentArgs);
                    log.info("Update complete. Now running newest version");
                }
                synchronized (doUpdate) {
                    doUpdate.wait();
                }
            } catch (Exception e) {
                log.error(
                        "An error occurred while attempting to verify if an update was available, or"
                                + "when attempting to reload a library: {}",
                        e.getMessage());
            }
        }
    }

    public static long startAccountManagementServer(String[] parentArgs) throws IOException {
        ProcessBuilder pb = null;
        Process p;
        switch (parentArgs.length) {
            case 1:
                pb = new ProcessBuilder("java", "-jar", "jams-server.jar", parentArgs[0]);
                break;
            case 3:
                pb =
                        new ProcessBuilder(
                                "java",
                                "-Dorg.ldaptive.sortSearchResults=true",
                                "-jar",
                                "jams-server.jar",
                                parentArgs[0],
                                parentArgs[1],
                                parentArgs[2]);
                break;
            default:
                pb = new ProcessBuilder("java", "-jar", "jams-server.jar", "8080");
                break;
        }
        assert pb != null;
        pb.directory(new File(System.getProperty("user.dir")));
        pb.inheritIO();
        p = pb.start();
        return p.pid();
    }
}
