/*
 * Copyright (C) 2020-2026 Savoir-faire Linux Inc.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation; either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with this program.  If not, see
 * <https://www.gnu.org/licenses/>.
 */

// Requirements:
// - gerrit-trigger plugin
// - Docker plugin
// - ansicolor plugin

node('jami-jamsbuildvm-01') {
    // Get number of CPU available for the build
    def cpuCount = sh returnStdout: true, script: 'nproc || echo -n 4'
    def topDir = pwd() + '/jami-jams'

    stage('SCM Checkout') {
        deleteDir()
        sh '''git clone --depth=1 --branch=master https://${RING_GERRIT_URL}/jami-jams'''
    }

    stage('Lint') {
        if (env.GERRIT_REFSPEC != null) {
            dir(topDir) {
                sh '''git fetch origin ${GERRIT_REFSPEC} && git checkout FETCH_HEAD
                docker build -f extras/CI/Dockerfile.test -t jams-lint .
                '''

                parallel(
                    "lint-client": {
                        sh '''
                        docker run --rm jams-lint sh -c "cd jams-react-client && npm run lint:check"
                        '''
                    },
                    "tsc-compile-client": {
                        sh '''
                        docker run --rm jams-lint sh -c "cd jams-react-client && npm run compile"
                        '''
                    },
                    "lint-server": {
                        sh '''
                        docker run --rm jams-lint google-java-format -a --skip-reflowing-long-strings --set-exit-if-changed --glob=**/*.java
                        '''
                    },
                    failFast: true // Aborts the parallel steps if one of them fails
                )
            }
        }  else {
            error "FAILED: I don't know what to test"
        }
    }

    stage('Test') {
        if (env.GERRIT_REFSPEC != null) {
            dir(topDir) {
                sh '''git fetch origin ${GERRIT_REFSPEC} && git checkout FETCH_HEAD'''

                // The project targets Java 26, so it is the only supported JDK.
                sh '''
                docker build -f extras/CI/Dockerfile.test -t jams-test:26 --build-arg JAVA_VERSION=26 .
                docker run --rm jams-test:26 mvn verify
                '''
            }
        }  else {
            error "FAILED: I don't know what to test"
        }
    }

    if (env.BUILD_TYPE != ('default')) {
        stage('Build') {
            if (env.GERRIT_REFSPEC != null) {
                dir(topDir) {
                    sh """
                    git fetch origin ${GERRIT_REFSPEC} && git checkout FETCH_HEAD
                    docker build -f Dockerfile -t jams:latest --target prod .
                    mkdir coverage
                    CONTAINER=\$(docker create jams:latest) \
                        && docker cp \$CONTAINER:/app/jams/. jams \
                        && docker cp \$CONTAINER:/app/versions.json . \
                        && docker cp \$CONTAINER:/app/datastore/target/site/jacoco/. coverage/datastore  \
                        && docker cp \$CONTAINER:/app/jams-ca/target/site/jacoco/. coverage/jams-ca  \
                        && docker cp \$CONTAINER:/app/jams-common/target/site/jacoco/. coverage/jams-common  \
                        && docker cp \$CONTAINER:/app/jams-server/target/site/jacoco/. coverage/jams-server  \
                        && docker cp \$CONTAINER:/app/ldap-connector/target/site/jacoco/. coverage/ldap-connector  \
                        && docker rm -v \$CONTAINER
                    """
                }
            } else {
                error "FAILED: I don't know what to build"
            }
        }

        stage('Deploy') {
            dir(topDir) {
                sh '''tar -cvf jams.tar jams/*'''

                def DEPLOY_ENV_NAME = env.BUILD_TYPE.split('::')[0]
                def DEPLOY_ENV_IP = env.BUILD_TYPE.split('::')[1]
                echo "Build type: ${env.BUILD_TYPE}"
                echo "Build name: ${DEPLOY_ENV_NAME}"

                if (DEPLOY_ENV_NAME.equals('staging')) {
                    sh """
                        scp -o StrictHostKeyChecking=no -r jams/* root@${DEPLOY_ENV_IP}:/opt/jams-local
                        ssh root@${DEPLOY_ENV_IP} 'rm -rf /opt/jams-local/crl.pem'
                        ssh root@${DEPLOY_ENV_IP} 'rm -rf /opt/jams-local/config.json'
                        ssh root@${DEPLOY_ENV_IP} 'rm -rf /opt/jams-local/keystore.jks'
                        ssh root@${DEPLOY_ENV_IP} 'rm -rf /opt/jams-local/oauth.*'
                        ssh root@${DEPLOY_ENV_IP} 'rm -rf /opt/jams-local/tomcat.8080'
                        ssh root@${DEPLOY_ENV_IP} 'rm -rf /opt/jams-local/jams'
                        ssh root@${DEPLOY_ENV_IP} 'rm -rf /opt/jams-local/derby.log'
                        ssh root@${DEPLOY_ENV_IP} 'systemctl restart jams-local'
                    """
                }
                if (DEPLOY_ENV_NAME.equals('qa')) {
                    sh """
                        ls -la .
                        scp -r jams/* root@${DEPLOY_ENV_IP}:/opt/jams
                        ssh root@${DEPLOY_ENV_IP} 'systemctl restart jams-prod'
                    """
                }
                if (DEPLOY_ENV_NAME.equals('qa-local')) {
                    sh """
                        scp -r jams/* root@${DEPLOY_ENV_IP}:/opt/jams-local
                        ssh root@${DEPLOY_ENV_IP} 'systemctl restart jams-local'
                    """
                }
                if (DEPLOY_ENV_NAME.equals('publish-update')) {
                    sh """
                        ssh root@${DEPLOY_ENV_IP} 'rm -r /var/www/html/updates/' || true
                        ssh root@${DEPLOY_ENV_IP} 'rm /var/www/html/versions.json' || true
                        ssh root@${DEPLOY_ENV_IP} 'mkdir /var/www/html/updates' || true
                        scp -r jams/* root@${DEPLOY_ENV_IP}:/var/www/html/updates || true
                        ssh root@${DEPLOY_ENV_IP} 'mv /var/www/html/updates/libs/* /var/www/html/updates/' || true
                        ssh root@${DEPLOY_ENV_IP} 'rm -r /var/www/html/updates/libs/' || true
                        scp versions.json root@${DEPLOY_ENV_IP}:/var/www/html/
                    """
                }
                if (DEPLOY_ENV_NAME.equals('dl')) {
                    def remoteHost = env.SSH_HOST_DL_RING_CX
                    def remoteBaseDir = '/srv/repository/ring/jams'
                    def JENKINS_SSH_KEY = '35cefd32-dd99-41b0-8312-0b386df306ff'
                    def DL_SSH_KEY = '5825b39b-dfc6-435f-918e-12acc1f56221'

                    sshagent(credentials: [JENKINS_SSH_KEY, DL_SSH_KEY]) {
                        echo 'Publishing to dl.jami.net...'
                        script {
                            sh """
                                tar -cvf jams.tar jams/*
                                rsync --verbose jams.tar ${remoteHost}:${remoteBaseDir}
                            """
                        }

                        sh("ssh ${remoteHost} mkdir -p ${remoteBaseDir}/docs")
                        sh("rsync -a coverage/ ${remoteHost}:${remoteBaseDir}/docs/coverage/")
                    }
                }
            }
        }

        stage('Post') {
            dir(topDir) {
                // Archive the artifacts
                archiveArtifacts artifacts: 'jams.tar', fingerprint: true
            }
        }
    }

    stage('Cleanup') {
        dir(topDir) {
            // Remove dangling docker images and containers
            sh '''docker container prune -f && docker image prune -f'''
        }
    }

}
