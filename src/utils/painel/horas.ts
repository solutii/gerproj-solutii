// Conversões de hora usadas pelo painel. O banco guarda horas como texto "HHMM"
// (ex.: HRINI_OS "0830", HRDIA_RECURSO "0848"); a tela usa "HH:MM".

// "0848" ou "08:48" -> minutos desde 00:00 (528). Valor inválido -> 0.
export function hhmmParaMinutos(valor: string | null | undefined): number {
  const limpo = String(valor ?? "").trim().replace(":", "");

  if (!/^\d{3,4}$/.test(limpo)) return 0;

  const texto = limpo.padStart(4, "0");

  return Number(texto.slice(0, 2)) * 60 + Number(texto.slice(2, 4));
}

// Duração de uma OS em minutos (nunca negativa).
export function duracaoOsMinutos(
  horaInicio: string | null | undefined,
  horaFim: string | null | undefined,
): number {
  return Math.max(0, hhmmParaMinutos(horaFim) - hhmmParaMinutos(horaInicio));
}

// Minutos -> horas decimais com 2 casas (528 -> 8.8).
export function minutosParaHoras(minutos: number): number {
  return Math.round((minutos / 60) * 100) / 100;
}

// Minutos -> texto de duração, SEMPRE com horas e minutos: "1h:30min" (1 hora ou menos, "h"),
// "45hs:30min" (mais de 1 hora, "hs"), "8hs:00min", "0h:30min". Horas a partir de 1.000 levam
// separador de milhar: "4.233hs:36min". Usado em todo o sistema (painel, avisos e mensagens).
export function formatarHoras(minutos: number): string {
  const total = Math.max(0, Math.round(minutos));
  const horas = Math.floor(total / 60);
  const resto = total % 60;

  return `${formatarNumero(horas)}${horas <= 1 ? "h" : "hs"}:${String(resto).padStart(2, "0")}min`;
}

const FORMATO_BR = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });

// Número com separador de milhar e vírgula decimal (pt-BR): 4233 -> "4.233"; 12.5 -> "12,5".
// Só para MOSTRAR. Nunca em campo editável, CSV ou valor que volta para o servidor.
export function formatarNumero(valor: number): string {
  return Number.isFinite(valor) ? FORMATO_BR.format(valor) : "";
}
