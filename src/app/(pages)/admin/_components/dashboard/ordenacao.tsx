"use client";

import { TbArrowsSort } from "react-icons/tb";
import Tooltip from "@/components/tooltip";

// Ordenação por clique no cabeçalho, igual em todas as tabelas do dashboard:
// crescente -> decrescente -> ordem padrão (a do carregamento).

// Ordem escolhida; nula = ordem padrão.
export type Ordem<C extends string = string> = { coluna: C; crescente: boolean } | null;

// Cada clique na MESMA coluna avança: crescente -> decrescente -> ordem padrão.
// Clicar em outra coluna começa dela, em crescente.
export function proximaOrdem<C extends string>(atual: Ordem<C>, coluna: C): Ordem<C> {
  if (atual?.coluna !== coluna) return { coluna, crescente: true };
  if (atual.crescente) return { coluna, crescente: false };

  return null;
}

export function ariaSort<C extends string>(ordem: Ordem<C>, coluna: C): "ascending" | "descending" | "none" {
  if (ordem?.coluna !== coluna) return "none";

  return ordem.crescente ? "ascending" : "descending";
}

// Ordena uma cópia da lista. Valor ausente (null) vai para o fim, em qualquer sentido;
// o desempate mantém a ordem estável e previsível.
export function ordenarLista<T>(
  lista: T[],
  valor: (item: T) => string | number | null,
  crescente: boolean,
  desempate: (a: T, b: T) => number,
): T[] {
  return [...lista].sort((a, b) => {
    const va = valor(a);
    const vb = valor(b);

    if (va === null && vb === null) return desempate(a, b);
    if (va === null) return 1;
    if (vb === null) return -1;

    const comparacao = typeof va === "string" ? va.localeCompare(String(vb), "pt-BR") : va - (vb as number);

    return (crescente ? comparacao : -comparacao) || desempate(a, b);
  });
}

type BotaoProps<C extends string> = {
  texto: string;
  coluna: C;
  ordem: Ordem<C>;
  onOrdenar: (coluna: C) => void;
  // classes do botão (cada tabela tem o seu cabeçalho: fundo azul no comparativo, claro nas listas)
  className?: string;
};

const CLASSE_PADRAO = "cursor-pointer rounded px-1 font-bold uppercase tracking-wide outline-none hover:underline focus-visible:ring-2 focus-visible:ring-cyan-200";

// Botão do cabeçalho: tooltip "Clique para ordenar"; ▲/▼ na coluna ordenada e um ícone
// neutro nas demais (inclusive na ordem padrão).
export function BotaoDeOrdenar<C extends string>({ texto, coluna, ordem, onOrdenar, className = CLASSE_PADRAO }: BotaoProps<C>) {
  const ativa = ordem?.coluna === coluna;

  return (
    <Tooltip content="Clique para ordenar">
      <button type="button" onClick={() => onOrdenar(coluna)} className={className}>
        {texto}{" "}
        {ativa ? (
          ordem.crescente ? "▲" : "▼"
        ) : (
          <TbArrowsSort aria-hidden data-icone-ordenar="padrao" size={14} className="mb-0.5 inline opacity-60" />
        )}
      </button>
    </Tooltip>
  );
}
