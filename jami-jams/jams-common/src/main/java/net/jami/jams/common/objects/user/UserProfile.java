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
package net.jami.jams.common.objects.user;

import ezvcard.Ezvcard;
import ezvcard.VCard;
import ezvcard.VCardVersion;
import ezvcard.parameter.EmailType;
import ezvcard.parameter.ImageType;
import ezvcard.parameter.TelephoneType;
import ezvcard.property.Photo;
import ezvcard.property.StructuredName;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import net.jami.jams.common.serialization.database.DatabaseObject;

import org.bouncycastle.util.encoders.Base64;

import java.lang.reflect.Method;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.HashMap;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class UserProfile implements DatabaseObject {

    public static HashMap<String, Method> exposedMethods = new HashMap<>();

    static {
        for (Method method : UserProfile.class.getMethods()) {
            exposedMethods.put(method.getName(), method);
        }
    }

    // We sort of need the username here, because it's our only way of creating users which never
    // existed.
    private String username;
    private String firstName;
    private String lastName;
    private String email;
    private String profilePicture;
    private String organization;
    private String phoneNumber;
    private String phoneNumberExtension;
    private String faxNumber;
    private String mobileNumber;
    private String id;

    public UserProfile(ResultSet rs) throws Exception {
        this.username = rs.getString("username");
        this.firstName = rs.getString("firstName");
        this.lastName = rs.getString("lastName");
        this.email = rs.getString("email");
        this.profilePicture = rs.getString("profilePicture");
        this.organization = rs.getString("organization");
        this.phoneNumber = rs.getString("phoneNumber");
        this.phoneNumberExtension = rs.getString("phoneNumberExtension");
        this.faxNumber = rs.getString("faxNumber");
        this.mobileNumber = rs.getString("mobileNumber");
    }

    public String getAsVCard() {
        VCard vCard = new VCard();

        // We assume these always exist...
        StructuredName structuredName = new StructuredName();
        structuredName.setFamily(URLEncoder.encode(this.getLastName(), StandardCharsets.UTF_8));
        structuredName.setGiven(URLEncoder.encode(this.getFirstName(), StandardCharsets.UTF_8));
        vCard.setStructuredName(structuredName);

        if (this.getPhoneNumber() != null)
            vCard.addTelephoneNumber(this.getPhoneNumber(), TelephoneType.WORK);
        if (this.getMobileNumber() != null)
            vCard.addTelephoneNumber(this.getMobileNumber(), TelephoneType.CELL);
        if (this.getFaxNumber() != null)
            vCard.addTelephoneNumber(this.getFaxNumber(), TelephoneType.FAX);
        if (this.getEmail() != null) vCard.addEmail(this.getEmail(), EmailType.WORK);
        if (this.getOrganization() != null) vCard.setOrganization(this.getOrganization());
        if (this.getId() != null) vCard.setExtendedProperty("id", this.id);

        /*I think this is how Base64 will work in this case*/
        if (this.getProfilePicture() != null) {
            Photo photo = new Photo(Base64.decode(this.getProfilePicture()), ImageType.JPEG);
            vCard.addPhoto(photo);
        }

        return Ezvcard.write(vCard).version(VCardVersion.V3_0).go();
    }

    @Override
    public PreparedStatement getInsert(PreparedStatement ps) throws Exception {
        ps.setString(1, firstName);
        ps.setString(2, lastName);
        ps.setString(3, email);
        ps.setString(4, profilePicture);
        ps.setString(5, organization);
        ps.setString(6, phoneNumber);
        ps.setString(7, phoneNumberExtension);
        ps.setString(8, faxNumber);
        ps.setString(9, mobileNumber);
        ps.setString(10, username);
        return ps;
    }

    @Override
    public PreparedStatement getDelete(PreparedStatement ps) throws Exception {
        return null;
    }

    @Override
    public PreparedStatement getUpdate(PreparedStatement ps) throws Exception {
        return null;
    }

    @Override
    public boolean equals(Object obj) {

        UserProfile profile = (UserProfile) obj;

        return (profile.getUsername().equals(this.username)
                && profile.getFirstName().equals(this.firstName)
                && profile.getLastName().equals(this.lastName));
    }

    public void setDefaultValues() {
        if (this.firstName == null) this.firstName = "";
        if (this.lastName == null) this.lastName = "";
        if (this.email == null) this.email = "";
        if (this.profilePicture == null) this.profilePicture = "";
        if (this.organization == null) this.organization = "";
        if (this.phoneNumber == null) this.phoneNumber = "";
        if (this.phoneNumberExtension == null) this.phoneNumberExtension = "";
        if (this.faxNumber == null) this.faxNumber = "";
        if (this.mobileNumber == null) this.mobileNumber = "";
    }
}
