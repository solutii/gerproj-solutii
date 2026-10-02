// Validação do que o painel de administração pode gravar. Roda no servidor
// (a tela também valida, mas ninguém é obrigado a usar a tela). Só os campos
// listados aqui podem ser alterados; qualquer outro é recusado.

export type Resultado<T> = { ok: true; valor: T } | { ok: false; erro: string };

const ok = <T>(valor: T): Resultado<T> => ({ ok: true, valor });
const falha = (erro: string): Resultado<never> => ({ ok: false, erro });

const DATA_MINIMA = "2000-01-01";

// Aceita true/false ou "SIM"/"NAO" (como está no banco, CHAR(3)).
export function validarSimNao(valor: unknown, rotulo: string): Resultado<"SIM" | "NAO"> {
  if (valor === true) return ok("SIM");
  if (valor === false) return ok("NAO");

  const texto = typeof valor === "string" ? valor.trim().toUpperCase() : "";
  if (texto === "SIM" || texto === "NAO") return ok(texto);

  return falha(`${rotulo}: use SIM ou NAO.`);
}

// "AAAA-MM-DD": data real, a partir de 2000 e não posterior a hoje (a data-limite
// é "desde quando pode apontar"; no futuro não faz sentido).
export function validarDataLimite(valor: unknown, hoje: string): Resultado<string> {
  const texto = typeof valor === "string" ? valor.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return falha("Data-limite: use o formato AAAA-MM-DD.");

  const [a, m, d] = texto.split("-").map(Number);
  const data = new Date(Date.UTC(a, m - 1, d));
  if (data.getUTCFullYear() !== a || data.getUTCMonth() !== m - 1 || data.getUTCDate() !== d) {
    return falha("Data-limite: essa data não existe.");
  }
  if (texto < DATA_MINIMA) return falha("Data-limite: a data é antiga demais (mínimo 01/01/2000).");
  if (texto > hoje) return falha("Data-limite: não pode ser uma data futura.");

  return ok(texto);
}

export const JORNADA_MINIMA_MIN = 60; // 1h
export const JORNADA_MAXIMA_MIN = 12 * 60; // 12h

// "HH:MM" ou "HHMM" -> "HHMM" (como está no banco, CHAR(4)). Entre 1h e 12h por dia.
export function validarJornada(valor: unknown): Resultado<string> {
  const texto = typeof valor === "string" ? valor.trim() : "";
  const m = texto.match(/^(\d{1,2}):?(\d{2})$/);
  if (!m) return falha("Jornada diária: use o formato HH:MM (ex.: 08:48).");

  const horas = Number(m[1]);
  const minutos = Number(m[2]);
  if (minutos > 59) return falha("Jornada diária: os minutos vão de 00 a 59.");

  const total = horas * 60 + minutos;
  if (total < JORNADA_MINIMA_MIN || total > JORNADA_MAXIMA_MIN) {
    return falha("Jornada diária: precisa ficar entre 01:00 e 12:00.");
  }

  return ok(String(horas).padStart(2, "0") + String(minutos).padStart(2, "0"));
}

export const LIMITE_MENSAL_MAXIMO_HORAS = 744; // 31 dias x 24h

// Limite mensal da tarefa (LIMMES_TAREFA, em horas inteiras). null/vazio = sem limite.
export function validarLimiteMensal(valor: unknown): Resultado<number | null> {
  if (valor === null || valor === "") return ok(null);

  const numero = typeof valor === "number" ? valor : typeof valor === "string" && /^\d+$/.test(valor.trim()) ? Number(valor.trim()) : NaN;
  if (!Number.isInteger(numero) || numero < 0 || numero > LIMITE_MENSAL_MAXIMO_HORAS) {
    return falha(`Limite mensal: use um número inteiro de horas entre 0 e ${LIMITE_MENSAL_MAXIMO_HORAS} (vazio = sem limite).`);
  }

  return ok(numero);
}

export const HORAS_CONTRATADAS_MAXIMO = 10000;

// Horas contratadas da tarefa (HRREAL_TAREFA): até 2 casas decimais.
export function validarHorasContratadas(valor: unknown): Resultado<number> {
  const texto = typeof valor === "number" ? String(valor) : typeof valor === "string" ? valor.trim().replace(",", ".") : "";
  if (!/^\d+(\.\d{1,2})?$/.test(texto)) return falha("Horas contratadas: use um número com até 2 casas decimais (ex.: 40 ou 12,5).");

  const numero = Number(texto);
  if (numero > HORAS_CONTRATADAS_MAXIMO) return falha(`Horas contratadas: o máximo é ${HORAS_CONTRATADAS_MAXIMO}.`);

  return ok(numero);
}

export type AlteracoesConsultor = { permiteApontarNoPassado?: "SIM" | "NAO"; dataLimite?: string; jornada?: string };
export type AlteracoesTarefa = { permiteExceder?: "SIM" | "NAO"; limiteMensalHoras?: number | null; horasContratadas?: number };

function soCamposConhecidos(corpo: Record<string, unknown>, permitidos: string[]): string | null {
  const estranhos = Object.keys(corpo).filter((c) => !permitidos.includes(c));

  return estranhos.length ? `Campo não permitido: ${estranhos.join(", ")}.` : null;
}

function corpoValido(corpo: unknown): Record<string, unknown> | null {
  return corpo !== null && typeof corpo === "object" && !Array.isArray(corpo) ? (corpo as Record<string, unknown>) : null;
}

export function validarAlteracoesConsultor(corpo: unknown, hoje: string): Resultado<AlteracoesConsultor> {
  const c = corpoValido(corpo);
  if (!c) return falha("Corpo da requisição inválido.");

  const estranho = soCamposConhecidos(c, ["permiteApontarNoPassado", "dataLimite", "jornada"]);
  if (estranho) return falha(estranho);

  const valores: AlteracoesConsultor = {};

  if ("permiteApontarNoPassado" in c) {
    const r = validarSimNao(c.permiteApontarNoPassado, "Apontar no passado");
    if (!r.ok) return r;
    valores.permiteApontarNoPassado = r.valor;
  }
  if ("dataLimite" in c) {
    const r = validarDataLimite(c.dataLimite, hoje);
    if (!r.ok) return r;
    valores.dataLimite = r.valor;
  }
  if ("jornada" in c) {
    const r = validarJornada(c.jornada);
    if (!r.ok) return r;
    valores.jornada = r.valor;
  }

  return Object.keys(valores).length ? ok(valores) : falha("Nenhuma alteração informada.");
}

export function validarAlteracoesTarefa(corpo: unknown): Resultado<AlteracoesTarefa> {
  const c = corpoValido(corpo);
  if (!c) return falha("Corpo da requisição inválido.");

  const estranho = soCamposConhecidos(c, ["permiteExceder", "limiteMensalHoras", "horasContratadas"]);
  if (estranho) return falha(estranho);

  const valores: AlteracoesTarefa = {};

  if ("permiteExceder" in c) {
    const r = validarSimNao(c.permiteExceder, "Liberar estouro do limite");
    if (!r.ok) return r;
    valores.permiteExceder = r.valor;
  }
  if ("limiteMensalHoras" in c) {
    const r = validarLimiteMensal(c.limiteMensalHoras);
    if (!r.ok) return r;
    valores.limiteMensalHoras = r.valor;
  }
  if ("horasContratadas" in c) {
    const r = validarHorasContratadas(c.horasContratadas);
    if (!r.ok) return r;
    valores.horasContratadas = r.valor;
  }

  return Object.keys(valores).length ? ok(valores) : falha("Nenhuma alteração informada.");
}

// Código numérico de consultor/tarefa vindo da URL (nunca texto livre).
export function validarCodigo(valor: unknown, rotulo: string): Resultado<number> {
  const texto = String(valor ?? "").trim();
  if (!/^\d{1,9}$/.test(texto)) return falha(`${rotulo} inválido.`);

  return ok(Number(texto));
}
