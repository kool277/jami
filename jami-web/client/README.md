# Client

## Setup

```
npm install
```

## Usage

### Run with hot-reload for development

```
npm start
```

Open <http://localhost:3000> in your browser to view the app.

### Enable debug tools

The draggable debug tools dialog is disabled by default and is available only
in development builds. Add `?debug-tools=1` to the development URL, for
example <http://localhost:3000/?debug-tools=1>.

### Build for production

```
npm run build
```

### Preview the production build

```
npm run start:prod
```

### Run tests

Run Cypress tests headlessly:

```
npm run cy
```

Run Cypress tests with the browser:

```
npm run cy:open
```

To overide configurations without modifying the existing config file:

```
npx cypress run --config <config>
```

[Reference](https://docs.cypress.io/guides/references/configuration)

Alternatively, you can create your own local config file and use the following command:

```
npx cypress run --config-file <config-file>
```

Remember do not push this file to the source control if not needed.

### Test variables

You must provide the following variables in either `cypress.config.ts` or `cypress.env.json`

```
SERVER_URL
CLIENT_URL
TEST_USERNAME
TEST_USER_PASSWORD
USED_USERNAME
```

Check [here](https://docs.cypress.io/guides/guides/environment-variables) to see how to set the environment variables. For local testing, modify the variables in `cypress.env.json` since it is not tracked and variables defined here take precedence over the ones in the config file.

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

### Update the translation files

```
npm run extract-translations
```

The translations are handled by [i18next](https://www.i18next.com/).
