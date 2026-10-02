// "Repetir apontamento": a partir de uma OS já lançada, descobre onde o novo
// apontamento deve ser feito -- no chamado (StandBy) ou na tarefa -- e com que
// descrição. Só decide; quem abre o modal é homeActions.

type OsParaRepetir = {
  OBS?: string | null;
  CHAMADO_OS?: string | number | null;
  CODTRF_OS?: string | number | null;
};

type ComCodigo<K extends string> = { [P in K]: number | string };

export type DestinoDoApontamento<C, T> =
  | { tipo: "chamado"; chamado: C; descricao: string }
  | { tipo: "tarefa"; tarefa: T; descricao: string }
  | { tipo: "indisponivel"; motivo: string };

const texto = (valor: string | number | null | undefined) => String(valor ?? "").trim();

// OS de chamado -> StandBy do chamado (precisa estar na lista de chamados do
// consultor); OS de tarefa -> apontamento na tarefa (precisa estar na lista de tarefas).
export function destinoParaRepetir<C extends ComCodigo<"COD_CHAMADO">, T extends ComCodigo<"COD_TAREFA">>(
  os: OsParaRepetir,
  chamados: C[],
  tarefas: T[],
): DestinoDoApontamento<C, T> {
  const descricao = texto(os.OBS);
  const codChamado = texto(os.CHAMADO_OS);

  if (codChamado) {
    const chamado = chamados.find((c) => texto(c.COD_CHAMADO) === codChamado);

    return chamado
      ? { tipo: "chamado", chamado, descricao }
      : { tipo: "indisponivel", motivo: `O chamado #${codChamado} não está mais na sua lista de chamados (finalizado ou reatribuído).` };
  }

  const codTarefa = texto(os.CODTRF_OS);
  const tarefa = tarefas.find((t) => texto(t.COD_TAREFA) === codTarefa);

  return tarefa
    ? { tipo: "tarefa", tarefa, descricao }
    : { tipo: "indisponivel", motivo: "A tarefa desta OS não está mais na sua lista de tarefas." };
}
