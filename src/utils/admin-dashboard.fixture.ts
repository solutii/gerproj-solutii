import type { ConsultorNoDashboard, DashboardResposta } from "@/types/admin-dashboard";

// Dados de exemplo (outubro/2026, dia 02) para os testes do dashboard do administrador.
export function consultorBase(sobrescrever: Partial<ConsultorNoDashboard> = {}): ConsultorNoDashboard {
  return {
    codigo: 1,
    nome: "ANA SOUZA",
    jornadaDiariaMin: 528,
    horasMin: 5280,
    metaMesMin: 11088,
    metaAteHojeMin: 5280,
    percentualMeta: 48,
    percentualMetaAteHoje: 100,
    horasMesAnteriorMin: 4752,
    variacao: 11,
    osQtd: 30,
    diasBateuJornada: 9,
    diasUteisPassados: 10,
    diasSemApontamento: ["2026-10-01"],
    chamadosAtendidos: 12,
    chamadosAbertos: 3,
    chamadosFinalizados: 8,
    sla: { total: 8, noPrazo: 6, percentualNoPrazo: 75, tempoMedioHoras: 5.5 },
    lancamentosAtrasados: 2,
    lancamentosComData: 30,
    ...sobrescrever,
  };
}

export function dashboardBase(sobrescrever: Partial<DashboardResposta> = {}): DashboardResposta {
  return {
    mes: "2026-10",
    nomeMes: "outubro de 2026",
    hoje: "2026-10-02",
    ehMesAtual: true,
    geradoEm: "2026-10-02T15:00:00.000Z",
    visao: {
      consultoresAtivos: 2,
      horasMin: 10560,
      metaMesMin: 22176,
      metaAteHojeMin: 10560,
      percentualMeta: 48,
      horasMesAnteriorMin: 9504,
      variacao: 11,
      consultoresComPendencia: 1,
      chamadosAbertos: 20,
      chamadosParados: 4,
      chamadosFinalizadosNoMes: 15,
      tarefasEmRisco: 1,
      tarefasComEstouroLiberado: 1,
    },
    consultores: [consultorBase(), consultorBase({ codigo: 2, nome: "BRUNO LIMA", horasMin: 5280, percentualMeta: 48, diasSemApontamento: [] })],
    tarefas: {
      emRisco: [
        {
          tarefa: { codigo: 7, nome: "MIGRACAO", cliente: "CLIENTE A", responsavel: "ANA SOUZA", status: 2, statusTexto: "Desenvolvimento", permiteExceder: false, limiteMensalHoras: 10, horasContratadas: 40 },
          situacao: "estourada",
          consumoMesMin: 660,
          percentual: 110,
          passouDoLimite: true,
        },
      ],
      comEstouroLiberado: [
        {
          tarefa: { codigo: 8, nome: "SUPORTE", cliente: "CLIENTE B", responsavel: "BRUNO LIMA", status: 2, statusTexto: "Desenvolvimento", permiteExceder: true, limiteMensalHoras: null, horasContratadas: 0 },
          situacao: "liberada",
          consumoMesMin: 120,
          percentual: null,
          passouDoLimite: false,
        },
      ],
    },
    chamados: {
      abertosPorStatus: [{ status: "ATRIBUIDO", quantidade: 12 }, { status: "STANDBY", quantidade: 8 }],
      abertos: Array.from({ length: 20 }, (_, i) => ({
        codChamado: 15000 + i,
        assunto: `Assunto do chamado ${i + 1}`,
        cliente: i % 2 === 0 ? "CLIENTE A" : "CLIENTE B",
        consultor: i % 3 === 0 ? "ANA SOUZA" : "BRUNO LIMA",
        status: i < 12 ? "ATRIBUIDO" : "STANDBY",
      })),
      parados: [{ codChamado: 15001, assunto: "Erro na nota", cliente: "CLIENTE A", consultor: "ANA SOUZA", status: "STANDBY", diasParado: 21 }],
      totalParados: 4,
      porCliente: [{ chave: "5", rotulo: "CLIENTE A", quantidade: 9 }],
      porArea: [{ chave: "sem", rotulo: "Sem área", quantidade: 9 }],
      semanas: [{ inicio: "2026-09-28", fim: "2026-10-04", rotulo: "28/09", abertos: 3, concluidos: 2 }],
    },
    qualidade: {
      diasSemApontamento: [{ codigo: 1, nome: "ANA SOUZA", quantidade: 1, dias: ["2026-10-01"] }],
      permissoesAntigas: [{ codigo: 2, nome: "BRUNO LIMA", dataLimite: "2026-08-01", diasDesdeLimite: 62 }],
      lancamentosAtrasados: [{ codigo: 1, nome: "ANA SOUZA", atrasados: 2, total: 30, percentual: 7 }],
    },
    ...sobrescrever,
  };
}
