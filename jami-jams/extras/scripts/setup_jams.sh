#!/usr/bin/env sh

set -e

HOST='http://localhost:8080'

LAST_CURL_RESPONSE=''
BEARER=''
GROUP_ID=''

post() {
    _route=$1
    _data=$2

    printf '\n\n%s %s\n' "$_method" "$_route"
    LAST_CURL_RESPONSE=$(
        curl "$HOST$_route" \
            -sk \
            -D /dev/stderr \
            -H "Authorization: Bearer $BEARER" \
            -H 'Content-Type: application/json;charset=UTF-8' \
            --data-raw "$_data"
    )
    echo "$LAST_CURL_RESPONSE"
}

get_bearer() {
    _method=$1
    _route=$2

    printf '\n\n%s %s\n' "$_method" "$_route"
    BEARER=$(
        curl "$HOST$_route" \
            -sk \
            -D /dev/stderr \
            -X "$_method" \
            --data-raw '{"username":"admin","password":"admin"}'
    )
    BEARER=$(echo "$BEARER" | jq -r '.access_token')
    echo "BEARER=$BEARER"
}

install_create_admin_account() {
    get_bearer PUT /api/install/start
}

install_ca() {
    # 5 years: 157784630000
    post '/api/install/ca' \
        '{"fields":{
            "commonName":"myCommonName",
            "organization":"myOrg",
            "city":"myCity",
            "state":"myState",
            "country":"AI",
            "lifetime":157784630000
    }}'
}

install_auth() {
    post '/api/install/auth' \
        '{
            "type":"LOCAL",
            "localAuthSettings": {
                "publicNameServer":"http://ns.jami.net",
                "publicNames":false
            }
    }'
}

install_settings() {
    post '/api/install/settings' \
        '{
            "serverDomain":"http://localhost:8080",
            "reverseProxy":false,
            "crlLifetime":300000,
            "deviceLifetime":31556952000,
            "userLifetime":31556952000,
            "signingAlgorithm":"SHA512WITHRSA"
    }'
}

login() {
    get_bearer POST '/api/login'
}

create_blueprint() {
    _name=$1
    post "/api/admin/policy?name=$_name" \
        '{
            "videoEnabled":true,
            "publicInCalls":false,
            "allowCertFromContact":true,
            "allowCertFromHistory":true,
            "allowCertFromTrusted":true,
            "autoAnswer":false,
            "peerDiscovery":true,
            "accountDiscovery":false,
            "accountPublish":false,
            "rendezVous":false,
            "defaultModerators":"",
            "upnpEnabled":true,
            "allowLookup":true,
            "uiCustomization":"{\"areTipsEnabled\":true,\"backgroundType\":\"default\"}"
        }'
}

create_group() {
    _name=$1
    _blueprint_name=$2

    post '/api/admin/group' \
        '{"name":"'"$_name"'","blueprintName":"'"$_blueprint_name"'"}'

    GROUP_ID=$(echo "$LAST_CURL_RESPONSE" | jq -r '.id')
}

create_user() {
    _username=$1
    _password=$2
    post '/api/admin/user' \
        '{"username":"'"$_username"'","password":"'"$_password"'"}'

    post '/api/admin/directory/entry' \
        '{
            "username":"'"$_username"'",
            "password":"'"$_password"'",
            "firstName":"",
            "lastName":"",
            "email":"",
            "profilePicture":"",
            "organization":"",
            "faxNumber":"",
            "phoneNumber":"",
            "phoneNumberExtension":"",
            "mobileNumber":"",
            "jamiId":""
    }'

    post "/api/admin/group/members/$GROUP_ID" '{"username":"'"$_username"'"}'
}

install_setup() {
    install_create_admin_account
    install_ca
    install_auth
    install_settings
}

create_mock_data() {
    _group_name='defaultGroup'
    _blueprint_name='defaultBlueprint'
    login
    create_blueprint $_blueprint_name
    create_group $_group_name $_blueprint_name
    create_user alice a
    create_user bob a
    create_user charlie a
    create_user danny a
}

install_setup
create_mock_data
