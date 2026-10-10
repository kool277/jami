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

package net.jami.jams.ad.connector.service;

import com.imperva.ddc.core.Connector;
import com.imperva.ddc.core.language.PhraseOperator;
import com.imperva.ddc.core.language.QueryAssembler;
import com.imperva.ddc.core.language.Sentence;
import com.imperva.ddc.core.language.SentenceOperator;
import com.imperva.ddc.core.query.DirectoryType;
import com.imperva.ddc.core.query.Endpoint;
import com.imperva.ddc.core.query.EntityResponse;
import com.imperva.ddc.core.query.Field;
import com.imperva.ddc.core.query.FieldType;
import com.imperva.ddc.core.query.ObjectType;
import com.imperva.ddc.core.query.QueryRequest;
import com.imperva.ddc.core.query.QueryResponse;

import lombok.extern.slf4j.Slf4j;

import net.jami.datastore.main.DataStore;
import net.jami.jams.ad.connector.ADConnector;
import net.jami.jams.common.objects.user.UserProfile;
import net.jami.jams.server.core.workflows.RevokeUserFlow;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Slf4j
public class UserProfileService {
    private static DataStore dataStore;

    public UserProfileService(DataStore dataStore) {
        UserProfileService.dataStore = dataStore;
    }

    private static final ConcurrentHashMap<String, String> fieldMap =
            ADConnector.settings.getFieldMappings();

    public List<UserProfile> getUserProfile(
            String queryString, String field, boolean exactMatch, Optional<Integer> page) {
        Endpoint endpoint = ADConnector.getConnection();
        try {
            QueryRequest queryRequest = buildRequest(endpoint);
            Sentence sentence = null;
            if (queryString.equals("*")) {
                sentence =
                        new QueryAssembler()
                                .addPhrase(
                                        FieldType.OBJECT_CLASS,
                                        PhraseOperator.EQUAL,
                                        ObjectType.USER.toString())
                                .closeSentence();
            } else {
                if (field.equals("LOGON_NAME")) {
                    if (exactMatch) {
                        sentence =
                                new QueryAssembler()
                                        .addPhrase(
                                                FieldType.LOGON_NAME,
                                                PhraseOperator.EQUAL,
                                                queryString)
                                        .closeSentence();
                    } else {
                        sentence =
                                new QueryAssembler()
                                        .addPhrase(
                                                FieldType.LOGON_NAME,
                                                PhraseOperator.CONTAINS,
                                                queryString)
                                        .closeSentence();
                    }
                }
                if (field.equals("FULL_TEXT_NAME")) {
                    sentence =
                            new QueryAssembler()
                                    .addPhrase(
                                            FieldType.FIRST_NAME,
                                            PhraseOperator.CONTAINS,
                                            queryString)
                                    .addPhrase(
                                            FieldType.LAST_NAME,
                                            PhraseOperator.CONTAINS,
                                            queryString)
                                    .closeSentence(SentenceOperator.OR);
                }
            }
            queryRequest.addSearchSentence(sentence);
            QueryResponse queryResponse;
            try (Connector connector = new Connector(queryRequest)) {
                queryResponse = connector.execute();
            }
            List<List<Field>> results =
                    queryResponse.getAll().stream()
                            .map(EntityResponse::getValue)
                            .collect(Collectors.toList());

            DataStore.NUM_PAGES = (Integer) results.size() / DataStore.RESULTS_PER_PAGE;
            if (results.size() % DataStore.RESULTS_PER_PAGE != 0) DataStore.NUM_PAGES++;

            if (page.isPresent() && !results.isEmpty()) {
                if (results.size() < DataStore.RESULTS_PER_PAGE)
                    results = results.subList(0, results.size());
                else if (page.get() * DataStore.RESULTS_PER_PAGE > results.size())
                    results =
                            results.subList(
                                    (page.get() - 1) * DataStore.RESULTS_PER_PAGE, results.size());
                else
                    results =
                            results.subList(
                                    (page.get() - 1) * DataStore.RESULTS_PER_PAGE,
                                    (page.get() * DataStore.RESULTS_PER_PAGE));
            }

            if (results.size() == 0) return new ArrayList<>();
            List<UserProfile> profilesFromResponse =
                    results.stream()
                            .map(UserProfileService::profileFromResponse)
                            .collect(Collectors.toList());
            for (UserProfile p : profilesFromResponse) {
                dataStore.getUserProfileDao().insertIfNotExists(p);
            }

            return profilesFromResponse;
        } catch (Exception e) {
            log.error(
                    "An error occurred while attempting to find the entity with the specified parameters.");
            return null;
        } finally {
            ADConnector.returnConnection(endpoint);
        }
    }

    public static QueryRequest buildRequest(Endpoint endpoint) {
        QueryRequest queryRequest = new QueryRequest();
        queryRequest.setDirectoryType(DirectoryType.MS_ACTIVE_DIRECTORY);
        queryRequest.setEndpoints(
                new ArrayList<>() {
                    {
                        add(endpoint);
                    }
                });
        queryRequest.setSizeLimit(1000);
        queryRequest.setTimeLimit(1000);
        queryRequest.setObjectType(ObjectType.USER);
        for (String field : fieldMap.keySet()) {
            queryRequest.addRequestedField(field);
        }
        return queryRequest;
    }

    public static UserProfile profileFromResponse(List<Field> fields) {
        fieldMap.forEach(
                (k, v) -> {
                    String temp = v;
                    fieldMap.put(k.toLowerCase(), temp);
                });
        fieldMap.forEach(
                (k, v) -> {
                    char[] charArray = k.toCharArray();
                    for (int i = 0; i < charArray.length; i++) {
                        if (Character.isUpperCase(charArray[i])) {
                            fieldMap.remove(k);
                            break;
                        }
                    }
                });

        try {
            UserProfile userProfile = new UserProfile();
            for (Field field : fields) {
                if (fieldMap.containsKey(field.getName())) {
                    UserProfile.exposedMethods
                            .get("set" + fieldMap.get(field.getName()))
                            .invoke(userProfile, field.getValue());
                }
            }
            return userProfile;
        } catch (Exception e) {
            log.error("An error occurred while invoking methods: " + e);
            return null;
        }
    }

    public void synchronizeUsersWithAD() {
        log.info("Synchronizing Active Directory user profiles");
        // Fetch all users from the Active Directory
        List<UserProfile> profilesFromAD =
                getUserProfile("*", "LOGON_NAME", false, Optional.empty());
        // Do not revoke users if there is an error, the AD server could be down.
        if (profilesFromAD != null && !profilesFromAD.isEmpty()) {
            // There is a use case where a user is not in the AD server but is in the database.
            // When this happens, we need to revoke the user from the database.
            List<UserProfile> profilesFromDatabase =
                    dataStore.getUserProfileDao().getAllUserProfile();
            for (UserProfile p : profilesFromDatabase) {
                if (profilesFromAD.stream()
                        .noneMatch(r -> r.getUsername().equals(p.getUsername()))) {
                    log.info("Revoking user " + p.getUsername() + " from the database.");
                    RevokeUserFlow.revokeUser(p.getUsername());
                    // We also remove the user from the local_directory table to avoid duplicate
                    // revocations
                    dataStore.getUserProfileDao().deleteUserProfile(p.getUsername());
                }
            }
        }
    }
}
