# Server

This workspace is the npm package published as `@savoirfairelinux/jami-web`. It exposes the `jami-web` command, bundles the built React client during packing, and uses `@savoirfairelinux/jami-core` for the daemon native module.

## Setup

### Install npm dependencies and generate a private/public key pair

```
npm install
```

## Usage

### Run with hot-reload for development

```sh
npm start
```

### Build for production

```
npm run build
```

### Preview the production build

```sh
npm run start:prod
```

After publishing or installing globally, start the server from any directory with:

```sh
jami-web
```

### Lint files

```
npm run lint
```

Lint and fix files:

```
npm run lint:fix
```

### Format files

```
npm run format
```

### Clean build output

```
npm run clean
```
