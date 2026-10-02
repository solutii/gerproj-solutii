// @vitest-environment node
//
// Teste de INTEGRAÇÃO (SOMENTE LEITURA): monta o dashboard do administrador contra o
// Firebird do .env e confere que, para cada consultor, os números são os MESMOS do
// Meu Painel dele. Fica DESLIGADO por padrão (não roda em "npx vitest run"). Para rodar,
// SÓ com o .env apontando para o banco LOCAL:
//
//   $env:INTEGRACAO_BANCO = "1"; npx vitest run src/services/admin/dashboard.integracao.test.ts
import { beforeAll, describe, expect, it } from "vitest";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const LIGADO = process.env.INTEGRACAO_BANCO === "1";

describe.skipIf(!LIGADO)("dashboard do administrador x Meu Painel (banco local, só leitura)", () => {
  let montarDashboard: typeof import("./dashboard").montarDashboard;
  let montarPainel: typeof import("../painel").montarPainel;
  let mesAtual: typeof import("@/utils/painel/periodo").mesAtual;
  let mesAnterior: typeof import("@/utils/painel/periodo").mesAnterior;

  beforeAll(async () => {
    const host = process.env.FIREBIRD_HOST ?? "";
    // trava de segurança: nunca roda contra um banco que não seja o local
    if (!/^(localhost|127\.0\.0\.1)$/i.test(host)) throw new Error(`FIREBIRD_HOST=${host}: este teste só roda no banco LOCAL`);

    ({ montarDashboard } = await import("./dashboard"));
    ({ montarPainel } = await import("../painel"));
    ({ mesAtual, mesAnterior } = await import("@/utils/painel/periodo"));
  });

  it("mês passado: horas, meta, SLA e dias sem apontamento batem com o Meu Painel de cada consultor", async () => {
    const mes = mesAnterior(mesAtual());
    const inicio = Date.now();
    const dashboard = await montarDashboard(mes);
    const ms = Date.now() - inicio;

    console.log(`dashboard de ${mes}: ${ms} ms; ${dashboard.consultores.length} consultores; visão`, JSON.stringify(dashboard.visao));
    expect(dashboard.consultores.length).toBeGreaterThan(0);

    // os de mais horas e os de menos: o conjunto cobre casos diferentes
    const ordenados = [...dashboard.consultores].sort((a, b) => b.horasMin - a.horasMin);
    const amostra = [...ordenados.slice(0, 4), ...ordenados.slice(-2)];

    for (const c of amostra) {
      const painel = await montarPainel(c.codigo, mes);

      expect(c.horasMin, `${c.nome}: horas`).toBe(painel.resumo.horasApontadasMin);
      expect(c.metaMesMin, `${c.nome}: meta`).toBe(painel.resumo.metaMesMin);
      expect(c.diasSemApontamento, `${c.nome}: dias sem apontamento`).toEqual(painel.resumo.diasSemApontamento);
      expect(c.sla.percentualNoPrazo, `${c.nome}: SLA`).toBe(painel.resultado.sla.percentualNoPrazo);
      expect(c.sla.total, `${c.nome}: SLA total`).toBe(painel.resultado.sla.total);
      expect(c.horasMesAnteriorMin, `${c.nome}: mês anterior`).toBe(painel.comparacao.horas.anteriorMin);
      expect(c.osQtd, `${c.nome}: OS`).toBe(painel.comparacao.os.atual);
    }
  }, 120_000);

  it("mês atual: mesmos números, e a resposta tem todos os blocos", async () => {
    const mes = mesAtual();
    const dashboard = await montarDashboard(mes);

    for (const c of dashboard.consultores.slice(0, 3)) {
      const painel = await montarPainel(c.codigo, mes);

      expect(c.horasMin, `${c.nome}: horas`).toBe(painel.resumo.horasApontadasMin);
      expect(c.horasMesAnteriorMin, `${c.nome}: mês anterior no mesmo ponto`).toBe(painel.comparacao.horas.anteriorMin);
      expect(c.chamadosAbertos, `${c.nome}: chamados abertos`).toBe(painel.chamados.porStatus.reduce((s, x) => s + x.quantidade, 0));
    }

    expect(dashboard.chamados.semanas).toHaveLength(8);
    expect(dashboard.chamados.abertosPorStatus.length).toBeGreaterThanOrEqual(0);
    console.log("tarefas em risco:", dashboard.tarefas.emRisco.length, "liberadas:", dashboard.tarefas.comEstouroLiberado.length);
    console.log("qualidade:", dashboard.qualidade.diasSemApontamento.length, dashboard.qualidade.permissoesAntigas.length, dashboard.qualidade.lancamentosAtrasados.length);
    console.log("semanas:", JSON.stringify(dashboard.chamados.semanas));
  }, 120_000);
});
