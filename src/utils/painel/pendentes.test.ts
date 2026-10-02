import { describe, expect, it } from "vitest";
import { diasPendentes } from "./pendentes";

describe("diasPendentes", () => {
  // 02/10/2026 é sexta-feira
  const hoje = "2026-10-02";

  it("lista os dias úteis recentes sem OS, em ordem, sem contar hoje", () => {
    const dias = diasPendentes({
      hoje,
      diasComOs: ["2026-09-28", "2026-09-30"],
      apontarAPartirDe: "2026-09-01",
      janelaDias: 7,
    });

    // 25/09 (sex), 29/09 (seg), 01/10 (qui); 26-27/09 e 03/10 são fim de semana
    expect(dias).toEqual(["2026-09-25", "2026-09-29", "2026-10-01"]);
    expect(dias).not.toContain(hoje);
  });

  it("atravessa a virada do mês", () => {
    const dias = diasPendentes({ hoje: "2026-10-01", diasComOs: [], apontarAPartirDe: "2026-09-01", janelaDias: 3 });

    // 3 dias para trás de 01/10: 28/09 (seg), 29/09 e 30/09
    expect(dias).toEqual(["2026-09-28", "2026-09-29", "2026-09-30"]);
  });

  it("ignora dias antes do limite de apontamento (não dá mais para apontar)", () => {
    const dias = diasPendentes({ hoje, diasComOs: [], apontarAPartirDe: "2026-10-01", janelaDias: 7 });

    expect(dias).toEqual(["2026-10-01"]);
  });

  it("não conta feriado nacional", () => {
    // 07/09/2026 (segunda) é Independência
    const dias = diasPendentes({ hoje: "2026-09-08", diasComOs: [], apontarAPartirDe: "2026-09-01", janelaDias: 3 });

    expect(dias).not.toContain("2026-09-07");
  });

  it("tudo apontado: lista vazia", () => {
    const dias = diasPendentes({
      hoje,
      diasComOs: ["2026-09-29", "2026-09-30", "2026-10-01"],
      apontarAPartirDe: "2026-09-29",
      janelaDias: 3,
    });

    expect(dias).toEqual([]);
  });
});
