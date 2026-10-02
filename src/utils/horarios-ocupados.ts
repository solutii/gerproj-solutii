// Horários já ocupados por outras OS do consultor no dia -- mesma regra que o
// servidor aplica ao gravar (ver horariosSeSobrepoem em regras-apontamento):
// dois intervalos se sobrepõem quando um começa antes de o outro terminar;
// encostar (09:00-10:00 e 10:00-11:00) NÃO conta.

export type IntervaloOcupado = {
  codOs: number | string;
  inicio: string; // "HH:MM"
  fim: string; // "HH:MM"
};

type OsDoDia = { COD_OS: number | string; HRINI_OS: string | null; HRFIM_OS: string | null };

const hhmm = (valor: string) => `${valor.slice(0, 2)}:${valor.slice(2, 4)}`;

// OS do dia (horas em "HHMM", como vêm do banco) -> intervalos "HH:MM".
// Na edição, a própria OS não conta (`ignorarCodOs`).
export function intervalosOcupados(lista: OsDoDia[], ignorarCodOs?: number | string | null): IntervaloOcupado[] {
  return lista
    .filter((os) => os.HRINI_OS && os.HRFIM_OS)
    .filter((os) => ignorarCodOs == null || String(os.COD_OS) !== String(ignorarCodOs))
    .map((os) => ({ codOs: os.COD_OS, inicio: hhmm(os.HRINI_OS!), fim: hhmm(os.HRFIM_OS!) }))
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}

// Primeiro intervalo que conflita com [inicial, final); null se livre ou se
// ainda falta escolher algum horário.
export function conflitoDoIntervalo(
  inicial: string,
  final: string,
  ocupados: IntervaloOcupado[],
): IntervaloOcupado | null {
  if (!inicial || !final) return null;

  return ocupados.find((o) => o.inicio < final && o.fim > inicial) ?? null;
}

// Hora INICIAL: ocupada quando cai dentro de um intervalo (começar exatamente
// quando outro termina é permitido).
export function horaInicialOcupada(hora: string, ocupados: IntervaloOcupado[]): boolean {
  return ocupados.some((o) => o.inicio <= hora && hora < o.fim);
}

// Hora FINAL: indisponível quando, junto da inicial escolhida, o intervalo
// passaria a atravessar outra OS. Sem inicial escolhida, nada é bloqueado.
export function horaFinalIndisponivel(hora: string, inicial: string, ocupados: IntervaloOcupado[]): boolean {
  if (!inicial) return false;

  return conflitoDoIntervalo(inicial, hora, ocupados) !== null;
}

export function textoDoConflito(c: IntervaloOcupado): string {
  return `Conflito de horário: você já tem a OS #${c.codOs} das ${c.inicio} às ${c.fim} nesta data.`;
}
