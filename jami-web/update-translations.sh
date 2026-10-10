#!/bin/bash
tx pull -af --minimum-perc=1

TOKEN=$1

curl --request GET \
    --url https://rest.api.transifex.com/projects/o%3Asavoirfairelinux%3Ap%3Ajami/languages \
    --header 'accept: application/vnd.api+json' \
    --header "authorization: Bearer $TOKEN" > server/available_languages.json