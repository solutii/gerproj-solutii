// Aviso de "chegou chamado novo": compara os chamados atuais com os já vistos
// nesta sessão da tela. A primeira lista carregada é só a base (não avisa).

export function chamadosNovos<T extends { COD_CHAMADO: number }>(
  conhecidos: ReadonlySet<number>,
  atuais: T[],
): T[] {
  return atuais.filter((c) => !conhecidos.has(c.COD_CHAMADO));
}

export function textoChamadosNovos(novos: { COD_CHAMADO: number }[]): string {
  const codigos = novos.slice(0, 3).map((c) => `#${c.COD_CHAMADO}`).join(", ");
  const resto = novos.length - 3;

  if (novos.length === 1) return `Chegou um chamado novo para você: ${codigos}.`;

  return `Chegaram ${novos.length} chamados novos para você: ${codigos}${resto > 0 ? ` e mais ${resto}` : ""}.`;
}
