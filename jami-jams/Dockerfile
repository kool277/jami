FROM maven:3.9.16-eclipse-temurin-26-alpine AS build
RUN apk add --no-cache python3 npm

WORKDIR /app/jams-react-client
COPY jams-react-client/package*.json ./
RUN npm ci

WORKDIR /app
COPY pom.xml .
COPY ad-connector/pom.xml ad-connector/pom.xml
COPY authentication-module/pom.xml authentication-module/pom.xml
COPY datastore/pom.xml datastore/pom.xml
COPY jami-dht/pom.xml jami-dht/pom.xml
COPY jami-nameserver/pom.xml jami-nameserver/pom.xml
COPY jams-ca/pom.xml jams-ca/pom.xml
COPY jams-common/pom.xml jams-common/pom.xml
COPY jams-launcher/pom.xml jams-launcher/pom.xml
COPY ldap-connector/pom.xml ldap-connector/pom.xml
COPY jams-server/pom.xml jams-server/pom.xml

# Prime the Maven cache and create the unprivileged account used to run the
# server in the dev and prod stages.
RUN mvn install \
    -pl ad-connector,authentication-module,datastore,jami-dht,jami-nameserver,jams-ca,jams-common,jams-launcher,ldap-connector,jams-server \
    -am \
    -DskipTests \
    && addgroup -S -g 1001 jams \
    && adduser -S -u 1001 -G jams -h /home/jams jams

# The base image points MAVEN_CONFIG at root's home, which the jams user cannot write to.
ENV MAVEN_CONFIG=/home/jams/.m2

FROM build AS dev
COPY . .
WORKDIR /app
RUN mkdir -p /app/jams-server/src/main/resources/webapp \
    && echo '<h1>Dev build, this is a placeholder index.html. Please connect to <a href="http://localhost:3000">localhost:3000</a> instead</h1>' \
    > /app/jams-server/src/main/resources/webapp/index.html \
    && mvn package \
    && chown -R jams:jams /app
EXPOSE 3000 8080 35000
ENV JAVA_TOOL_OPTIONS="-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:35000"
USER jams
WORKDIR /app/jams
CMD ["sh", "-c", "java -jar jams-server.jar 8080 & npm start --prefix ../jams-react-client"]

FROM build AS prod
WORKDIR /app/jams-react-client
COPY jams-react-client .
RUN npm run build
WORKDIR /app
COPY . .
RUN mkdir -p jams-server/src/main/resources/webapp \
    && mv jams-react-client/build/* jams-server/src/main/resources/webapp \
    && mvn package

ENV JAMS_VERSION=3.8
RUN python3 generate-versions.py "$JAMS_VERSION" \
    && ./build-doc.sh \
    && chown -R jams:jams /app/jams

USER jams
WORKDIR /app/jams
CMD ["java", "-jar", "jams-launcher.jar"]
