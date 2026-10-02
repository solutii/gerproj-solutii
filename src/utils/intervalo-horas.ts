import { formatarHoras } from "./painel/horas";

// Intervalo de um apontamento: a hora final precisa ser maior que a inicial
// (horas "HH:MM"; inicial igual à final, ou maior, é inválido).
export function intervaloInvalido(startTime: string, endTime: string): boolean {
  return startTime >= endTime;
}

export const MENSAGEM_INTERVALO_INVALIDO =
  "A hora final precisa ser maior que a hora inicial.";

// Acima disso o usuário precisa confirmar (não trava o apontamento).
export const LIMITE_CONFIRMACAO_MINUTOS = 7 * 60;

// Duração em minutos entre duas horas "HH:MM" (0 se algum campo estiver vazio).
export function duracaoEmMinutos(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;

  const [hi, mi] = startTime.split(":").map(Number);
  const [hf, mf] = endTime.split(":").map(Number);

  return hf * 60 + mf - (hi * 60 + mi);
}

// 510 -> "8hs:30min", 480 -> "8hs:00min", 90 -> "1h:30min" (mesmo formato do painel)
export function formatarDuracao(minutos: number): string {
  return formatarHoras(minutos);
}

// Mensagem do "Confirmar" do modal: se o lançamento passa de 7 horas, avisa
// antes pra pessoa ter certeza -- só avisa, não impede de gravar.
export function mensagemConfirmacaoApontamento(
  mensagemBase: string,
  startTime: string,
  endTime: string,
): string {
  const minutos = duracaoEmMinutos(startTime, endTime);

  if (minutos <= LIMITE_CONFIRMACAO_MINUTOS) return mensagemBase;

  return `Atenção: este apontamento tem ${formatarDuracao(minutos)} (mais de 7 horas). Tem certeza de que está correto? ${mensagemBase}`;
}
