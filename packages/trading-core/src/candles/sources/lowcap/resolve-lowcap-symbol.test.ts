import { describe, expect, it } from "vitest";
import { SymbolStatus, type SymbolInfo } from "../../../price-service/enigma/types/generated/enigma-price-service";
import { resolveLowcapSymbol } from "./resolve-lowcap-symbol";

const SYMBOLS: SymbolInfo[] = [
  { name: "TOKEN::Ab..Cd_SFLOW", address: "AbCdEf123", status: SymbolStatus.TRADING },
  { name: "TOKEN::Gh..Ij_SFLOW", address: "GhIjKl456", status: SymbolStatus.TRADING },
];

describe("resolveLowcapSymbol", () => {
  it("distinguishes markets with the same ticker by their complete names", () => {
    expect(resolveLowcapSymbol(SYMBOLS, "TOKEN::Ab..Cd_SFLOW")?.address).toBe("AbCdEf123");
    expect(resolveLowcapSymbol(SYMBOLS, "TOKEN::Gh..Ij_SFLOW")?.address).toBe("GhIjKl456");
  });

  it.each(["TOKEN", "TOKEN_SFLOW", "token::ab..cd_sflow", "AbCdEf123", "UNKNOWN"])(
    "does not guess a listing from %s",
    (name) => {
      expect(resolveLowcapSymbol(SYMBOLS, name)).toBeUndefined();
    },
  );

  it("does not confuse an unlisted market with a listed market without history", () => {
    expect(resolveLowcapSymbol([], "TOKEN::Ab..Cd_SFLOW")).toBeUndefined();
    expect(resolveLowcapSymbol(SYMBOLS, "TOKEN::Ab..Cd_SFLOW")).toBe(SYMBOLS[0]);
  });
});
