# @symmio/eslint-config

> Shared ESLint flat configs for the SYMMIO SDK monorepo.

Shared internal tooling for the SYMMIO SDK monorepo, published for reference.

**[Documentation](https://symmio-frontier.vercel.app/)**

## Installation

```sh
npm install -D @symmio/eslint-config eslint
```

`eslint` is a peer dependency.

## Usage

Extend a config from your flat `eslint.config.js`:

```js
import { baseConfig } from "@symmio/eslint-config/base";

export default baseConfig;
```

Available subpaths: `@symmio/eslint-config/base`, `@symmio/eslint-config/react-library`, and `@symmio/eslint-config/next-js`.

## License

[MIT](./LICENSE)
