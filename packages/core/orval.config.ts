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
});
