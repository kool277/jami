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

import net.jami.jams.common.objects.contacts.Contact;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

public class ContactMerger {

    public static List<Contact> mergeContacts(List<Contact> remote, List<Contact> local) {
        // uri - [remote,local]
        List<Contact> output = new ArrayList<>();
        final HashMap<String, Contact[]> contactMap = new HashMap<>();
        remote.forEach(
                contact -> {
                    contactMap.putIfAbsent(contact.getUri(), new Contact[] {null, null});
                    contactMap.get(contact.getUri())[0] = contact;
                });
        local.forEach(
                contact -> {
                    contactMap.putIfAbsent(contact.getUri(), new Contact[] {null, null});
                    contactMap.get(contact.getUri())[1] = contact;
                });
        contactMap.forEach(
                (k, v) -> {
                    if (v[0] == null) output.add(v[1]);
                    else if (v[1] == null) output.add(v[0]);
                    else {
                        Contact lastAdded = v[0].getAdded() > v[1].getAdded() ? v[0] : v[1];
                        Contact lastRemoved = v[0].getRemoved() > v[1].getRemoved() ? v[0] : v[1];
                        lastAdded.setAdded(Math.max(v[0].getAdded(), v[1].getAdded()));
                        lastAdded.setRemoved(Math.max(v[0].getRemoved(), v[1].getRemoved()));
                        if (!lastAdded.isAdded()) {
                            lastAdded.setBanned(lastRemoved.getBanned());
                        }
                        output.add(lastAdded);
                    }
                });
        return output;
    }
}
