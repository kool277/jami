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
package net.jami.datastore.dao;

import net.jami.jams.common.objects.user.UserProfile;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public class UserProfileDao extends AbstractDao<UserProfile> {

    // Fix this to include the fields from AD/LDAP.
    public UserProfileDao() {
        this.setTableName("local_directory");
        this.setTClass(UserProfile.class);
    }

    public void insertIfNotExists(UserProfile userProfile) throws SQLException {
        String update =
                "UPDATE local_directory SET username = ?, firstName = ?, lastName = ?, email = ?, profilePicture = ?, organization=?, phoneNumber=?, phoneNumberExtension=?, faxNumber=?, mobileNumber=?"
                        + "WHERE username = ?";

        String insert =
                "INSERT INTO local_directory (username, firstName, lastName, email, profilePicture, organization, phoneNumber, phoneNumberExtension, faxNumber, mobileNumber) VALUES "
                        + "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        List<String> params = new ArrayList<>();
        params.add(userProfile.getUsername());
        params.add(userProfile.getFirstName());
        params.add(userProfile.getLastName());
        params.add(userProfile.getEmail());
        params.add(userProfile.getProfilePicture());
        params.add(userProfile.getOrganization());
        params.add(userProfile.getPhoneNumber());
        params.add(userProfile.getPhoneNumberExtension());
        params.add(userProfile.getFaxNumber());
        params.add(userProfile.getMobileNumber());
        params.add(userProfile.getUsername());

        // Attempt to update the user profile first
        boolean updateSuccess = this.executeUpdate(update, params);
        if (!updateSuccess) {
            // Remove the last parameter from the list since it is not needed for the insert
            // statement
            if (!params.isEmpty()) {
                params.remove(params.size() - 1);
            }
            // If the update fails, insert the user profile
            this.executeUpdate(insert, params);
        }
    }

    public List<UserProfile> getAllUserProfile() {
        return getObjectsFromResultSet("SELECT * FROM local_directory");
    }

    public List<UserProfile> searchUsername(String username) {
        String query = "SELECT * FROM local_directory WHERE username LIKE ?";
        return getObjectsFromResultSet(query, username + "%");
    }

    public List<UserProfile> searchFullName(String name) {
        String query = "SELECT * FROM local_directory WHERE firstName LIKE ? OR lastName LIKE ?";
        name = name + "%";
        return getObjectsFromResultSet(query, List.of(name, name));
    }

    public Optional<UserProfile> getByUsername(String username) {
        return getFirstObjectFromResultSet(
                "SELECT * FROM local_directory WHERE username = ?", username);
    }

    @Override
    public boolean storeObject(UserProfile object) {
        String query =
                "INSERT INTO local_directory "
                        + "(firstName, lastName, email, profilePicture, organization, phoneNumber, phoneNumberExtension, faxNumber, mobileNumber, username)"
                        + " VALUES "
                        + "(?,?,?,?,?,?,?,?,?,?)";
        return executeInsert(query, object);
    }

    public boolean updateUserProfile(UserProfile userProfile) {
        String query =
                "UPDATE local_directory SET"
                        + " firstname = ?,"
                        + " lastName = ?,"
                        + " email = ?,"
                        + " profilePicture = ?,"
                        + " organization = ?,"
                        + " phoneNumber = ?,"
                        + " phoneNumberExtension = ?,"
                        + " faxNumber = ?,"
                        + " mobileNumber = ?"
                        + " WHERE username = ?";
        return executeInsert(query, userProfile);
    }

    public boolean deleteUserProfile(String username) {
        String query = "DELETE FROM local_directory WHERE username = ?";
        List<String> params = new ArrayList<>();
        params.add(username);
        return this.executeUpdate(query, params);
    }
}
