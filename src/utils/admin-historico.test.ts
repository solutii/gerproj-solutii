import { describe, expect, it } from "vitest";
import { dataHoraBR, formatarValor, mudancasDoRegistro, nomeDoMes, rotuloDoCampo } from "./admin-historico";

describe("formatarValor", () => {
  it("SIM/NAO viram Sim/Não; data em dd/mm/aaaa; horas com 'h' e vírgula", () => {
    expect(formatarValor("permiteExceder", "SIM")).toBe("Sim");
    expect(formatarValor("permiteApontarNoPassado", "NAO")).toBe("Não");
    expect(formatarValor("dataLimite", "2026-09-01")).toBe("01/09/2026");
    expect(formatarValor("horasContratadas", 12.5)).toBe("12,5h");
    expect(formatarValor("limiteMensalHoras", 40)).toBe("40h");
    expect(formatarValor("jornada", "08:48")).toBe("08:48");
  });

  it("vazio: 'sem limite' no limite mensal e '(vazio)' nos demais", () => {
    expect(formatarValor("limiteMensalHoras", null)).toBe("sem limite");
    expect(formatarValor("dataLimite", null)).toBe("(vazio)");
    expect(formatarValor("horasContratadas", undefined)).toBe("(vazio)");
  });

  it("zero é um valor (não 'vazio')", () => {
    expect(formatarValor("limiteMensalHoras", 0)).toBe("0h");
  });
});

describe("mudancasDoRegistro", () => {
  it("uma linha por campo, com o nome em português", () => {
    expect(
      mudancasDoRegistro({
        antes: { permiteApontarNoPassado: "NAO", jornada: "08:48" },
        depois: { permiteApontarNoPassado: "SIM", jornada: "09:00" },
      }),
    ).toEqual([
      { campo: "Apontar no passado", antes: "Não", depois: "Sim" },
      { campo: "Jornada diária", antes: "08:48", depois: "09:00" },
    ]);
  });

  it("campo desconhecido aparece com o nome técnico (nada some)", () => {
    expect(rotuloDoCampo("outroCampo")).toBe("outroCampo");
    expect(mudancasDoRegistro({ antes: { x: 1 }, depois: { x: 2 } })).toEqual([{ campo: "x", antes: "1", depois: "2" }]);
  });
});

describe("datas", () => {
  it("hora em Brasília e nome do mês", () => {
    expect(dataHoraBR("2026-10-02T15:30:00.000Z")).toContain("12:30:00");
    expect(nomeDoMes("2026-10")).toBe("outubro de 2026");
  });
});
