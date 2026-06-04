import { defineConfig } from "orval";

export default defineConfig({
  enigmaSolver: {
    input: {
      target: "https://solver.enigma.bz/api/swagger/doc.json",
    },
    output: {
      clean: true,
      target: "./src/solvers/types/generated/enigma-solver.ts",
      mode: "single",
      formatter: "prettier",
      httpClient: "axios",
      override: {
        enumGenerationType: "enum",
      },
    },
  },
});
