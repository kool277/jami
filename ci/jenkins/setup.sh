#!/bin/sh
# Set up the local Jenkins for the kool277 pipelines through its REST API.
# Access comes only from JENKINS_URL, JENKINS_USER and JENKINS_API_TOKEN in
# the environment; the token goes to curl through a private config file,
# never on the command line or in the output.
#   ci/jenkins/setup.sh status    # what is in place: plugins, credentials, jobs, docker, cache
#   ci/jenkins/setup.sh plugins   # install the missing plugins of plugins.txt
#   ci/jenkins/setup.sh jobs      # create or update the jobs, then start a scan
# Jobs: one multibranch job per repository in REPOS, from multibranch.xml.in
# (GitHub source kool277/<repo>, script path Jenkinsfile.kool277, a scan
# every 5 minutes, builds for branches, pull requests and new tags).
set -eu

: "${JENKINS_URL:?set JENKINS_URL}" "${JENKINS_USER:?set JENKINS_USER}" "${JENKINS_API_TOKEN:?set JENKINS_API_TOKEN}"
here=$(cd "$(dirname "$0")" && pwd)
REPOS=${REPOS:-"jami-daemon jami-client-qt jami-client-android jami-jams jami-web jami"}
base=${JENKINS_URL%/}
plugins=$(grep -vE '^\s*(#|$)' "$here/plugins.txt")

cfg=$(mktemp)
trap 'rm -f "$cfg"' EXIT
chmod 600 "$cfg"
printf 'user = "%s:%s"\n' "$JENKINS_USER" "$JENKINS_API_TOKEN" >"$cfg"
# -g: URLs such as ...?tree=plugins[shortName] are literal, not curl ranges.
api() { curl -gsS --fail-with-body -K "$cfg" "$@"; }
status_of() { curl -gs -o /dev/null -w '%{http_code}' -K "$cfg" "$@"; }

installed() {
    api "$base/pluginManager/api/json?depth=1&tree=plugins[shortName,active]" |
        jq -r '.plugins[] | select(.active) | .shortName'
}

cmd_status() {
    have=$(installed)
    for p in $plugins; do
        printf '%s\n' "$have" | grep -qx "$p" && echo "OK    plugin $p" || echo "MISS  plugin $p"
    done
    case $(status_of "$base/credentials/store/system/domain/_/credential/github-kool277/api/json") in
    200) echo "OK    credential github-kool277" ;;
    *) echo "MISS  credential github-kool277 (GitHub App, or Username with password: kool277 + token with repo)" ;;
    esac
    case $(status_of "$base/credentials/store/system/domain/_/credential/ghcr-kool277/api/json") in
    200) echo "OK    credential ghcr-kool277" ;;
    *) echo "MISS  credential ghcr-kool277 (Username with password: kool277 + classic token with write:packages)" ;;
    esac
    for r in $REPOS; do
        [ "$(status_of "$base/job/$r/api/json")" = 200 ] && echo "OK    job $r: $base/job/$r/" || echo "MISS  job $r"
    done
    id -nG jenkins 2>/dev/null | tr ' ' '\n' | grep -qx docker &&
        echo "OK    jenkins user in the docker group" ||
        echo "MISS  jenkins user in the docker group (sudo usermod -aG docker jenkins, restart Jenkins)"
    if command -v getfacl >/dev/null && getfacl -p /var/cache/jami 2>/dev/null | grep -q '^user:jenkins:rwx'; then
        echo "OK    jenkins can write /var/cache/jami"
    else
        echo "MISS  jenkins write access to /var/cache/jami (as its owner: setfacl -R -m u:jenkins:rwX,d:u:jenkins:rwX,d:u:ubuntu:rwX /var/cache/jami)"
    fi
}

cmd_plugins() {
    have=$(installed)
    missing=
    for p in $plugins; do
        printf '%s\n' "$have" | grep -qx "$p" || missing="$missing $p"
    done
    [ -n "$missing" ] || { echo "all plugins installed"; return 0; }
    echo "installing:$missing"
    # Refresh the update site data first, so @latest resolves.
    api -X POST "$base/pluginManager/checkUpdatesServer" >/dev/null
    xml="<jenkins>$(for p in $missing; do printf '<install plugin="%s@latest"/>' "$p"; done)</jenkins>"
    printf '%s' "$xml" | api -X POST -H 'Content-Type: text/xml' --data-binary @- \
        "$base/pluginManager/installNecessaryPlugins" >/dev/null
    i=0
    while :; do
        have=$(installed)
        left=
        for p in $missing; do printf '%s\n' "$have" | grep -qx "$p" || left="$left $p"; done
        [ -z "$left" ] && break
        i=$((i + 1))
        if [ "$i" -gt 60 ]; then
            echo "not active after 10 minutes:$left" >&2
            break
        fi
        sleep 10
    done
    if api "$base/updateCenter/api/json?tree=restartRequiredForCompletion" | jq -e '.restartRequiredForCompletion' >/dev/null; then
        echo "Jenkins needs a restart to finish: $base/safeRestart (or sudo systemctl restart jenkins)"
    fi
    [ -z "$left" ]
}

cmd_jobs() {
    for r in $REPOS; do
        xml=$(sed "s/@REPO@/$r/g" "$here/multibranch.xml.in")
        if [ "$(status_of "$base/job/$r/api/json")" = 200 ]; then
            printf '%s' "$xml" | api -X POST -H 'Content-Type: application/xml' --data-binary @- \
                "$base/job/$r/config.xml" >/dev/null
            action=updated
        else
            printf '%s' "$xml" | api -X POST -H 'Content-Type: application/xml' --data-binary @- \
                "$base/createItem?name=$r" >/dev/null
            action=created
        fi
        api -X POST "$base/job/$r/build?delay=0" >/dev/null
        echo "$action $r, scan started: $base/job/$r/"
    done
}

case "${1:-status}" in
status) cmd_status ;;
plugins) cmd_plugins ;;
jobs) cmd_jobs ;;
*) echo "usage: $0 status|plugins|jobs" >&2; exit 2 ;;
esac
