FROM node:26-slim AS jami-web

WORKDIR /web-client

COPY package*.json ./
COPY client/package*.json client/
COPY server/package*.json server/
COPY common common
COPY server/locale server/locale
COPY server/available_languages.json server/available_languages.json

RUN npm ci
COPY . .

ARG GIT_COMMIT_HASH
ENV GIT_COMMIT_HASH=$GIT_COMMIT_HASH

RUN touch server/.env

FROM jami-web AS development
RUN echo "NODE_ENV=development" >> server/.env;
CMD ["npm", "start"]

FROM jami-web AS test
RUN npm run lint

FROM jami-web AS build
RUN npm run build

# Production image: ships only the compiled output and production
# dependencies, not the full source tree or dev tooling.
FROM node:26-slim AS production

RUN apt-get update && apt-get install -y --no-install-recommends \
  libexpat1 \
  libpulse0 \
  libva-drm2 \
  libva-x11-2 \
  libvdpau1 \
  alsa-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /web-client

ENV NODE_ENV=production

# Manifests + lockfile so the install is deterministic and matches the build.
COPY package*.json ./
COPY common/package*.json common/
COPY server/package*.json server/
COPY client/package*.json client/

# Install production dependencies only (no devDependencies, no build tooling).
# Scope to server + common: the client's runtime deps are already bundled into
# client/dist by Vite, so they are not needed in the production image.
RUN npm ci --omit=dev --workspace=server --workspace=common --include-workspace-root \
  && npm cache clean --force

# Copy only the built artifacts and runtime assets from the build stage.
COPY --from=build /web-client/common/dist common/dist
COPY --from=build /web-client/server/dist server/dist
COPY --from=build /web-client/server/client/dist server/client/dist
COPY --from=build /web-client/server/locale server/locale
COPY --from=build /web-client/server/available_languages.json server/available_languages.json
COPY --from=build /web-client/server/openid-providers.json server/openid-providers.json
COPY --from=build /web-client/server/openapi.yaml server/openapi.yaml

RUN touch server/.env

CMD ["npm", "run", "start:prod"]
