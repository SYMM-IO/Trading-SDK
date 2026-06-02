import { defineConfig } from "orval";

export default defineConfig({
  enigmaSolver: {
    input: {
      target: "https://solver.enigma.bz/api/swagger/doc.json",
    },
    output: {
      target: "./src/solver/enigma-solver.ts",
      client: "axios",
      mode: "single",
    },
  },
});
