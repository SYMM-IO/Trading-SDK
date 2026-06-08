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
});
