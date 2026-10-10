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
package net.jami.jams.ldap.connector;

import net.jami.datastore.main.DataStore;
import net.jami.jams.common.authentication.AuthenticationSourceInfo;
import net.jami.jams.common.authentication.AuthenticationSourceType;
import net.jami.jams.common.dao.connectivity.SQLConnection;
import net.jami.jams.common.objects.user.UserProfile;
import net.jami.jams.ldap.connector.service.UserProfileService;

import org.junit.Assert;
import org.junit.BeforeClass;
import org.junit.Rule;
import org.junit.Test;
import org.junit.jupiter.api.Assertions;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;
import org.ldaptive.filter.FilterParser;
import org.zapodot.junit.ldap.EmbeddedLdapRule;
import org.zapodot.junit.ldap.EmbeddedLdapRuleBuilder;

import java.io.InputStream;
import java.util.List;
import java.util.Optional;

@RunWith(JUnit4.class)
public class LDAPConnectorTest {
    private static LDAPConnector ldapConnector = null;
    private static DataStore dataStore;

    private static void initLdapConnector() throws Exception {
        if (ldapConnector == null) {
            InputStream inputStream =
                    LDAPConnectorTest.class.getClassLoader().getResourceAsStream("ldapconfig.json");
            ldapConnector = new LDAPConnector(new String(inputStream.readAllBytes()), dataStore);
        }
    }

    @BeforeClass
    public static void setUp() throws Exception {
        dataStore = new DataStore("jdbc:derby:memory:testdb;create=true");
        initLdapConnector();
        SQLConnection connection = DataStore.connectionPool.getConnection();
        Assert.assertNotNull(connection);
    }

    @Rule
    public EmbeddedLdapRule server =
            EmbeddedLdapRuleBuilder.newInstance()
                    .usingDomainDsn("dc=savoirfairelinux,dc=net")
                    .bindingToPort(1089)
                    .importingLdifs("bootstrap.ldif")
                    .build();

    @Test
    public void testLookUp() throws Exception {
        List<UserProfile> profiles =
                ldapConnector.searchUserProfiles("*", "FULL_TEXT_NAME", Optional.empty());
        Assertions.assertEquals(3, profiles.size());
    }

    @Test
    public void testAuth() throws Exception {
        boolean res;
        res = ldapConnector.authenticate("fsidokhine", "password");
        Assertions.assertTrue(res);
        res = ldapConnector.authenticate("fsidokhine", "badpassword");
        Assertions.assertFalse(res);
    }

    @Test
    public void getVcard() throws Exception {
        List<UserProfile> profiles =
                ldapConnector.searchUserProfiles("Felix", "FULL_TEXT_NAME", Optional.empty());
        Assert.assertEquals(1, profiles.size());
        Assert.assertNotNull(profiles.get(0).getUsername());
        String vcard = profiles.get(0).getAsVCard();
        Assert.assertNotNull(vcard);
    }

    @Test
    public void testGetInfo() {
        AuthenticationSourceInfo info = ldapConnector.getInfo();
        Assert.assertEquals(AuthenticationSourceType.LDAP, info.getAuthenticationSourceType());
        Assert.assertEquals("savoirfairelinux", info.getRealm());
    }

    @Test
    public void authenticationAfterUserDeletion() throws Exception {
        server.ldapConnection().delete("uid=plarose,ou=users,dc=savoirfairelinux,dc=net");
        boolean res;
        res = ldapConnector.authenticate("plarose", "password");
        Assertions.assertFalse(res);
        res = ldapConnector.authenticate("fsidokhine", "password");
        Assertions.assertTrue(res);
    }

    @Test
    public void buildRequestPerformsSubstringSearch() throws Exception {
        Assertions.assertEquals(
                FilterParser.parse("(|(givenName=*Felix*)(sn=*Felix*))"),
                UserProfileService.buildRequest("Felix", "FULL_TEXT_NAME", false).getFilter());
    }

    @Test
    public void buildRequestHonoursExactMatch() throws Exception {
        Assertions.assertEquals(
                FilterParser.parse("(&(uid=fsidokhine))"),
                UserProfileService.buildRequest("fsidokhine", "LOGON_NAME", true).getFilter());
    }

    @Test
    public void buildRequestMatchesEveryEntryOnWildcardOnlyQuery() throws Exception {
        Assertions.assertEquals(
                FilterParser.parse("(&(uid=*))"),
                UserProfileService.buildRequest("*", "LOGON_NAME", false).getFilter());
    }

    @Test
    public void buildRequestNeverTreatsWildcardsAsSyntaxOnExactMatch() throws Exception {
        // An exact lookup of a literal "*" must not degrade into a match-all search.
        Assertions.assertEquals(
                FilterParser.parse("(&(uid=\\2A))"),
                UserProfileService.buildRequest("*", "LOGON_NAME", true).getFilter());
        Assertions.assertNotEquals(
                FilterParser.parse("(&(uid=*))"),
                UserProfileService.buildRequest("*", "LOGON_NAME", true).getFilter());

        Assertions.assertEquals(
                FilterParser.parse("(&(uid=\\2Asidokhine))"),
                UserProfileService.buildRequest("*sidokhine", "LOGON_NAME", true).getFilter());
    }

    @Test
    public void exactLookupResolvesOnlyTheLiteralUsername() throws Exception {
        // Sanity check that escaping did not break a legitimate exact lookup.
        UserProfile profile = ldapConnector.getUserProfile("fsidokhine");
        Assert.assertNotNull(profile);
        Assertions.assertEquals("fsidokhine", profile.getUsername());

        // "*" is a literal here, and no user is named "*", so nothing may come back.
        Assert.assertNull(ldapConnector.getUserProfile("*"));
        Assert.assertNull(ldapConnector.getUserProfile("*sidokhine"));
    }

    @Test
    public void buildRequestEscapesFilterMetacharacters() throws Exception {
        // Unescaped, this payload closes the substring clause and appends an always-true
        // component, turning the search into a dump of the whole directory.
        String payload = "*)(uid=*";

        Assertions.assertEquals(
                FilterParser.parse("(|(givenName=*\\29\\28uid=*)(sn=*\\29\\28uid=*))"),
                UserProfileService.buildRequest(payload, "FULL_TEXT_NAME", false).getFilter());
        Assertions.assertNotEquals(
                FilterParser.parse("(|(givenName=*)(uid=*)(sn=*)(uid=*))"),
                UserProfileService.buildRequest(payload, "FULL_TEXT_NAME", false).getFilter());
    }
}
