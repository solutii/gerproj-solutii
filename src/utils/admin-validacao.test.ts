import { describe, expect, it } from "vitest";
import {
  validarAlteracoesConsultor,
  validarAlteracoesTarefa,
  validarCodigo,
  validarDataLimite,
  validarHorasContratadas,
  validarJornada,
  validarLimiteMensal,
  validarSimNao,
} from "./admin-validacao";

const HOJE = "2026-10-02";
const erroDe = (r: { ok: boolean; erro?: string }) => (r.ok ? "" : (r.erro ?? ""));

describe("validarSimNao", () => {
  it("aceita booleano e SIM/NAO em qualquer caixa e com espaços", () => {
    expect(validarSimNao(true, "x")).toEqual({ ok: true, valor: "SIM" });
    expect(validarSimNao(false, "x")).toEqual({ ok: true, valor: "NAO" });
    expect(validarSimNao(" sim ", "x")).toEqual({ ok: true, valor: "SIM" });
    expect(validarSimNao("nao", "x")).toEqual({ ok: true, valor: "NAO" });
  });

  it("recusa o resto, incluindo injeção e tipos errados", () => {
    for (const ruim of ["", "S", "talvez", "SIM'; DROP TABLE RECURSO;--", 1, 0, null, undefined, {}, []]) {
      expect(validarSimNao(ruim, "Campo").ok).toBe(false);
    }
  });
});

describe("validarDataLimite", () => {
  it("aceita data real entre 2000 e hoje (inclusive hoje)", () => {
    expect(validarDataLimite("2026-09-01", HOJE)).toEqual({ ok: true, valor: "2026-09-01" });
    expect(validarDataLimite("2026-10-02", HOJE).ok).toBe(true);
    expect(validarDataLimite("2000-01-01", HOJE).ok).toBe(true);
  });

  it("recusa futura, antiga demais, inexistente e formato errado", () => {
    expect(erroDe(validarDataLimite("2026-10-03", HOJE))).toContain("futura");
    expect(erroDe(validarDataLimite("1999-12-31", HOJE))).toContain("antiga");
    expect(erroDe(validarDataLimite("2026-02-30", HOJE))).toContain("não existe");
    expect(erroDe(validarDataLimite("2025-13-01", HOJE))).toContain("não existe");
    for (const ruim of ["01/09/2026", "2026-9-1", "", "ontem", null, 20260901, "2026-09-01T00:00"]) {
      expect(validarDataLimite(ruim, HOJE).ok).toBe(false);
    }
  });

  it("29/02 só em ano bissexto", () => {
    expect(validarDataLimite("2024-02-29", HOJE).ok).toBe(true);
    expect(validarDataLimite("2025-02-29", HOJE).ok).toBe(false);
  });
});

describe("validarJornada", () => {
  it("converte HH:MM e HHMM para o formato do banco (4 dígitos)", () => {
    expect(validarJornada("08:48")).toEqual({ ok: true, valor: "0848" });
    expect(validarJornada("0848")).toEqual({ ok: true, valor: "0848" });
    expect(validarJornada("8:00")).toEqual({ ok: true, valor: "0800" });
    expect(validarJornada("01:00")).toEqual({ ok: true, valor: "0100" });
    expect(validarJornada("12:00")).toEqual({ ok: true, valor: "1200" });
  });

  it("recusa fora de 1h a 12h, minutos inválidos e formato errado", () => {
    expect(validarJornada("00:30").ok).toBe(false);
    expect(validarJornada("12:01").ok).toBe(false);
    expect(validarJornada("00:00").ok).toBe(false);
    expect(erroDe(validarJornada("08:75"))).toContain("minutos");
    for (const ruim of ["", "oito", "8", "08:4", "08-48", "123:00", null, 848]) {
      expect(validarJornada(ruim).ok).toBe(false);
    }
  });
});

describe("validarLimiteMensal", () => {
  it("inteiro de 0 a 744; vazio ou null = sem limite", () => {
    expect(validarLimiteMensal(0)).toEqual({ ok: true, valor: 0 });
    expect(validarLimiteMensal(40)).toEqual({ ok: true, valor: 40 });
    expect(validarLimiteMensal("120")).toEqual({ ok: true, valor: 120 });
    expect(validarLimiteMensal(744).ok).toBe(true);
    expect(validarLimiteMensal(null)).toEqual({ ok: true, valor: null });
    expect(validarLimiteMensal("")).toEqual({ ok: true, valor: null });
  });

  it("recusa negativo, decimal, acima de 744 e lixo", () => {
    for (const ruim of [-1, 1.5, 745, "abc", "1.5", "-3", {}, [], undefined, NaN, Infinity]) {
      expect(validarLimiteMensal(ruim).ok).toBe(false);
    }
  });
});

describe("validarHorasContratadas", () => {
  it("número com até 2 casas, aceitando vírgula", () => {
    expect(validarHorasContratadas(40)).toEqual({ ok: true, valor: 40 });
    expect(validarHorasContratadas("12,5")).toEqual({ ok: true, valor: 12.5 });
    expect(validarHorasContratadas("4.75")).toEqual({ ok: true, valor: 4.75 });
    expect(validarHorasContratadas(0)).toEqual({ ok: true, valor: 0 });
    expect(validarHorasContratadas(10000).ok).toBe(true);
  });

  it("recusa 3 casas, negativo, acima do máximo, vazio e lixo", () => {
    for (const ruim of ["1.234", -5, "-5", 10001, "", null, undefined, "abc", "1e3", "1,2,3"]) {
      expect(validarHorasContratadas(ruim).ok).toBe(false);
    }
  });
});

describe("validarAlteracoesConsultor", () => {
  it("valida só o que veio e normaliza os valores", () => {
    expect(validarAlteracoesConsultor({ permiteApontarNoPassado: true, jornada: "08:00" }, HOJE)).toEqual({
      ok: true,
      valor: { permiteApontarNoPassado: "SIM", jornada: "0800" },
    });
    expect(validarAlteracoesConsultor({ dataLimite: "2026-09-01" }, HOJE)).toEqual({ ok: true, valor: { dataLimite: "2026-09-01" } });
  });

  it("recusa campo desconhecido (não dá para gravar outra coluna), corpo vazio e corpo inválido", () => {
    expect(erroDe(validarAlteracoesConsultor({ NOME_RECURSO: "x" }, HOJE))).toContain("Campo não permitido: NOME_RECURSO");
    expect(erroDe(validarAlteracoesConsultor({ jornada: "08:00", ATIVO_RECURSO: 1 }, HOJE))).toContain("ATIVO_RECURSO");
    expect(erroDe(validarAlteracoesConsultor({}, HOJE))).toContain("Nenhuma alteração");
    for (const ruim of [null, undefined, "x", 5, []]) expect(validarAlteracoesConsultor(ruim, HOJE).ok).toBe(false);
  });

  it("um campo inválido derruba tudo (nada é gravado pela metade)", () => {
    expect(validarAlteracoesConsultor({ permiteApontarNoPassado: true, jornada: "99:99" }, HOJE).ok).toBe(false);
  });
});

describe("validarAlteracoesTarefa", () => {
  it("aceita os três campos; limite null limpa o limite", () => {
    expect(validarAlteracoesTarefa({ permiteExceder: "SIM", limiteMensalHoras: null, horasContratadas: "12,5" })).toEqual({
      ok: true,
      valor: { permiteExceder: "SIM", limiteMensalHoras: null, horasContratadas: 12.5 },
    });
  });

  it("recusa campo desconhecido, vazio e valor ruim", () => {
    expect(erroDe(validarAlteracoesTarefa({ STATUS_TAREFA: 4 }))).toContain("Campo não permitido");
    expect(erroDe(validarAlteracoesTarefa({}))).toContain("Nenhuma alteração");
    expect(validarAlteracoesTarefa({ horasContratadas: -1 }).ok).toBe(false);
    expect(validarAlteracoesTarefa({ permiteExceder: "TALVEZ" }).ok).toBe(false);
  });
});

describe("validarCodigo", () => {
  it("só dígitos (nada de texto livre vindo da URL)", () => {
    expect(validarCodigo("152", "Consultor")).toEqual({ ok: true, valor: 152 });
    for (const ruim of ["", "abc", "1; DROP", "-1", "1.5", "../x", "1234567890", null, undefined]) {
      expect(validarCodigo(ruim, "Consultor").ok).toBe(false);
    }
  });
});
