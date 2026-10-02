// Formatos trocados entre as rotas /api/admin e a página /admin.

export type ConsultorAdmin = {
  codigo: number;
  nome: string;
  ativo: boolean;
  // RECURSO.PERMAPO_RECURSO = "SIM": pode apontar antes de ontem, a partir da data-limite
  permiteApontarNoPassado: boolean;
  // RECURSO.DTLIMITE_RECURSO: "AAAA-MM-DD" (null se não cadastrada)
  dataLimite: string | null;
  // RECURSO.HRDIA_RECURSO: "HH:MM" (jornada diária; base da meta do Meu Painel)
  jornada: string;
};

export type TarefaAdmin = {
  codigo: number;
  nome: string;
  cliente: string;
  responsavel: string;
  status: number;
  statusTexto: string;
  // TAREFA.PERIMP_TAREFA = "SIM": pode estourar o limite de horas
  permiteExceder: boolean;
  // TAREFA.LIMMES_TAREFA (horas, usado no StandBy do chamado); null = sem limite
  limiteMensalHoras: number | null;
  // TAREFA.HRREAL_TAREFA (horas, usado no apontamento em tarefa)
  horasContratadas: number | null;
};

export type ListaDeTarefas = {
  tarefas: TarefaAdmin[];
  total: number;
  pagina: number;
  porPagina: number;
};

export type AlteracaoConsultor = {
  permiteApontarNoPassado?: boolean;
  dataLimite?: string;
  jornada?: string;
};

export type AlteracaoTarefa = {
  permiteExceder?: boolean;
  limiteMensalHoras?: number | null;
  // número ou texto digitado ("12,5"): o servidor valida e converte
  horasContratadas?: number | string;
};

// Resposta de PATCH: o registro como ficou e se algo mudou de fato
export type ResultadoAlteracao<T> = { registro: T; alterou: boolean };

// ─── Histórico (arquivo de auditoria) ───────────────────────────────────────

export type AtorAdmin = { codUsuario: number; nome: string; login: string; ip: string };

export type RegistroDeHistorico = {
  hash: string;
  ts: string; // ISO (UTC)
  ator: AtorAdmin;
  acao: string;
  alvo: { tipo: "consultor" | "tarefa"; codigo: number; nome: string };
  antes: Record<string, unknown>;
  depois: Record<string, unknown>;
  // "confirmada": gravação confirmada no banco; "falhou": não foi aplicada;
  // "nao-confirmada": sem desfecho registrado (ex.: o sistema parou no meio)
  situacao: "confirmada" | "falhou" | "nao-confirmada";
  erro?: string;
};

export type ProblemaDeIntegridade = { arquivo: string; linha: number; motivo: string };

export type HistoricoResposta = {
  mes: string;
  registros: RegistroDeHistorico[];
  integridade: { ok: boolean; problemas: ProblemaDeIntegridade[] };
  mesesDisponiveis: string[];
};
