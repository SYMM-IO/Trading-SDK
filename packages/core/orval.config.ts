import { defineConfig } from "orval";

export default defineConfig({
  enigmaSolver: {
    input: {
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
