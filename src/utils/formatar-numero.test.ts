import { describe, expect, it } from "vitest";
import { formatarHoras, formatarNumero } from "./painel/horas";
import { descreverAlteracaoTarefa } from "./admin-form";
import { formatarValor } from "./admin-historico";
import { csvDashboard, htmlDashboard } from "./admin-dashboard-export";
import { dashboardBase } from "./admin-dashboard.fixture";

describe("formatarNumero (pt-BR)", () => {
  it("separador de milhar com ponto e decimal com vírgula", () => {
    expect(formatarNumero(0)).toBe("0");
    expect(formatarNumero(999)).toBe("999");
    expect(formatarNumero(1000)).toBe("1.000");
    expect(formatarNumero(4233)).toBe("4.233");
    expect(formatarNumero(1234567)).toBe("1.234.567");
    expect(formatarNumero(12.5)).toBe("12,5");
    expect(formatarNumero(1500.25)).toBe("1.500,25");
    expect(formatarNumero(-1200)).toBe("-1.200");
  });

  it("valor inválido vira vazio (não mostra NaN)", () => {
    expect(formatarNumero(NaN)).toBe("");
    expect(formatarNumero(Infinity)).toBe("");
  });
});

describe("formatarHoras com milhar", () => {
  it("horas a partir de 1.000 ganham separador; minutos continuam com 2 dígitos", () => {
    expect(formatarHoras(254016)).toBe("4.233hs:36min"); // a meta do time inteiro
    expect(formatarHoras(60000)).toBe("1.000hs:00min");
    expect(formatarHoras(59940)).toBe("999hs:00min");
    expect(formatarHoras(60005)).toBe("1.000hs:05min");
  });

  it("abaixo de 1.000 horas só muda o formato (sem separador de milhar)", () => {
    expect(formatarHoras(0)).toBe("0h:00min");
    expect(formatarHoras(528)).toBe("8hs:48min");
    expect(formatarHoras(11088)).toBe("184hs:48min");
    expect(formatarHoras(30)).toBe("0h:30min");
  });
});

describe("h (até 1 hora) e hs (mais de 1 hora), sempre com minutos", () => {
  it("a parte das horas é 'h' quando é 0 ou 1 e 'hs' a partir de 2", () => {
    expect(formatarHoras(0)).toBe("0h:00min");
    expect(formatarHoras(59)).toBe("0h:59min");
    expect(formatarHoras(60)).toBe("1h:00min");
    expect(formatarHoras(90)).toBe("1h:30min");
    expect(formatarHoras(119)).toBe("1h:59min");
    expect(formatarHoras(120)).toBe("2hs:00min");
    expect(formatarHoras(2730)).toBe("45hs:30min");
  });

  it("minutos sempre com 2 dígitos e arredondamento para o minuto inteiro", () => {
    expect(formatarHoras(61)).toBe("1h:01min");
    expect(formatarHoras(125.6)).toBe("2hs:06min");
  });
});

describe("outros textos com número grande", () => {
  const tarefa = { codigo: 1771, nome: "T", cliente: "C", responsavel: "R", status: 2, statusTexto: "Desenvolvimento", permiteExceder: false, limiteMensalHoras: 40, horasContratadas: 1500.5 };

  it("confirmação da tarefa: horas contratadas antes e depois com milhar e vírgula", () => {
    expect(descreverAlteracaoTarefa(tarefa, { horasContratadas: 2500 })).toBe("Horas contratadas: 1.500,5h → 2.500h");
  });

  it("histórico: limite e horas contratadas com milhar", () => {
    expect(formatarValor("horasContratadas", 1500.5)).toBe("1.500,5h");
    expect(formatarValor("limiteMensalHoras", 40)).toBe("40h");
  });

  it("exportação em HTML usa separador; o CSV mantém números puros para o Excel somar", () => {
    const d = dashboardBase();
    d.visao = { ...d.visao, horasMin: 254016, chamadosAbertos: 1234, chamadosParados: 1100 };
    d.chamados = { ...d.chamados, parados: [{ ...d.chamados.parados[0], codChamado: 15186 }], totalParados: 1100 };

    const html = htmlDashboard(d);
    expect(html).toContain("Horas apontadas: 4.233hs:36min de");
    expect(html).toContain("1.234 chamados abertos · 1.100 parados");
    expect(html).toContain("15.186");
    expect(html).toContain("Chamados parados (1.100)");

    const csv = csvDashboard(d);
    expect(csv).toContain("\r\n15186;");
    expect(csv).toContain(";4233,60;"); // horas decimais sem separador de milhar
    expect(csv).not.toContain("15.186");
  });
});
