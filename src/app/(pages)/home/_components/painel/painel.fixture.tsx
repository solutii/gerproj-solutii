import { act } from "react";
import type { ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PainelResposta } from "@/types/painel";

// Painel de exemplo (outubro/2026, dia 02, 10h30) para os testes de tela.
export function painelBase(sobrescrever: Partial<PainelResposta> = {}): PainelResposta {
  return {
    mes: "2026-10",
    nomeMes: "outubro de 2026",
    hoje: "2026-10-02",
    ehMesAtual: true,
    jornadaDiariaMin: 528,
    apontarAPartirDe: "2026-09-25",
    resumo: {
      horasApontadasMin: 528,
      metaMesMin: 11088,
      metaAteHojeMin: 1056,
      diasUteis: 21,
      diasUteisAteHoje: 2,
      diasSemApontamento: ["2026-09-30", "2026-10-01"],
      percentualMeta: 5,
      percentualMetaAteHoje: 50,
      saldoAteHojeMin: -528,
    },
    projecao: {
      diasDecorridos: 1,
      diasRestantes: 20,
      mediaDiariaMin: 528,
      projecaoMesMin: 11088,
      faltaParaMetaMin: 10560,
      necessarioPorDiaMin: 528,
      situacao: "no-ritmo",
    },
    hojeBloco: {
      data: "2026-10-02",
      ehDiaUtil: true,
      agora: "10:30",
      osDeHoje: [{ codOs: 1, inicio: "08:00", fim: "09:00", minutos: 60, cliente: "Cliente A", tarefa: "Tarefa X" }],
      minutosHoje: 60,
      faltaJornadaMin: 468,
      livres: [{ inicio: "09:00", fim: "10:30", minutos: 90 }],
    },
    chamados: {
      porStatus: [
        { status: "ATRIBUIDO", quantidade: 1 },
        { status: "STANDBY", quantidade: 2 },
      ],
      maisAntigos: [{ codChamado: 100, assunto: "Erro no relatório", cliente: "Cliente A", status: "STANDBY", diasAberto: 30 }],
      aguardandoValidacao: [{ codChamado: 200, assunto: "Ajuste de NF", cliente: "Cliente B", diasAguardando: 5 }],
    },
    tarefasAndamento: [
      { codTarefa: 10, nome: "Migração", cliente: "Cliente A", horasEstimadas: 40, lancadoMin: 1800, percentual: 75, prazo: "2026-12-31", diasParaPrazo: 90 },
      { codTarefa: 11, nome: "Estourada", cliente: "Cliente B", horasEstimadas: 10, lancadoMin: 1200, percentual: 200, prazo: "2026-05-31", diasParaPrazo: -124 },
      { codTarefa: 12, nome: "Sem estimativa", cliente: "Cliente C", horasEstimadas: null, lancadoMin: 120, percentual: null, prazo: null, diasParaPrazo: null },
    ],
    comparacao: {
      mesAnterior: "2026-09",
      nomeMesAnterior: "setembro de 2026",
      mesmoPeriodo: true,
      horas: { atualMin: 600, anteriorMin: 480, variacao: 25 },
      os: { atual: 3, anterior: 4, variacao: -25 },
      sla: { atualPercentual: 90, anteriorPercentual: 80 },
    },
    pendencias: {
      chamadosParados: [{ codChamado: 300, assunto: "Parado", cliente: "Cliente D", status: "STANDBY", diasParado: 12 }],
      tarefas: [
        { codTarefa: 10, nome: "Migração", cliente: "Cliente A", situacao: "no-limite", percentual: 90, consumoMesMin: 540, limiteMensalHoras: 10, naAbaTarefas: true },
        { codTarefa: 99, nome: "Fora da aba", cliente: "Cliente Z", situacao: "bloqueada", percentual: null, consumoMesMin: 0, limiteMensalHoras: 0, naAbaTarefas: false },
      ],
      osContestadas: [{ codOs: 7, data: "2026-10-01", minutos: 90, cliente: "Cliente A" }],
    },
    tempo: { porDia: [], porCliente: [], porTarefa: [], porClassificacao: [], evolucao: [] },
    resultado: {
      sla: { total: 0, noPrazo: 0, foraDoPrazo: 0, percentualNoPrazo: null, tempoMedioHoras: null },
      faturamento: { faturavelMin: 0, naoFaturavelMin: 0, faturadoMin: 0 },
      avaliacoes: { quantidade: 0, media: null, ultimas: [] },
    },
    ...sobrescrever,
  };
}

// Renderização mínima (sem biblioteca extra): monta num div e devolve helpers.
// Cada tela de teste ganha um cache do Query novo (sem repetição em erro, para
// o teste não esperar tentativas).
export function clienteDeTeste() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
}

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export function montar(elemento: ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const raiz: Root = createRoot(container);

  const cliente = clienteDeTeste();

  act(() => raiz.render(<QueryClientProvider client={cliente}>{elemento}</QueryClientProvider>));

  return {
    container,
    cliente,
    // botão pelo nome acessível (aria-label ou texto)
    botao(nome: string | RegExp) {
      const achados = Array.from(container.querySelectorAll("button")).filter((b) => {
        const rotulo = b.getAttribute("aria-label") ?? b.textContent ?? "";

        return typeof nome === "string" ? rotulo.includes(nome) : nome.test(rotulo);
      });

      return achados[0] as HTMLButtonElement | undefined;
    },
    clicar(botao: HTMLElement | undefined) {
      if (!botao) throw new Error("botão não encontrado");
      act(() => {
        botao.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
    },
    texto: () => container.textContent ?? "",
    desmontar() {
      act(() => raiz.unmount());
      cliente.clear();
      container.remove();
    },
  };
}
