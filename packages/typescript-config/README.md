# @symmio/typescript-config

> Shared TypeScript configurations for the SYMMIO SDK monorepo.

Shared internal tooling for the SYMMIO SDK monorepo, published for reference.

**[Documentation](https://symmio-frontier.vercel.app/)**

## Installation

```sh
npm install -D @symmio/typescript-config
```

## Usage

Extend one of the shared configs from your `tsconfig.json`:

```json
{
  "extends": "@symmio/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "dist"
  }
}
```

## License

[MIT](./LICENSE)
