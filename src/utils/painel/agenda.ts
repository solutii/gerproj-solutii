import { hhmmParaMinutos } from "./horas";

// Intervalo em minutos desde 00:00 (ex.: 9h-12h = { inicio: 540, fim: 720 }).
export type Intervalo = { inicio: number; fim: number };

// Janela em que se costuma apontar (mesmo expediente do SLA: 8h às 18h).
export const JANELA_APONTAMENTO: Intervalo = { inicio: 8 * 60, fim: 18 * 60 };

// Os selects do modal de apontamento são de meia em meia hora.
export const PASSO_MINUTOS = 30;

// OS do dia (HRINI/HRFIM "HHMM") -> intervalos ocupados; ignora OS inválida.
export function intervalosDasOs(
  os: { HRINI_OS: string | null; HRFIM_OS: string | null }[],
): Intervalo[] {
  return os
    .map((o) => ({ inicio: hhmmParaMinutos(o.HRINI_OS), fim: hhmmParaMinutos(o.HRFIM_OS) }))
    .filter((i) => i.fim > i.inicio);
}

// "hh:mm" a partir de minutos (540 -> "09:00").
export function minutosParaHHMM(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

// Horários livres do dia, já na grade de 30 minutos do modal de apontamento.
// - Só vai até o "agora" (não dá para apontar horas que ainda não aconteceram)
//   e até o fim da janela.
// - `minimo`: descarta lacunas menores que isso.
export function horariosLivres(
  ocupados: Intervalo[],
  agoraMin: number,
  janela: Intervalo = JANELA_APONTAMENTO,
  passo: number = PASSO_MINUTOS,
  minimo: number = PASSO_MINUTOS,
): Intervalo[] {
  const limite = Math.min(janela.fim, Math.floor(agoraMin / passo) * passo);
  if (limite <= janela.inicio) return [];

  const ordenados = [...ocupados].sort((a, b) => a.inicio - b.inicio);
  const livres: Intervalo[] = [];
  let cursor = janela.inicio;

  const fecharLacuna = (de: number, ate: number) => {
    const inicio = Math.ceil(de / passo) * passo;
    const fim = Math.floor(ate / passo) * passo;

    if (fim - inicio >= minimo) livres.push({ inicio, fim });
  };

  for (const o of ordenados) {
    if (o.inicio > cursor) fecharLacuna(cursor, Math.min(o.inicio, limite));
    cursor = Math.max(cursor, o.fim);
    if (cursor >= limite) break;
  }

  if (cursor < limite) fecharLacuna(cursor, limite);

  return livres;
}
