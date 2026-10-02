import type { AlvoOs } from "@/lib/api-home";

type Recurso = number | string | undefined;

// Chaves do cache. O consultor (recurso) entra em todas: dado de um consultor
// nunca é reaproveitado para outro. A primeira posição é o "grupo", usado para
// invalidar tudo de um assunto de uma vez (ex.: ["os"] = todas as listas de OS).
export const chaves = {
  chamados: (recurso: Recurso) => ["chamados", recurso] as const,
  tarefas: (recurso: Recurso) => ["tarefas", recurso] as const,
  os: (recurso: Recurso, alvo: AlvoOs | null) => ["os", recurso, alvo] as const,
  periodo: (recurso: Recurso) => ["periodo", recurso] as const,
  areas: (recurso: Recurso) => ["areas", recurso] as const,
  painel: (recurso: Recurso, mes: string) => ["painel", "dados", recurso, mes] as const,
  pendentes: (recurso: Recurso) => ["painel", "pendentes", recurso] as const,
};

// Grupos (prefixos) para invalidar.
export const grupos = {
  chamados: ["chamados"] as const,
  os: ["os"] as const,
  periodo: ["periodo"] as const,
  areas: ["areas"] as const,
  // painel inteiro: dados do mês + dias pendentes
  painel: ["painel"] as const,
};
