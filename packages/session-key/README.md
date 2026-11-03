# @symmio/session-key

> Framework-agnostic local EVM session-key helpers for SYMMIO SDK consumers.

`@symmio/session-key` handles local EVM session keys: generation, import, runtime manager state, and message/EIP-712 signing. It is a standalone helper layer of the SYMMIO SDK, independent of `@symmio/trading-core` and `@symmio/trading-react`, so any consumer can reuse it while keeping persistence and encryption in the app.

**[Documentation](https://doc.trading-sdk.symm.io/session-key) · [Live SDK console](https://console.trading-sdk.symm.io/)**

## Installation

```sh
npm install @symmio/session-key viem
```

viem is a peer dependency.

## Usage

```ts
import { createSessionKeyManager, type SessionKeyStorage } from "@symmio/session-key";
/** Apps own persistence; this example keeps records in memory. */
const records = new Map<string, any>();
const storage: SessionKeyStorage = {
  load: async (owner) => records.get(owner) ?? null,
  save: async (owner, record) => void records.set(owner, record),
  remove: async (owner) => void records.delete(owner),
  getMetadata: async (owner) => records.get(owner) ?? null,
};
const manager = createSessionKeyManager({ storage });
await manager.initialize("0xYourWalletAddress");
const { signature } = await manager.sign("Authorize SYMMIO session");
```

Use `manager.load(owner)` when a device must only restore an existing key. It never generates, removes, or replaces
records. Import transferred keys with `{ expiresAt }` to retain their absolute expiry in milliseconds.

`manager.getAccount()` returns a viem signing capability that rejects after lifecycle changes or expiry, including
signatures in flight. Password locks, encryption, deployment scoping, and coordination between storage writers stay
in the consuming app. A raw private key exported for transfer cannot be revoked by the manager.

See the [full API reference](https://doc.trading-sdk.symm.io/session-key) for the complete manager surface, storage interface, and transfer-payload helpers.

## License

[MIT](./LICENSE)
