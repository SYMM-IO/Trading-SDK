import { defineConfig, type OpenApiDocument } from "orval";

/**
 * Protocol-instance key of the GasLessQ staging deployment — the instance the
 * gasless wire types are generated from. GasLessQ serves one OpenAPI document
 * per protocol instance and service. Staging runs the multi-wallet gateway
 * release the SDK targets; production still serves the pre-multi-wallet
 * schema. The documents are public, so no key is needed to fetch them.
 * Regenerate both gasless projects on every vendor release handoff.
 */
const GASLESSQ_STAGING_PROTOCOL_INSTANCE = "arbitrum-42161-vibe-stage";

/** Instance root the per-service `openapi.json` documents hang off. */
const GASLESSQ_STAGING_INSTANCE_ROOT = `https://gaslessq-staging.symmio.foundation/v1/instances/${GASLESSQ_STAGING_PROTOCOL_INSTANCE}`;

/**
 * Strip the protocol-instance key from a fetched GasLessQ spec before orval
 * derives anything from it.
 *
 * The documents name the instance they were served from. Today that happens
 * only in `servers` (`/v1/instances/<protocol-instance>/<service>`). The key is
 * a vendor deployment fact that carries app-product branding, and the repo
 * vocabulary rule keeps that out of `packages/*` source. The SDK also builds
 * every base URL from config, so the generated files must stay
 * instance-neutral. `servers` is therefore dropped, and any other occurrence
 * (a description or example naming the instance) becomes the neutral
 * `<protocol-instance>` placeholder.
 */
function stripGaslessProtocolInstance(spec: OpenApiDocument): OpenApiDocument {
  delete spec.servers;
  return JSON.parse(
    JSON.stringify(spec).replaceAll(GASLESSQ_STAGING_PROTOCOL_INSTANCE, "<protocol-instance>"),
  ) as OpenApiDocument;
}

export default defineConfig({
  enigmaSolver: {
    input: {
      // Arbitrum production solver — the spec of record for the enigma generation
      // this release targets (perps-core v0.8.6: adds the min open/close
      // solver-fee-cap symbol fields, drops the protocol-wide `/revenue`,
      // `/revenue/batch` and `/revenue/per-symbol` endpoints).
      target: "https://solver.enigma.bz/api/swagger/doc.json",
    },
    output: {
      clean: true,
      mode: "single",
      httpClient: "axios",
      formatter: "prettier",
      target: "./src/solvers/types/generated/enigma-solver.ts",
      override: {
        enumGenerationType: "enum",
      },
    },
  },
  rasaSolver: {
    input: {
      // Rasa staging spec (only one published so far). The JSON itself is
      // public — only the swagger UI is credential-gated. Swap to the
      // production spec URL when the vendor publishes one.
      target: "https://stage-archon.rasa.capital/openapi.json",
    },
    output: {
      // No `clean` here: this file shares `generated/` with enigma-solver.ts,
      // and orval's clean wipes the whole output directory — it would delete
      // the sibling during generation.
      mode: "single",
      httpClient: "axios",
      formatter: "prettier",
      target: "./src/solvers/types/generated/rasa-solver.ts",
      override: {
        enumGenerationType: "enum",
      },
    },
  },
  tpslHandler: {
    input: {
      target: "https://conditional-orders-handler-lowcap85.rasa.capital/conditional-orders/openapi.json",
      override: {
        // The published openapi spec for `ConditionalOrderResponseSchema` is
        // stale: live `GET /api/v5/?quote_id=…` returns numbers (not strings)
        // and uses `conditional_order_price` / `action_price_type` instead of
        // the spec's `conditional_price` / `conditional_price_type`, plus
        // extra fields (`position_type`, `close_status`, `create_time`,
        // `modify_time`). Patch the schema in-place so orval emits accurate
        // types. Remove this transformer once the backend ships a corrected
        // spec.
        transformer: (spec) => {
          const schemas = spec.components?.schemas;
          if (!schemas) return spec;
          // `ConditionalOrderTypedData` uses `additionalProperties: true` on
          // its `types` / `domain` / `message` fields, so orval emits
          // `{[key:string]: unknown}`. Inject concrete EIP-712 shapes so
          // consumers get real types.
          schemas.EIP712Domain = {
            type: "object",
            title: "EIP712Domain",
            required: ["name", "version", "chainId", "verifyingContract"],
            properties: {
              name: { type: "string", title: "Name" },
              version: { type: "string", title: "Version" },
              chainId: { type: "integer", title: "Chain Id" },
              verifyingContract: { type: "string", title: "Verifying Contract" },
            },
          };
          schemas.EIP712TypedDataField = {
            type: "object",
            title: "EIP712TypedDataField",
            required: ["name", "type"],
            properties: {
              name: { type: "string", title: "Name" },
              type: { type: "string", title: "Type" },
            },
          };
          schemas.ConditionalOrderTypedData = {
            type: "object",
            title: "ConditionalOrderTypedData",
            required: ["types", "primaryType", "domain", "message"],
            properties: {
              types: {
                type: "object",
                title: "Types",
                additionalProperties: {
                  type: "array",
                  items: { $ref: "#/components/schemas/EIP712TypedDataField" },
                },
              },
              primaryType: { type: "string", title: "Primarytype" },
              domain: { $ref: "#/components/schemas/EIP712Domain" },
              // Body of the signed message. Its shape is primary-type-dependent
              // — leave as an open bag but keyed strings (values are the raw
              // typed-data payload, which can be strings, numbers, bigints,
              // nested structs, or arrays). Consumers should downcast to a
              // concrete SDK message type at the call site.
              message: {
                type: "object",
                title: "Message",
                additionalProperties: true,
              },
            },
          };
          schemas.ConditionalOrderResponseSchema = {
            type: "object",
            title: "ConditionalOrderResponseSchema",
            required: [
              "quantity",
              "conditional_order_price",
              "order_type",
              "conditional_order_type",
              "party_a_address",
              "quote_id",
              "state",
              "symbol_id",
              "coh_quote_id",
              "action_price_type",
              "position_type",
              "create_time",
              "modify_time",
            ],
            properties: {
              quote_id: { type: "integer", title: "Quote Id" },
              coh_quote_id: { type: "string", title: "Coh Quote Id" },
              party_a_address: { type: "string", title: "Party A Address" },
              symbol_id: { type: "integer", title: "Symbol Id" },
              conditional_order_type: { $ref: "#/components/schemas/ConditionalOrderType" },
              quantity: { type: "number", title: "Quantity" },
              price: {
                anyOf: [{ type: "number" }, { type: "null" }],
                title: "Price",
              },
              conditional_order_price: { type: "number", title: "Conditional Order Price" },
              order_type: { $ref: "#/components/schemas/OrderType" },
              state: { $ref: "#/components/schemas/ConditionalOrdersState" },
              action_price_type: { $ref: "#/components/schemas/PriceActionType" },
              close_status: {
                anyOf: [{ type: "string" }, { type: "null" }],
                title: "Close Status",
              },
              position_type: { $ref: "#/components/schemas/PositionType" },
              leverage: {
                anyOf: [{ type: "number" }, { type: "string" }, { type: "null" }],
                title: "Leverage",
              },
              create_time: { type: "integer", title: "Create Time" },
              modify_time: { type: "integer", title: "Modify Time" },
            },
          };
          return spec;
        },
      },
    },
    output: {
      clean: true,
      mode: "single",
      httpClient: "axios",
      formatter: "prettier",
      target: "./src/tpsl/types/generated/tpsl-handler.ts",
      override: {
        enumGenerationType: "enum",
      },
    },
  },
  enigmaPriceService: {
    input: {
      target: "https://lowcap-price.enigma.bz/openapi.json",
    },
    output: {
      clean: true,
      mode: "single",
      httpClient: "axios",
      formatter: "prettier",
      target: "./src/price-service/enigma/types/generated/enigma-price-service.ts",
      override: {
        enumGenerationType: "enum",
      },
    },
  },
  listingBackend: {
    input: {
      target: "https://listing85.enigma.bz/openapi.json",
      override: {
        // The published spec's `info.title` is the vendor's app-product brand,
        // which must not leak into `packages/*` identifiers or the generated
        // file header (repo rule: no "Vibe" in the SDK). Rewrite it to a neutral
        // name before orval derives anything from it.
        transformer: (spec) => {
          if (spec.info) spec.info.title = "Lowcap Permissionless Listing";
          return spec;
        },
      },
    },
    output: {
      clean: true,
      mode: "single",
      httpClient: "axios",
      formatter: "prettier",
      target: "./src/pools/types/generated/listing-backend.ts",
      override: {
        enumGenerationType: "enum",
      },
    },
  },
  inventoryService: {
    input: {
      target: "https://inventory85.enigma.bz/openapi.json",
    },
    output: {
      clean: true,
      mode: "single",
      httpClient: "axios",
      formatter: "prettier",
      target: "./src/inventory/types/generated/inventory-service.ts",
      override: {
        enumGenerationType: "enum",
      },
    },
  },
  gaslessOperations: {
    input: {
      /**
       * GasLessQ operations API: relay submits, request status and broadcast
       * attempts. The SDK imports only the generated models (`import type` in
       * `src/gasless/wire-types.ts`). Requests go through `src/gasless/http.ts`,
       * never through the generated client.
       */
      target: `${GASLESSQ_STAGING_INSTANCE_ROOT}/operations/openapi.json`,
      override: {
        transformer: stripGaslessProtocolInstance,
      },
    },
    output: {
      /**
       * No `clean` here: this file shares `generated/` with
       * gasless-deposits.ts, and orval's clean wipes the whole output
       * directory, so it would delete the sibling during generation.
       */
      mode: "single",
      httpClient: "axios",
      formatter: "prettier",
      target: "./src/gasless/types/generated/gasless-operations.ts",
      override: {
        enumGenerationType: "enum",
      },
    },
  },
  gaslessDeposits: {
    input: {
      /**
       * GasLessQ deposits API: deposit-settlement submits, settlement status
       * and broadcast attempts. Types only, like `gaslessOperations`.
       */
      target: `${GASLESSQ_STAGING_INSTANCE_ROOT}/deposits/openapi.json`,
      override: {
        transformer: stripGaslessProtocolInstance,
      },
    },
    output: {
      /** No `clean`, for the same shared-directory reason as `gaslessOperations`. */
      mode: "single",
      httpClient: "axios",
      formatter: "prettier",
      target: "./src/gasless/types/generated/gasless-deposits.ts",
      override: {
        enumGenerationType: "enum",
      },
    },
  },
  // TODO(muon-openapi): the Muon oracle gateway is a query-param REST endpoint
  // with no OpenAPI/Swagger spec (https://docs.symm.io/api-endpoints-and-deployments/muon-api),
  // so there is nothing for orval to generate — the Muon request/response types
  // are hand-written in `src/muon/types.ts`. If Muon ever publishes a spec, add
  // an entry here and replace the hand-written types with the generated client:
  // muon: {
  //   input: { target: "<muon-openapi-spec-url>" },
  //   output: {
  //     clean: true,
  //     mode: "single",
  //     httpClient: "axios",
  //     formatter: "prettier",
  //     target: "./src/muon/types/generated/muon.ts",
  //     override: { enumGenerationType: "enum" },
  //   },
  // },
});
