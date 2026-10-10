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
package net.jami.jams.common.serialization.adapters;

import com.google.gson.*;

import net.jami.jams.common.objects.devices.Device;
import net.jami.jams.common.utils.X509Utils;

import java.lang.reflect.Type;

public class DeviceAdapter implements JsonSerializer<Device> {
    @Override
    public JsonElement serialize(Device device, Type typeOfSrc, JsonSerializationContext context) {
        JsonObject output = new JsonObject();
        output.addProperty("deviceId", device.getDeviceId());
        output.addProperty("displayName", device.getDisplayName());
        output.addProperty(
                "certificate", X509Utils.getPEMStringFromCertificate(device.getCertificate()));
        output.addProperty("revoked", device.getRevoked());
        return output;
    }
}
