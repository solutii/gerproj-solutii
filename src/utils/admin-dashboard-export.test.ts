import { describe, expect, it } from "vitest";
import { csvDashboard, htmlDashboard } from "./admin-dashboard-export";
import { consultorBase, dashboardBase } from "./admin-dashboard.fixture";

describe("csvDashboard", () => {
  it("abre no Excel em pt-BR: BOM UTF-8, separador ';', quebra de linha CRLF", () => {
    const csv = csvDashboard(dashboardBase());

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("\r\n");
    expect(csv.split("\r\n")[0]).toBe("﻿Dashboard do administrador;outubro de 2026;Gerado em;02/10/2026 12:00");
  });

  it("traz todas as seções com os números da tela (horas decimais com vírgula)", () => {
    const csv = csvDashboard(dashboardBase());

    for (const titulo of ["Visão geral", "Consultores", "Tarefas em risco", "Tarefas com estouro liberado", "Chamados parados", "Chamados por semana", "Chamados abertos por cliente (mês)", "Chamados abertos por área (mês)", "Dias úteis sem apontamento", "Permissão de apontar no passado a rever", "Lançamentos atrasados"]) {
      expect(csv, titulo).toContain(`\r\n${titulo}\r\n`);
    }

    // 5280 min = 88 h; 11088 min = 184,8 h
    expect(csv).toContain("ANA SOUZA;8hs:48min;88,00;184,80;48;100;79,20;11;30;9;10;1;12;3;8;75;5,5;2;30");
    expect(csv).toContain("MIGRACAO;CLIENTE A;ANA SOUZA;Estourada;11,00;10;110");
    expect(csv).toContain("SUPORTE;CLIENTE B;BRUNO LIMA;2,00;;;Não");
    expect(csv).toContain("15001;Erro na nota;CLIENTE A;ANA SOUZA;STANDBY;21");
    expect(csv).toContain("28/09/2026;3;2");
    expect(csv).toContain("BRUNO LIMA;01/08/2026;62");
  });

  it("neutraliza fórmula do Excel em texto que vem do banco (nome começando com =, +, - ou @)", () => {
    const csv = csvDashboard(dashboardBase({ consultores: [consultorBase({ nome: "=HYPERLINK(\"http://x\")" })] }));

    expect(csv).toContain("'=HYPERLINK");
    expect(csv).not.toMatch(/(^|;|\r\n)=HYPERLINK/);
  });

  it("campo com ';' ou aspas vai entre aspas (sem quebrar as colunas)", () => {
    const csv = csvDashboard(dashboardBase({ chamados: { ...dashboardBase().chamados, parados: [{ codChamado: 1, assunto: 'Erro; "grave"', cliente: "C", consultor: "X", status: "STANDBY", diasParado: 9 }] } }));

    expect(csv).toContain('1;"Erro; ""grave"""');
  });

  it("sem dados nas listas: só os títulos e cabeçalhos, sem quebrar", () => {
    const vazio = dashboardBase({
      consultores: [],
      tarefas: { emRisco: [], comEstouroLiberado: [] },
      chamados: { abertosPorStatus: [], abertos: [], parados: [], totalParados: 0, porCliente: [], porArea: [], semanas: [] },
      qualidade: { diasSemApontamento: [], permissoesAntigas: [], lancamentosAtrasados: [] },
    });

    expect(() => csvDashboard(vazio)).not.toThrow();
    expect(csvDashboard(vazio)).toContain("\r\nConsultores\r\n");
  });
});

describe("htmlDashboard", () => {
  it("é um documento autônomo para imprimir, com resumo e tabelas", () => {
    const html = htmlDashboard(dashboardBase());

    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<title>Dashboard do administrador - outubro de 2026</title>");
    expect(html).toContain("Horas apontadas: 176hs:00min de 369hs:36min de meta (48%)");
    expect(html).toContain("ANA SOUZA");
    expect(html).toContain("Chamados parados (4)");
    expect(html).toContain("Estourada");
  });

  it("escapa HTML de texto que vem do banco (nome de cliente/assunto com tags)", () => {
    const html = htmlDashboard(
      dashboardBase({
        consultores: [consultorBase({ nome: '<script>alert("x")</script>' })],
        chamados: { ...dashboardBase().chamados, parados: [{ codChamado: 1, assunto: "<img src=x onerror=alert(1)>", cliente: "C", consultor: "X", status: "STANDBY", diasParado: 9 }] },
      }),
    );

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("listas vazias mostram mensagem em vez de tabela vazia", () => {
    const html = htmlDashboard(dashboardBase({ qualidade: { diasSemApontamento: [], permissoesAntigas: [], lancamentosAtrasados: [] } }));

    expect(html).toContain("Nenhum dia útil sem apontamento.");
    expect(html).toContain("Nenhuma permissão antiga.");
    expect(html).toContain("Nenhum lançamento atrasado.");
  });
});
