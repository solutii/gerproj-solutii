import { describe, expect, it } from "vitest";
import { calcularLimiteApontamento } from "./limite-apontamento";

describe("calcularLimiteApontamento", () => {
  it("sem o cadastro carregado não há limite", () => {
    expect(calcularLimiteApontamento(undefined)).toBeUndefined();
    expect(calcularLimiteApontamento(null)).toBeUndefined();
  });

  it("com permissão de apontar no passado vale a data-limite cadastrada", () => {
    const limite = calcularLimiteApontamento(
      { PERMAPO_RECURSO: "SIM", DTLIMITE_RECURSO: "2026-09-01T00:00:00" },
      "2026-09-10",
    );

    expect(limite).toEqual(new Date("2026-09-01T00:00:00"));
  });

  it("sem a permissão só dá para apontar a partir de ontem", () => {
    const limite = calcularLimiteApontamento({ PERMAPO_RECURSO: "NAO", DTLIMITE_RECURSO: "2026-01-01" }, "2026-09-10");

    expect(limite).toEqual(new Date("2026-09-09T00:00"));
  });

  it("permissão marcada mas sem data cadastrada cai na regra de ontem (nunca libera o passado todo)", () => {
    const limite = calcularLimiteApontamento({ PERMAPO_RECURSO: "SIM", DTLIMITE_RECURSO: null }, "2026-09-10");

    expect(limite).toEqual(new Date("2026-09-09T00:00"));
  });

  it("ontem atravessa a virada do mês", () => {
    const limite = calcularLimiteApontamento({ PERMAPO_RECURSO: "NAO" }, "2026-10-01");

    expect(limite).toEqual(new Date("2026-09-30T00:00"));
  });
});
