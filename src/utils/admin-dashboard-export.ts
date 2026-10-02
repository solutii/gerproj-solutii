import type { DashboardResposta } from "@/types/admin-dashboard";
import { formatarHoras, formatarNumero } from "@/utils/painel/horas";
import { campoCsv, escaparHtml, horasDecimais } from "@/utils/painel/espelho";

// Exportação do dashboard (CSV para o Excel e HTML para imprimir/salvar em PDF),
// montada no navegador a partir dos MESMOS dados que estão na tela. Nada é gravado.

const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const pct = (v: number | null) => (v === null ? "" : String(v));
const decimal = (v: number | null) => (v === null ? "" : String(v).replace(".", ","));

// "02/10/2026 12:00" no fuso de Brasília, a partir do ISO do servidor
function geradoEmTexto(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", "");
}

const SITUACAO_DA_TAREFA = { estourada: "Estourada", "no-limite": "No limite", liberada: "Estouro liberado" } as const;

// ─── CSV ────────────────────────────────────────────────────────────────────

export function csvDashboard(d: DashboardResposta): string {
  const linha = (campos: (string | number)[]) => campos.map((c) => campoCsv(String(c))).join(";");
  const secao = (titulo: string, cabecalho: string[], linhas: (string | number)[][]) =>
    ["", linha([titulo]), linha(cabecalho), ...linhas.map(linha)];
  const v = d.visao;

  const partes = [
    linha(["Dashboard do administrador", d.nomeMes, "Gerado em", geradoEmTexto(d.geradoEm)]),
    ...secao(
      "Visão geral",
      ["Consultores ativos", "Horas apontadas", "Meta do mês", "% da meta", "Mês anterior (mesmo ponto)", "Variação %", "Consultores com dias sem apontamento", "Chamados abertos", "Chamados parados", "Chamados finalizados no mês", "Tarefas em risco", "Tarefas com estouro liberado"],
      [[v.consultoresAtivos, horasDecimais(v.horasMin), horasDecimais(v.metaMesMin), pct(v.percentualMeta), horasDecimais(v.horasMesAnteriorMin), pct(v.variacao), v.consultoresComPendencia, v.chamadosAbertos, v.chamadosParados, v.chamadosFinalizadosNoMes, v.tarefasEmRisco, v.tarefasComEstouroLiberado]],
    ),
    ...secao(
      "Consultores",
      ["Consultor", "Jornada diária", "Horas apontadas", "Meta do mês", "% da meta", "% da meta até hoje", "Mês anterior (mesmo ponto)", "Variação %", "OS", "Dias que bateu a jornada", "Dias úteis passados", "Dias sem apontamento", "Chamados atendidos", "Chamados abertos", "Chamados finalizados", "SLA no prazo %", "Tempo médio de atendimento (h úteis)", "Lançamentos atrasados", "Lançamentos"],
      d.consultores.map((c) => [c.nome, formatarHoras(c.jornadaDiariaMin), horasDecimais(c.horasMin), horasDecimais(c.metaMesMin), pct(c.percentualMeta), pct(c.percentualMetaAteHoje), horasDecimais(c.horasMesAnteriorMin), pct(c.variacao), c.osQtd, c.diasBateuJornada, c.diasUteisPassados, c.diasSemApontamento.length, c.chamadosAtendidos, c.chamadosAbertos, c.chamadosFinalizados, pct(c.sla.percentualNoPrazo), decimal(c.sla.tempoMedioHoras), c.lancamentosAtrasados, c.lancamentosComData]),
    ),
    ...secao(
      "Tarefas em risco",
      ["Tarefa", "Cliente", "Responsável", "Situação", "Consumo no mês (h)", "Limite mensal (h)", "% do limite"],
      d.tarefas.emRisco.map((t) => [t.tarefa.nome, t.tarefa.cliente, t.tarefa.responsavel, SITUACAO_DA_TAREFA[t.situacao], horasDecimais(t.consumoMesMin), t.tarefa.limiteMensalHoras ?? "", pct(t.percentual)]),
    ),
    ...secao(
      "Tarefas com estouro liberado",
      ["Tarefa", "Cliente", "Responsável", "Consumo no mês (h)", "Limite mensal (h)", "% do limite", "Já passou do limite"],
      d.tarefas.comEstouroLiberado.map((t) => [t.tarefa.nome, t.tarefa.cliente, t.tarefa.responsavel, horasDecimais(t.consumoMesMin), t.tarefa.limiteMensalHoras ?? "", pct(t.percentual), t.passouDoLimite ? "Sim" : "Não"]),
    ),
    ...secao(
      "Chamados parados",
      ["Chamado", "Assunto", "Cliente", "Consultor", "Status", "Dias parado"],
      d.chamados.parados.map((c) => [c.codChamado, c.assunto, c.cliente, c.consultor, c.status, c.diasParado]),
    ),
    ...secao(
      "Chamados por semana",
      ["Semana (início)", "Abertos", "Concluídos"],
      d.chamados.semanas.map((s) => [dataBR(s.inicio), s.abertos, s.concluidos]),
    ),
    ...secao("Chamados abertos por cliente (mês)", ["Cliente", "Chamados"], d.chamados.porCliente.map((i) => [i.rotulo, i.quantidade])),
    ...secao("Chamados abertos por área (mês)", ["Área", "Chamados"], d.chamados.porArea.map((i) => [i.rotulo, i.quantidade])),
    ...secao(
      "Dias úteis sem apontamento",
      ["Consultor", "Quantidade", "Dias"],
      d.qualidade.diasSemApontamento.map((c) => [c.nome, c.quantidade, c.dias.map(dataBR).join(" ")]),
    ),
    ...secao(
      "Permissão de apontar no passado a rever",
      ["Consultor", "Data-limite", "Dias desde a data-limite"],
      d.qualidade.permissoesAntigas.map((c) => [c.nome, c.dataLimite ? dataBR(c.dataLimite) : "sem data", c.diasDesdeLimite ?? ""]),
    ),
    ...secao(
      "Lançamentos atrasados",
      ["Consultor", "Atrasados", "Lançamentos", "% atrasados"],
      d.qualidade.lancamentosAtrasados.map((c) => [c.nome, c.atrasados, c.total, c.percentual]),
    ),
  ];

  return `﻿${partes.join("\r\n")}\r\n`;
}

// ─── HTML (imprimir / salvar como PDF) ──────────────────────────────────────

export function htmlDashboard(d: DashboardResposta): string {
  const e = escaparHtml;
  const tabela = (titulo: string, cabecalho: string[], linhas: (string | number)[][], vazio = "Nada a mostrar.") =>
    `<h2>${e(titulo)}</h2>` +
    (linhas.length === 0
      ? `<p class="vazio">${e(vazio)}</p>`
      : `<table><thead><tr>${cabecalho.map((c) => `<th>${e(c)}</th>`).join("")}</tr></thead><tbody>${linhas
          .map((l) => `<tr>${l.map((c, i) => `<td${i > 0 && typeof c === "number" ? ' class="n"' : ""}>${e(String(c))}</td>`).join("")}</tr>`)
          .join("")}</tbody></table>`);
  const v = d.visao;

  const resumo = [
    `Horas apontadas: ${formatarHoras(v.horasMin)} de ${formatarHoras(v.metaMesMin)} de meta${v.percentualMeta === null ? "" : ` (${v.percentualMeta}%)`}`,
    `Mês anterior no mesmo ponto: ${formatarHoras(v.horasMesAnteriorMin)}${v.variacao === null ? "" : ` (${v.variacao > 0 ? "+" : ""}${v.variacao}%)`}`,
    `${formatarNumero(v.consultoresAtivos)} consultores ativos · ${formatarNumero(v.consultoresComPendencia)} com dias úteis sem apontamento`,
    `${formatarNumero(v.chamadosAbertos)} chamados abertos · ${formatarNumero(v.chamadosParados)} parados · ${formatarNumero(v.chamadosFinalizadosNoMes)} finalizados no mês`,
    `${formatarNumero(v.tarefasEmRisco)} tarefas em risco · ${formatarNumero(v.tarefasComEstouroLiberado)} com estouro liberado`,
  ];

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Dashboard do administrador - ${e(d.nomeMes)}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#111;margin:20px}
  h1{font-size:16px;margin:0 0 2px} h2{font-size:12px;margin:16px 0 4px} p{margin:0 0 4px;color:#444}
  .vazio{color:#777;font-style:italic}
  table{width:100%;border-collapse:collapse;margin-bottom:6px} th,td{border:1px solid #bbb;padding:3px 5px;vertical-align:top;text-align:left}
  th{background:#eee} .n{text-align:right;white-space:nowrap} tr{page-break-inside:avoid}
</style></head><body>
<h1>Dashboard do administrador</h1>
<p>${e(d.nomeMes)} · gerado em ${e(geradoEmTexto(d.geradoEm))}</p>
${resumo.map((l) => `<p>${e(l)}</p>`).join("\n")}
${tabela(
  "Consultores",
  ["Consultor", "Horas", "Meta", "% meta", "Mês ant.", "Var. %", "OS", "Dias c/ jornada", "Sem apont.", "Chamados atend.", "Abertos", "SLA %", "Atrasados"],
  d.consultores.map((c) => [c.nome, formatarHoras(c.horasMin), formatarHoras(c.metaMesMin), c.percentualMeta === null ? "—" : `${c.percentualMeta}%`, formatarHoras(c.horasMesAnteriorMin), c.variacao === null ? "—" : `${c.variacao}%`, c.osQtd, `${c.diasBateuJornada}/${c.diasUteisPassados}`, c.diasSemApontamento.length, c.chamadosAtendidos, c.chamadosAbertos, c.sla.percentualNoPrazo === null ? "—" : `${c.sla.percentualNoPrazo}%`, `${c.lancamentosAtrasados}/${c.lancamentosComData}`]),
)}
${tabela(
  "Tarefas em risco",
  ["Tarefa", "Cliente", "Responsável", "Situação", "Consumo no mês", "Limite mensal", "% do limite"],
  d.tarefas.emRisco.map((t) => [t.tarefa.nome, t.tarefa.cliente, t.tarefa.responsavel, SITUACAO_DA_TAREFA[t.situacao], formatarHoras(t.consumoMesMin), t.tarefa.limiteMensalHoras === null ? "—" : `${t.tarefa.limiteMensalHoras}h`, t.percentual === null ? "—" : `${t.percentual}%`]),
)}
${tabela(
  "Tarefas com estouro liberado",
  ["Tarefa", "Cliente", "Responsável", "Consumo no mês", "Limite mensal", "% do limite"],
  d.tarefas.comEstouroLiberado.map((t) => [t.tarefa.nome, t.tarefa.cliente, t.tarefa.responsavel, formatarHoras(t.consumoMesMin), t.tarefa.limiteMensalHoras === null ? "sem limite" : `${t.tarefa.limiteMensalHoras}h`, t.percentual === null ? "—" : `${t.percentual}%`]),
)}
${tabela(
  `Chamados parados (${formatarNumero(d.chamados.totalParados)})`,
  ["Chamado", "Assunto", "Cliente", "Consultor", "Status", "Dias parado"],
  d.chamados.parados.map((c) => [formatarNumero(c.codChamado), c.assunto, c.cliente, c.consultor, c.status, formatarNumero(c.diasParado)]),
)}
${tabela(
  "Chamados por semana",
  ["Semana (início)", "Abertos", "Concluídos"],
  d.chamados.semanas.map((s) => [dataBR(s.inicio), s.abertos, s.concluidos]),
)}
${tabela(
  "Dias úteis sem apontamento",
  ["Consultor", "Quantidade", "Últimos dias"],
  d.qualidade.diasSemApontamento.map((c) => [c.nome, c.quantidade, c.dias.map((x) => x.slice(8, 10) + "/" + x.slice(5, 7)).join(" ")]),
  "Nenhum dia útil sem apontamento.",
)}
${tabela(
  "Permissão de apontar no passado a rever",
  ["Consultor", "Data-limite", "Dias desde a data-limite"],
  d.qualidade.permissoesAntigas.map((c) => [c.nome, c.dataLimite ? dataBR(c.dataLimite) : "sem data", c.diasDesdeLimite ?? "—"]),
  "Nenhuma permissão antiga.",
)}
${tabela(
  "Lançamentos atrasados",
  ["Consultor", "Atrasados", "Lançamentos", "% atrasados"],
  d.qualidade.lancamentosAtrasados.map((c) => [c.nome, c.atrasados, c.total, `${c.percentual}%`]),
  "Nenhum lançamento atrasado.",
)}
</body></html>`;
}
