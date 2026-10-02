import { diasDoMes } from "./dias-uteis";

export type MinutosPorDia = { data: string; minutos: number };

// Soma por dia e devolve TODOS os dias do mês (dia sem OS = 0 minutos).
export function minutosPorDia(
  mes: string,
  itens: { data: string; minutos: number }[],
): MinutosPorDia[] {
  const soma = new Map<string, number>();

  for (const i of itens) soma.set(i.data, (soma.get(i.data) ?? 0) + i.minutos);

  return diasDoMes(mes).map((data) => ({ data, minutos: soma.get(data) ?? 0 }));
}

export type ItemTempo = { chave: string; rotulo: string; minutos: number };

// Soma por chave (cliente, tarefa, classificação...), ordenado do maior pro menor.
export function somarPorChave<T>(
  itens: T[],
  chave: (item: T) => string,
  rotulo: (item: T) => string,
  minutos: (item: T) => number,
): ItemTempo[] {
  const mapa = new Map<string, ItemTempo>();

  for (const item of itens) {
    const k = chave(item);
    const atual = mapa.get(k);

    if (atual) atual.minutos += minutos(item);
    else mapa.set(k, { chave: k, rotulo: rotulo(item), minutos: minutos(item) });
  }

  return [...mapa.values()].sort((a, b) => b.minutos - a.minutos);
}

// Mantém os `topN` maiores e junta o resto em "Outros" (só se sobrar algo).
export function topComOutros(itens: ItemTempo[], topN: number): ItemTempo[] {
  if (itens.length <= topN) return itens;

  const resto = itens.slice(topN).reduce((s, i) => s + i.minutos, 0);

  return [...itens.slice(0, topN), { chave: "__outros__", rotulo: "Outros", minutos: resto }];
}
