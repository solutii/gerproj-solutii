import { describe, expect, it } from "vitest";
import { DESCRICAO_MINIMA, descricaoInvalida } from "./descricao-apontamento";

describe("descricaoInvalida", () => {
  it("menos de 50 caracteres é inválida", () => {
    expect(descricaoInvalida("ok")).toBe(true);
    expect(descricaoInvalida("a".repeat(DESCRICAO_MINIMA - 1))).toBe(true);
  });

  it("50 caracteres ou mais é válida", () => {
    expect(descricaoInvalida("a".repeat(DESCRICAO_MINIMA))).toBe(false);
  });

  it("espaços nas pontas não contam", () => {
    expect(descricaoInvalida(`  ${"a".repeat(DESCRICAO_MINIMA - 1)}  `)).toBe(true);
  });

  it("vazio ou nulo é inválida", () => {
    expect(descricaoInvalida("")).toBe(true);
    expect(descricaoInvalida(null)).toBe(true);
    expect(descricaoInvalida(undefined)).toBe(true);
  });
});
