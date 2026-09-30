// Resposta de /api/call/valid-hours e /api/os/valid-hours:
// [limite mensal em minutos, minutos do mês já apontados + o apontamento novo,
// PERIMP_TAREFA ("SIM" = tarefa pode estourar o limite)].
export type RespostaHorasValidas = [number, number, string | null] | unknown[];

// Mensagens de bloqueio (mesmo texto na tela e no servidor).
export const mensagemLimiteMensalTarefa = (limiteMin: number) =>
  `Horas para esta tarefa já ultrapassaram o limite mensal (${limiteMin / 60}h), impossível realizar o apontamento.`;

export const mensagemLimiteMensalChamado = (totalMin: number) =>
  `Horas para esta tarefa já ultrapassaram o limite do mês, total final após apontamento: ${totalMin / 60}h. ENTRE EM CONTATO COM A SOLUTII!`;

// Regra única do bloqueio por estouro de horas, usada na tela e no servidor:
// estoura quando o total passa do limite e a tarefa não permite exceder.
// Limite vazio (NaN) não trava.
//
// `ignorarLimiteZero`: no StandBy o limite é o LIMMES_TAREFA, e 0 ali significa
// "sem limite mensal" (a maioria das tarefas). No apontamento em tarefa o limite
// é o HRREAL_TAREFA, e 0 estoura com qualquer apontamento.
export function estourouLimiteHoras(
  resposta: unknown,
  { ignorarLimiteZero = false }: { ignorarLimiteZero?: boolean } = {},
): boolean {
  if (!Array.isArray(resposta) || resposta.length < 3) return false;

  const [limiteMin, totalMin, permiteExceder] = resposta;

  if (ignorarLimiteZero && limiteMin === 0) return false;

  return (
    limiteMin < totalMin &&
    String(permiteExceder ?? "").trim().toUpperCase() !== "SIM"
  );
}
