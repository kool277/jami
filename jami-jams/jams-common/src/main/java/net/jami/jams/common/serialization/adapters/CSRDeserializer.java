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

import net.jami.jams.common.utils.X509Utils;

import org.bouncycastle.pkcs.PKCS10CertificationRequest;

import java.lang.reflect.Type;

public class CSRDeserializer implements JsonDeserializer<PKCS10CertificationRequest> {
    @Override
    public PKCS10CertificationRequest deserialize(
            JsonElement json, Type typeOfT, JsonDeserializationContext context)
            throws JsonParseException {
        return X509Utils.getCSRFromString(json.getAsString());
    }
}
