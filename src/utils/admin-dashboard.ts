import { diaDaSemana, diasEntre, ehDiaUtil, somarDias } from "@/utils/painel/dias-uteis";
import { limitesDoMes, mesAnterior } from "@/utils/painel/periodo";
import type { ItemDeContagem, SituacaoDaTarefaNoDashboard } from "@/types/admin-dashboard";

// Regras puras do dashboard do administrador (sem banco): semanas, atraso de
// lançamento, permissões esquecidas, situação das tarefas e contagens.

// Lançar com mais que isso de dias úteis depois do dia trabalhado conta como atrasado.
// (Sexta trabalhada e lançada na segunda NÃO é atraso: é 1 dia útil.)
export const DIAS_UTEIS_ATE_ATRASO = 1;

// Tarefa com este consumo do limite mensal (ou mais) aparece como "no limite".
export const PERCENTUAL_NO_LIMITE = 80;

export const SEMANAS_NO_DASHBOARD = 8;

export const percentual = (parte: number, todo: number): number | null => (todo > 0 ? Math.round((parte / todo) * 100) : null);

// ─── Semanas (segunda a domingo) ────────────────────────────────────────────

export type Semana = { inicio: string; fim: string; rotulo: string };

const diaMes = (dataISO: string) => `${dataISO.slice(8, 10)}/${dataISO.slice(5, 7)}`;

// As `n` últimas semanas, da mais antiga para a mais nova; a última é a semana de `ate`.
export function semanasTerminandoEm(ate: string, n: number = SEMANAS_NO_DASHBOARD): Semana[] {
  const segunda = somarDias(ate, -((diaDaSemana(ate) + 6) % 7));
  const semanas: Semana[] = [];

  for (let i = n - 1; i >= 0; i--) {
    const inicio = somarDias(segunda, -7 * i);

    semanas.push({ inicio, fim: somarDias(inicio, 6), rotulo: diaMes(inicio) });
  }

  return semanas;
}

// Posição da semana que contém a data (-1 se está fora da janela).
export function indiceDaSemana(semanas: Semana[], data: string): number {
  return semanas.findIndex((s) => data >= s.inicio && data <= s.fim);
}

// ─── Lançamento atrasado ────────────────────────────────────────────────────

// Dias úteis entre o dia trabalhado (exclusive) e o dia do lançamento (inclusive).
export function diasUteisDeAtraso(trabalhado: string, lancado: string): number {
  if (lancado <= trabalhado) return 0;

  // trava de segurança: datas absurdas não podem virar um laço enorme
  const dias = Math.min(diasEntre(trabalhado, lancado), 400);
  let total = 0;

  for (let i = 1; i <= dias; i++) if (ehDiaUtil(somarDias(trabalhado, i))) total++;

  return total;
}

export function lancamentoAtrasado(trabalhado: string, lancado: string): boolean {
  return diasUteisDeAtraso(trabalhado, lancado) > DIAS_UTEIS_ATE_ATRASO;
}

// ─── Permissão de apontar no passado ────────────────────────────────────────

// Liberação que ficou para trás: "apontar no passado" = SIM e a data-limite é anterior ao
// início do MÊS PASSADO (ou nem existe). Na prática a data-limite é renovada para o dia 1º
// de cada mês, então a de até um mês atrás é normal e não deve alarmar. Devolve os dias
// desde a data-limite (null sem data) ou undefined se não há o que revisar.
export function permissaoParaRever(
  permiteNoPassado: boolean,
  dataLimite: string | null,
  hoje: string,
): { diasDesdeLimite: number | null } | undefined {
  if (!permiteNoPassado) return undefined;
  if (!dataLimite) return { diasDesdeLimite: null };

  const inicioDoMesPassado = limitesDoMes(mesAnterior(hoje.slice(0, 7))).inicio;

  return dataLimite < inicioDoMesPassado ? { diasDesdeLimite: diasEntre(dataLimite, hoje) } : undefined;
}

// ─── Tarefas ────────────────────────────────────────────────────────────────

// - com estouro liberado (PERIMP = SIM): "liberada" (o limite nunca bloqueia; interessa
//   ao administrador lembrar de fechar), e `passouDoLimite` diz se já usou o estouro;
// - sem liberação e com limite mensal: "estourada" (>= 100%) ou "no-limite" (>= 80%);
// - o resto: nada a mostrar.
export function situacaoDaTarefaNoDashboard(params: {
  limiteMensalHoras: number | null;
  consumoMesMin: number;
  permiteExceder: boolean;
}): { situacao: SituacaoDaTarefaNoDashboard; percentual: number | null; passouDoLimite: boolean } | null {
  const { limiteMensalHoras, consumoMesMin, permiteExceder } = params;
  const pct = limiteMensalHoras && limiteMensalHoras > 0 ? percentual(consumoMesMin, limiteMensalHoras * 60) : null;
  const passou = pct !== null && pct >= 100;

  if (permiteExceder) return { situacao: "liberada", percentual: pct, passouDoLimite: passou };
  if (pct === null) return null;
  if (pct >= 100) return { situacao: "estourada", percentual: pct, passouDoLimite: true };
  if (pct >= PERCENTUAL_NO_LIMITE) return { situacao: "no-limite", percentual: pct, passouDoLimite: false };

  return null;
}

// Mais urgente primeiro: estouradas, depois as no limite (maior % antes); liberadas
// que já passaram do limite antes das demais.
export function ordemDeUrgencia(a: { percentual: number | null; passouDoLimite: boolean }, b: { percentual: number | null; passouDoLimite: boolean }) {
  if (a.passouDoLimite !== b.passouDoLimite) return a.passouDoLimite ? -1 : 1;

  return (b.percentual ?? -1) - (a.percentual ?? -1);
}

// ─── Contagens ──────────────────────────────────────────────────────────────

// Conta por chave, do maior para o menor; mantém os `topN` e junta o resto em "Outros".
export function contarPor<T>(itens: T[], chave: (i: T) => string, rotulo: (i: T) => string, topN: number): ItemDeContagem[] {
  const mapa = new Map<string, ItemDeContagem>();

  for (const item of itens) {
    const k = chave(item);
    const atual = mapa.get(k);

    if (atual) atual.quantidade++;
    else mapa.set(k, { chave: k, rotulo: rotulo(item), quantidade: 1 });
  }

  const ordenado = [...mapa.values()].sort((a, b) => b.quantidade - a.quantidade || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  if (ordenado.length <= topN) return ordenado;

  const resto = ordenado.slice(topN).reduce((s, i) => s + i.quantidade, 0);

  return [...ordenado.slice(0, topN), { chave: "__outros__", rotulo: "Outros", quantidade: resto }];
}

// ─── Quando foi atualizado ──────────────────────────────────────────────────

// "agora mesmo", "há 3 min", "há 2 h" a partir do instante (ISO) em que os números foram
// calculados. Vazio se a data é ilegível.
export function textoDeIdade(geradoEmISO: string, agoraMs: number): string {
  const instante = new Date(geradoEmISO).getTime();
  if (Number.isNaN(instante)) return "";

  const minutos = Math.max(0, Math.floor((agoraMs - instante) / 60_000));

  if (minutos < 1) return "agora mesmo";
  if (minutos < 60) return `há ${minutos} min`;

  const horas = Math.floor(minutos / 60);

  return horas < 24 ? `há ${horas} h` : "há mais de 1 dia";
}

// "15:50" no fuso de Brasília
export function horaDeBrasilia(iso: string): string {
  const d = new Date(iso);

  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
}

// "em instantes", "em menos de 1 min", "em 3 min": quanto falta para a próxima atualização.
export function textoDeFalta(msRestantes: number): string {
  if (msRestantes <= 0) return "em instantes";
  if (msRestantes < 60_000) return "em menos de 1 min";

  return `em ${Math.ceil(msRestantes / 60_000)} min`;
}

// ─── Nome curto ─────────────────────────────────────────────────────────────

const LIGACOES = new Set(["de", "da", "do", "dos", "das", "e"]);

// Os dois primeiros NOMES de uma pessoa, para caber em tabelas estreitas. As ligações (de, da, do,
// dos, das, e) não contam como nome e ficam quando estão entre dois nomes mantidos:
// "MARIA DE FÁTIMA FALCÃO LIMA" -> "MARIA DE FÁTIMA"; "JOAO PAULO DE FRANÇA SILVA" -> "JOAO PAULO".
export function doisPrimeirosNomes(nome: string): string {
  const palavras = nome.trim().split(/\s+/).filter(Boolean);
  const mantidas: string[] = [];
  let ligacoesPendentes: string[] = [];
  let nomes = 0;

  for (const palavra of palavras) {
    // ligação depois de um nome: espera para ver se vem outro nome a seguir
    if (nomes > 0 && LIGACOES.has(palavra.toLowerCase())) {
      ligacoesPendentes.push(palavra);
      continue;
    }
    if (nomes === 2) break;

    mantidas.push(...ligacoesPendentes, palavra);
    ligacoesPendentes = [];
    nomes++;
  }

  return mantidas.join(" ");
}

// Só o PRIMEIRO nome do cliente ("SOMAPEL LTDA" -> "SOMAPEL", "GV PNEUS E SERVICOS SA" -> "GV"), para
// caber em tabelas estreitas. O texto padrão "Sem cliente" não é nome de cliente: fica inteiro.
export const SEM_CLIENTE = "Sem cliente";

export function primeiroNomeDoCliente(nome: string): string {
  const limpo = nome.trim();
  if (limpo === SEM_CLIENTE) return limpo;

  return limpo.split(/\s+/)[0] ?? "";
}
