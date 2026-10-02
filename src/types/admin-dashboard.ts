import type { TarefaAdmin } from "@/types/admin";

// Formato da resposta de GET /api/admin/dashboard (só administrador). Todas as horas
// vão em minutos; datas em "AAAA-MM-DD".

export type ConsultorNoDashboard = {
  codigo: number;
  nome: string;
  jornadaDiariaMin: number;
  horasMin: number;
  metaMesMin: number;
  metaAteHojeMin: number;
  // % da meta do mês inteiro / da meta até hoje (null sem jornada cadastrada)
  percentualMeta: number | null;
  percentualMetaAteHoje: number | null;
  // horas do mês anterior no MESMO ponto do mês (mesmo critério do Meu Painel)
  horasMesAnteriorMin: number;
  variacao: number | null;
  osQtd: number;
  // dias úteis já passados em que bateu a jornada / total de dias úteis já passados
  diasBateuJornada: number;
  diasUteisPassados: number;
  diasSemApontamento: string[];
  chamadosAtendidos: number;
  chamadosAbertos: number;
  chamadosFinalizados: number;
  sla: { total: number; noPrazo: number; percentualNoPrazo: number | null; tempoMedioHoras: number | null };
  lancamentosAtrasados: number;
  lancamentosComData: number;
};

export type VisaoGeral = {
  consultoresAtivos: number;
  horasMin: number;
  metaMesMin: number;
  metaAteHojeMin: number;
  percentualMeta: number | null;
  horasMesAnteriorMin: number;
  variacao: number | null;
  consultoresComPendencia: number;
  chamadosAbertos: number;
  chamadosParados: number;
  chamadosFinalizadosNoMes: number;
  tarefasEmRisco: number;
  tarefasComEstouroLiberado: number;
};

export type SituacaoDaTarefaNoDashboard = "estourada" | "no-limite" | "liberada";

export type TarefaNoDashboard = {
  tarefa: TarefaAdmin;
  situacao: SituacaoDaTarefaNoDashboard;
  consumoMesMin: number;
  // consumo do mês / limite mensal (null sem limite)
  percentual: number | null;
  // com estouro liberado e já acima do limite
  passouDoLimite: boolean;
};

export type ItemDeContagem = { chave: string; rotulo: string; quantidade: number };

export type ChamadoParadoNoDashboard = {
  codChamado: number;
  assunto: string;
  cliente: string;
  consultor: string;
  status: string;
  diasParado: number;
};

export type SemanaDeChamados = { inicio: string; fim: string; rotulo: string; abertos: number; concluidos: number };

// Chamado em aberto (não finalizado), para a lista que abre ao clicar no badge de uma situação.
export type ChamadoAbertoNoDashboard = {
  codChamado: number;
  assunto: string;
  cliente: string;
  consultor: string;
  status: string;
};

export type BlocoDeChamados = {
  abertosPorStatus: { status: string; quantidade: number }[];
  // todos os chamados abertos (a soma por situação é a contagem dos badges)
  abertos: ChamadoAbertoNoDashboard[];
  parados: ChamadoParadoNoDashboard[];
  totalParados: number;
  porCliente: ItemDeContagem[];
  porArea: ItemDeContagem[];
  semanas: SemanaDeChamados[];
};

export type BlocoDeQualidade = {
  diasSemApontamento: { codigo: number; nome: string; quantidade: number; dias: string[] }[];
  permissoesAntigas: { codigo: number; nome: string; dataLimite: string | null; diasDesdeLimite: number | null }[];
  lancamentosAtrasados: { codigo: number; nome: string; atrasados: number; total: number; percentual: number }[];
};

export type DashboardResposta = {
  mes: string;
  nomeMes: string;
  hoje: string;
  ehMesAtual: boolean;
  // momento em que os números foram calculados (ISO, UTC); o servidor guarda por poucos minutos
  geradoEm: string;
  visao: VisaoGeral;
  consultores: ConsultorNoDashboard[];
  tarefas: { emRisco: TarefaNoDashboard[]; comEstouroLiberado: TarefaNoDashboard[] };
  chamados: BlocoDeChamados;
  qualidade: BlocoDeQualidade;
};
