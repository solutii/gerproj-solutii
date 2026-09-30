import { describe, expect, it } from "vitest";
import { estourouLimiteHoras } from "./limite-horas";

describe("estourouLimiteHoras", () => {
  it("estoura quando o total passa do limite e a tarefa não permite exceder", () => {
    expect(estourouLimiteHoras([600, 660, "NAO"])).toBe(true);
    expect(estourouLimiteHoras([600, 660, null])).toBe(true);
  });

  it("não estoura quando o total cabe no limite (inclusive igual)", () => {
    expect(estourouLimiteHoras([600, 540, "NAO"])).toBe(false);
    expect(estourouLimiteHoras([600, 600, "NAO"])).toBe(false);
  });

  it("limite 0 estoura com qualquer apontamento", () => {
    expect(estourouLimiteHoras([0, 30, "NAO"])).toBe(true);
  });

  it("ignorarLimiteZero: limite 0 significa sem limite (StandBy)", () => {
    expect(estourouLimiteHoras([0, 30, "NAO"], { ignorarLimiteZero: true })).toBe(false);
    expect(estourouLimiteHoras([600, 660, "NAO"], { ignorarLimiteZero: true })).toBe(true);
  });

  it("não estoura quando a tarefa permite exceder (PERIMP = SIM)", () => {
    expect(estourouLimiteHoras([600, 660, "SIM"])).toBe(false);
    expect(estourouLimiteHoras([600, 660, "SIM "])).toBe(false);
  });

  it("limite vazio (NaN) ou resposta inválida não trava", () => {
    expect(estourouLimiteHoras([NaN, 60, "NAO"])).toBe(false);
    expect(estourouLimiteHoras([])).toBe(false);
    expect(estourouLimiteHoras(null)).toBe(false);
    expect(estourouLimiteHoras({ error: "x" })).toBe(false);
  });
});
