import { describe, expect, it } from "vitest";
import type { ConsultorAdmin, TarefaAdmin } from "@/types/admin";
import {
  alteracaoDaTarefa,
  alteracaoDoConsultor,
  descreverAlteracaoConsultor,
  descreverAlteracaoTarefa,
  formDaTarefa,
  formDoConsultor,
  situacaoDaTarefa,
  situacaoDoConsultor,
} from "./admin-form";

const HOJE = "2026-10-02";

const consultor: ConsultorAdmin = { codigo: 152, nome: "ANA", ativo: true, permiteApontarNoPassado: false, dataLimite: "2026-08-01", jornada: "08:48" };
const tarefa: TarefaAdmin = {
  codigo: 1771,
  nome: "TESTES",
  cliente: "SOMAPEL",
  responsavel: "ANA",
  status: 3,
  statusTexto: "Teste",
  permiteExceder: false,
  limiteMensalHoras: 40,
  horasContratadas: 12.5,
};

describe("consultor: o que mudou", () => {
  it("formulário sem mexer não gera alteração", () => {
    expect(alteracaoDoConsultor(consultor, formDoConsultor(consultor))).toEqual({});
  });

  it("só entra o que mudou", () => {
    const form = { ...formDoConsultor(consultor), permiteApontarNoPassado: true, jornada: "09:00" };

    expect(alteracaoDoConsultor(consultor, form)).toEqual({ permiteApontarNoPassado: true, jornada: "09:00" });
  });

  it("consultor sem data-limite cadastrada: campo vazio não é mudança", () => {
    const semData = { ...consultor, dataLimite: null };

    expect(alteracaoDoConsultor(semData, formDoConsultor(semData))).toEqual({});
    expect(alteracaoDoConsultor(semData, { ...formDoConsultor(semData), dataLimite: "2026-09-01" })).toEqual({ dataLimite: "2026-09-01" });
  });
});

describe("consultor: situação do formulário", () => {
  it("sem mudança: nada a salvar, sem erro", () => {
    expect(situacaoDoConsultor({}, HOJE)).toEqual({ alterou: false, erro: null });
  });

  it("mudança válida: pode salvar; inválida: devolve a mensagem do servidor", () => {
    expect(situacaoDoConsultor({ jornada: "09:00" }, HOJE)).toEqual({ alterou: true, erro: null });
    expect(situacaoDoConsultor({ dataLimite: "2999-01-01" }, HOJE).erro).toContain("futura");
    expect(situacaoDoConsultor({ jornada: "25:00" }, HOJE).erro).toContain("Jornada");
    expect(situacaoDoConsultor({ dataLimite: "" }, HOJE).erro).toContain("Data-limite");
  });
});

describe("tarefa: o que mudou", () => {
  it("formulário sem mexer não gera alteração (horas com vírgula contam como iguais)", () => {
    expect(formDaTarefa(tarefa).horasContratadas).toBe("12,5");
    expect(alteracaoDaTarefa(tarefa, formDaTarefa(tarefa))).toEqual({});
  });

  it("limite vazio vira null (sem limite); número vira número", () => {
    expect(alteracaoDaTarefa(tarefa, { ...formDaTarefa(tarefa), limiteMensal: "" })).toEqual({ limiteMensalHoras: null });
    expect(alteracaoDaTarefa(tarefa, { ...formDaTarefa(tarefa), limiteMensal: "60" })).toEqual({ limiteMensalHoras: 60 });
  });

  it("tarefa sem limite: continuar vazio não é mudança", () => {
    const semLimite = { ...tarefa, limiteMensalHoras: null };

    expect(alteracaoDaTarefa(semLimite, formDaTarefa(semLimite))).toEqual({});
  });

  it("horas contratadas e liberar estouro", () => {
    expect(alteracaoDaTarefa(tarefa, { ...formDaTarefa(tarefa), permiteExceder: true, horasContratadas: "20" })).toMatchObject({ permiteExceder: true });
    expect(situacaoDaTarefa(alteracaoDaTarefa(tarefa, { ...formDaTarefa(tarefa), horasContratadas: "20,5" }))).toEqual({ alterou: true, erro: null });
  });
});

describe("tarefa: situação do formulário", () => {
  it("valores inválidos devolvem erro e não salvam", () => {
    expect(situacaoDaTarefa({})).toEqual({ alterou: false, erro: null });
    expect(situacaoDaTarefa({ limiteMensalHoras: 1.5 }).erro).toContain("Limite mensal");
    expect(situacaoDaTarefa(alteracaoDaTarefa(tarefa, { ...formDaTarefa(tarefa), horasContratadas: "abc" })).erro).toContain("Horas contratadas");
    expect(situacaoDaTarefa(alteracaoDaTarefa(tarefa, { ...formDaTarefa(tarefa), limiteMensal: "-3" })).erro).toContain("Limite mensal");
  });
});

describe("textos de confirmação", () => {
  it("consultor", () => {
    expect(descreverAlteracaoConsultor(consultor, { permiteApontarNoPassado: true, dataLimite: "2026-09-01", jornada: "09:00" })).toBe(
      "Apontar no passado: Não → Sim; Data-limite: 01/08/2026 → 01/09/2026; Jornada: 08:48 → 09:00",
    );
    expect(descreverAlteracaoConsultor({ ...consultor, dataLimite: null }, { dataLimite: "2026-09-01" })).toBe("Data-limite: (vazio) → 01/09/2026");
  });

  it("tarefa", () => {
    expect(descreverAlteracaoTarefa(tarefa, { permiteExceder: true, limiteMensalHoras: null, horasContratadas: 13.25 })).toBe(
      "Liberar estouro do limite: Não → Sim; Limite mensal: 40h → sem limite; Horas contratadas: 12,5h → 13,25h",
    );
  });
});
