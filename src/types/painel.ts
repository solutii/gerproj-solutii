import type { ItemTempo, MinutosPorDia } from "@/utils/painel/agregacoes";
import type { ResumoMes } from "@/utils/painel/resumo";
import type { Projecao } from "@/utils/painel/projecao";
import type { ResumoSla } from "@/utils/painel/sla";

export type ChamadoParado = {
  codChamado: number;
  assunto: string;
  cliente: string;
  status: string;
  diasParado: number;
};

export type TarefaEmAlerta = {
  codTarefa: number;
  nome: string;
  cliente: string;
  situacao: "bloqueada" | "no-limite";
  // % do limite mensal consumido (só em "no-limite")
  percentual: number | null;
  consumoMesMin: number;
  limiteMensalHoras: number | null;
  // tarefa da aba Tarefas (dá para selecionar direto na tela)
  naAbaTarefas: boolean;
};

export type OsContestada = {
  codOs: number;
  data: string;
  minutos: number;
  cliente: string;
};

export type EvolucaoMes = {
  mes: string;
  rotulo: string;
  minutos: number;
  metaMin: number;
};

export type Avaliacao = {
  codChamado: number;
  nota: number;
  assunto: string;
  comentario: string;
};

// Resposta de GET /api/painel?mes=AAAA-MM
export type PainelResposta = {
  mes: string;
  nomeMes: string;
  // hoje (Brasília) e se o mês pedido é o corrente
  hoje: string;
  ehMesAtual: boolean;
  jornadaDiariaMin: number;
  // primeira data em que o consultor pode apontar
  apontarAPartirDe: string;
  resumo: ResumoMes;
  // só no mês corrente
  projecao: Projecao | null;
  hojeBloco: BlocoHoje;
  chamados: BlocoChamados;
  tarefasAndamento: TarefaAndamento[];
  comparacao: Comparacao;
  pendencias: {
    chamadosParados: ChamadoParado[];
    tarefas: TarefaEmAlerta[];
    osContestadas: OsContestada[];
  };
  tempo: {
    porDia: MinutosPorDia[];
    porCliente: ItemTempo[];
    porTarefa: ItemTempo[];
    porClassificacao: ItemTempo[];
    evolucao: EvolucaoMes[];
  };
  resultado: {
    sla: ResumoSla;
    faturamento: {
      faturavelMin: number;
      naoFaturavelMin: number;
      faturadoMin: number;
    };
    avaliacoes: {
      quantidade: number;
      media: number | null;
      ultimas: Avaliacao[];
    };
  };
};

// ─── Blocos acrescentados na 2ª etapa do painel ────────────────────────────

export type HorarioLivre = { inicio: string; fim: string; minutos: number };

export type OsDeHoje = {
  codOs: number;
  inicio: string;
  fim: string;
  minutos: number;
  cliente: string;
  tarefa: string;
};

// "Hoje": o que já foi lançado e onde ainda cabe apontamento (independe do mês exibido)
export type BlocoHoje = {
  data: string;
  ehDiaUtil: boolean;
  agora: string; // "HH:MM" em Brasília
  osDeHoje: OsDeHoje[];
  minutosHoje: number;
  // quanto falta para completar a jornada do dia (0 se já completou)
  faltaJornadaMin: number;
  livres: HorarioLivre[];
};

export type ChamadoAberto = {
  codChamado: number;
  assunto: string;
  cliente: string;
  status: string;
  diasAberto: number;
};

export type ChamadoAguardando = {
  codChamado: number;
  assunto: string;
  cliente: string;
  diasAguardando: number;
};

export type BlocoChamados = {
  porStatus: { status: string; quantidade: number }[];
  maisAntigos: ChamadoAberto[];
  aguardandoValidacao: ChamadoAguardando[];
};

export type TarefaAndamento = {
  codTarefa: number;
  nome: string;
  cliente: string;
  // horas estimadas da tarefa (null = sem estimativa)
  horasEstimadas: number | null;
  // horas lançadas na tarefa por todos os consultores, desde o início
  lancadoMin: number;
  percentual: number | null;
  prazo: string | null; // "AAAA-MM-DD"
  // dias até o prazo (negativo = vencido há N dias)
  diasParaPrazo: number | null;
};

export type Comparacao = {
  mesAnterior: string;
  nomeMesAnterior: string;
  // true = mês em andamento comparado ao MESMO ponto do mês anterior
  mesmoPeriodo: boolean;
  horas: { atualMin: number; anteriorMin: number; variacao: number | null };
  os: { atual: number; anterior: number; variacao: number | null };
  sla: { atualPercentual: number | null; anteriorPercentual: number | null };
};
