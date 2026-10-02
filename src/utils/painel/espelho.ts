import { formatarHoras } from "./horas";

// Linha do espelho de apontamentos (uma OS).
export type LinhaEspelho = {
  data: string; // "AAAA-MM-DD"
  inicio: string; // "HH:MM"
  fim: string; // "HH:MM"
  minutos: number;
  cliente: string;
  tarefa: string;
  chamado: string; // "" para OS de tarefa
  codOs: number;
  descricao: string;
};

export type DadosEspelho = {
  consultor: string;
  nomeMes: string;
  linhas: LinhaEspelho[];
  totalMin: number;
  // meta do mês do consultor (jornada diária × dias úteis); omitido sem jornada cadastrada
  meta?: { jornadaDiariaMin: number; diasUteis: number; metaMesMin: number };
};

// "Meta do mês: 184h48 (21 dias úteis × 8h48) · apontado 150h (81% da meta)"
export function textoMetaEspelho(meta: DadosEspelho["meta"], totalMin: number): string {
  if (!meta || meta.metaMesMin <= 0) return "";

  const pct = Math.round((totalMin / meta.metaMesMin) * 100);

  return `Meta do mês: ${formatarHoras(meta.metaMesMin)} (${meta.diasUteis} dias úteis × ${formatarHoras(meta.jornadaDiariaMin)}) · apontado ${formatarHoras(totalMin)} (${pct}% da meta)`;
}

const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

// Neutraliza "injeção de fórmula" no Excel: texto que começa com = + - @ vira
// fórmula ao abrir o CSV. Um apóstrofo na frente o mantém como texto.
function textoSeguro(valor: string): string {
  return /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
}

export function campoCsv(valor: string): string {
  const limpo = textoSeguro(valor).replace(/\r?\n/g, " ");

  return /[;"]/.test(limpo) ? `"${limpo.replace(/"/g, '""')}"` : limpo;
}

// "8,50" (pt-BR) a partir de minutos.
export const horasDecimais = (minutos: number) => (Math.round((minutos / 60) * 100) / 100).toFixed(2).replace(".", ",");

// CSV para abrir no Excel em pt-BR: separador ";" e BOM UTF-8 (acentos).
export function csvEspelho(linhas: LinhaEspelho[]): string {
  const cabecalho = ["Data", "Início", "Fim", "Horas", "Cliente", "Tarefa", "Chamado", "OS", "Descrição"];
  const corpo = linhas.map((l) =>
    [dataBR(l.data), l.inicio, l.fim, horasDecimais(l.minutos), l.cliente, l.tarefa, l.chamado, String(l.codOs), l.descricao]
      .map(campoCsv)
      .join(";"),
  );
  const total = ["Total", "", "", horasDecimais(linhas.reduce((s, l) => s + l.minutos, 0)), "", "", "", "", ""]
    .map(campoCsv)
    .join(";");

  return `﻿${[cabecalho.join(";"), ...corpo, total].join("\r\n")}\r\n`;
}

export const escaparHtml = (texto: string) =>
  texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// Documento HTML completo e autônomo (CSS inline) para imprimir ou salvar como PDF.
export function htmlEspelho({ consultor, nomeMes, linhas, totalMin, meta }: DadosEspelho): string {
  const textoMeta = textoMetaEspelho(meta, totalMin);
  const corpo = linhas
    .map(
      (l) => `<tr>
  <td>${dataBR(l.data)}</td><td>${escaparHtml(l.inicio)}–${escaparHtml(l.fim)}</td>
  <td class="n">${formatarHoras(l.minutos)}</td><td>${escaparHtml(l.cliente)}</td>
  <td>${escaparHtml(l.tarefa)}${l.chamado ? ` · chamado ${escaparHtml(l.chamado)}` : ""}</td>
  <td>${escaparHtml(l.descricao)}</td>
</tr>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Espelho de apontamentos - ${escaparHtml(nomeMes)}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#111;margin:24px}
  h1{font-size:16px;margin:0 0 2px} p{margin:0 0 14px;color:#444}
  table{width:100%;border-collapse:collapse} th,td{border:1px solid #bbb;padding:4px 6px;vertical-align:top;text-align:left}
  th{background:#eee} .n{text-align:right;white-space:nowrap} tfoot td{font-weight:bold;background:#f6f6f6}
  tr{page-break-inside:avoid}
</style></head><body>
<h1>Espelho de apontamentos</h1>
<p>${escaparHtml(consultor)} · ${escaparHtml(nomeMes)} · ${linhas.length} OS${textoMeta ? `<br>${escaparHtml(textoMeta)}` : ""}</p>
<table>
<thead><tr><th>Data</th><th>Horário</th><th>Horas</th><th>Cliente</th><th>Tarefa / chamado</th><th>Descrição</th></tr></thead>
<tbody>
${corpo}
</tbody>
<tfoot><tr><td colspan="2">Total</td><td class="n">${formatarHoras(totalMin)}</td><td colspan="3"></td></tr></tfoot>
</table>
</body></html>`;
}
