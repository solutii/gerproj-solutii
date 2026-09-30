// Descrição do apontamento: mínimo de caracteres (sem contar espaços nas pontas).
export const DESCRICAO_MINIMA = 50;

export function descricaoInvalida(descricao: string | null | undefined): boolean {
  return (descricao ?? "").trim().length < DESCRICAO_MINIMA;
}

export const MENSAGEM_DESCRICAO = `A descrição do apontamento precisa ter no mínimo ${DESCRICAO_MINIMA} caracteres.`;
