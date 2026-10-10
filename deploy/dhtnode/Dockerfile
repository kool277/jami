# OpenDHT node from the Ubuntu package: DHT bootstrap node and
# DHT proxy server (REST) for Jami clients.
FROM ubuntu:24.04

ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
        dhtnode \
        curl \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --home-dir /var/lib/dhtnode --create-home dhtnode

USER dhtnode
WORKDIR /var/lib/dhtnode
