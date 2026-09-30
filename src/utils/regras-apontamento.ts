// Partes puras (sem banco) das regras de apontamento aplicadas no servidor.

const pad = (n: number) => String(n).padStart(2, "0");

// Date -> "YYYY-MM-DD" pelas partes locais (o driver do Firebird devolve as
// colunas DATE como Date à meia-noite local). Strings só têm o dia extraído.
export function dataLocalISO(data: Date | string): string {
  if (typeof data === "string") return data.slice(0, 10);

  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`;
}

// "YYYY-MM-DD" -> dia anterior, também "YYYY-MM-DD".
export function diaAnterior(dataISO: string): string {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia - 1));

  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// Mesma regra da tela (getLimitDate): quem tem PERMAPO_RECURSO = "SIM" pode
// apontar desde o DTLIMITE_RECURSO; os demais só de ontem em diante.
export function dataMinimaPermitida(
  permiteRetroativo: boolean,
  dtLimite: Date | string | null | undefined,
  hoje: string,
): string {
  if (permiteRetroativo && dtLimite) return dataLocalISO(dtLimite);

  return diaAnterior(hoje);
}

// Dois intervalos do mesmo dia se sobrepõem quando um começa antes de o outro
// terminar (encostar -- 09:00-10:00 e 10:00-11:00 -- não conta).
// Existente em "HHMM" (como vem do banco); novo em "HH:MM".
export function horariosSeSobrepoem(
  iniExistente: string,
  fimExistente: string,
  startTime: string,
  endTime: string,
): boolean {
  const ini = iniExistente.slice(0, 2) + ":" + iniExistente.slice(2, 4);
  const fim = fimExistente.slice(0, 2) + ":" + fimExistente.slice(2, 4);

  return ini < endTime && fim > startTime;
}

export function formatarHoraBanco(hhmm: string): string {
  return hhmm.slice(0, 2) + ":" + hhmm.slice(2, 4);
}
