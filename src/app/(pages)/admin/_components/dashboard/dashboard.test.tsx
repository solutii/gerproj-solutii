import fs from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, useState } from "react";

const api = vi.hoisted(() => ({
  buscarDashboardAdmin: vi.fn(),
  buscarPainelDoConsultorAdmin: vi.fn(),
  atualizarConsultorAdmin: vi.fn(),
  atualizarTarefaAdmin: vi.fn(),
  buscarConsultoresAdmin: vi.fn(),
  buscarHistoricoAdmin: vi.fn(),
  buscarTarefasAdmin: vi.fn(),
}));
const arquivos = vi.hoisted(() => ({ baixarArquivo: vi.fn(), imprimirHtml: vi.fn() }));

vi.mock("@/lib/api-admin", () => api);
vi.mock("@/utils/baixar", () => arquivos);
// os gráficos do Meu Painel usam canvas, que o jsdom não desenha
vi.mock("@/components/graficos/GraficoDias", () => ({ default: () => null }));
vi.mock("@/components/graficos/GraficoEvolucao", () => ({ default: () => null }));
vi.mock("@/components/graficos/GraficoBarrasHorizontais", () => ({ default: () => null }));

import { painelBase, montar } from "@/app/(pages)/home/_components/painel/painel.fixture";
import Cartao from "@/app/(pages)/home/_components/painel/Cartao";
import ComparacaoDoMeuPainel from "@/app/(pages)/home/_components/painel/Comparacao";
import ResultadoDoMeuPainel from "@/app/(pages)/home/_components/painel/Resultado";
import { dashboardBase, consultorBase } from "@/utils/admin-dashboard.fixture";
import { mesAnterior, mesAtual } from "@/utils/painel/periodo";
import { useDashboardAdmin } from "@/hooks/queries/admin";
import BadgeAtualizacao, { progressoDaBarra } from "./BadgeAtualizacao";
import { ordenarConsultores } from "./ComparativoConsultores";
import { proximaOrdem } from "./ordenacao";
import StatusBadge, { STYLES as CORES_DA_TABELA } from "@/app/(pages)/home/_components/tables/StatusBadge";
import { ordenarAbertos } from "./ListaDaSituacao";
import ChamadosBloco, { corDaSituacao, ordenarParados, ordenarSituacoes, temTodasAsSituacoes } from "./ChamadosBloco";
import ComparativoConsultores from "./ComparativoConsultores";
import DashboardAba from "./DashboardAba";
import QualidadeBloco from "./QualidadeBloco";
import TarefasBloco from "./TarefasBloco";
import VisaoGeral from "./VisaoGeral";

let tela: ReturnType<typeof montar> | null = null;

// botão de ordenar do cabeçalho da tabela de chamados parados, pelo início do texto
const colunaDosParados = (texto: string) =>
  Array.from(tela!.container.querySelectorAll<HTMLButtonElement>("table:not([class*=max-w-sm]) thead button")).find((b) => b.textContent?.trim().startsWith(texto))!;

// O que a página /admin faz: a consulta do dashboard vive no topo, o badge de atualização
// fica no cabeçalho e a aba recebe a consulta.
function PaginaFalsa() {
  const [mes, setMes] = useState(() => mesAtual());
  const dashboard = useDashboardAdmin(mes);

  return (
    <>
      <BadgeAtualizacao
        geradoEm={dashboard.consulta.data?.geradoEm}
        ultimaBuscaEm={dashboard.ultimaBuscaEm}
        atualizando={dashboard.consulta.isFetching || dashboard.atualizar.isPending}
        falhou={(dashboard.consulta.isError || dashboard.atualizar.isError) && !!dashboard.consulta.data}
        onAtualizar={() => dashboard.atualizar.mutate()}
      />
      <DashboardAba mes={mes} onMudarMes={setMes} dashboard={dashboard} />
    </>
  );
}

// deixa o Query concluir a busca e a tela atualizar (várias voltas do laço de eventos)
const aguardar = async () => {
  for (let i = 0; i < 5; i++) await act(async () => new Promise((r) => setTimeout(r, 5)));
};

const dashboardDoMes = (mes = mesAtual()) => dashboardBase({ mes });

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  Object.values(arquivos).forEach((f) => f.mockReset());
  api.buscarDashboardAdmin.mockImplementation(async (mes: string) => dashboardDoMes(mes));
  api.buscarPainelDoConsultorAdmin.mockImplementation(async (codigo: number, mes: string) => ({ consultor: { codigo, nome: "ANA SOUZA" }, painel: painelBase({ mes }) }));
});

afterEach(() => {
  tela?.desmontar();
  tela = null;
  vi.useRealTimers();
});

describe("ordenarConsultores", () => {
  const a = consultorBase({ codigo: 1, nome: "ANA", horasMin: 100, percentualMeta: 50, variacao: null, sla: { total: 0, noPrazo: 0, percentualNoPrazo: null, tempoMedioHoras: null } });
  const b = consultorBase({ codigo: 2, nome: "BRUNO", horasMin: 300, percentualMeta: 90, variacao: 10 });
  const c = consultorBase({ codigo: 3, nome: "CARLA", horasMin: 200, percentualMeta: null, variacao: -5 });

  it("por % da meta: maior primeiro; sem meta (null) vai para o fim nos dois sentidos", () => {
    expect(ordenarConsultores([a, b, c], "percentual", false).map((x) => x.nome)).toEqual(["BRUNO", "ANA", "CARLA"]);
    expect(ordenarConsultores([a, b, c], "percentual", true).map((x) => x.nome)).toEqual(["ANA", "BRUNO", "CARLA"]);
  });

  it("por nome (acentos e maiúsculas à moda pt-BR) e por horas", () => {
    expect(ordenarConsultores([c, b, a], "nome", true).map((x) => x.nome)).toEqual(["ANA", "BRUNO", "CARLA"]);
    expect(ordenarConsultores([a, b, c], "horas", false).map((x) => x.nome)).toEqual(["BRUNO", "CARLA", "ANA"]);
  });

  it("não altera a lista original e desempata pelo nome", () => {
    const lista = [b, a];
    const x = consultorBase({ codigo: 4, nome: "ZELIA", percentualMeta: 50 });

    ordenarConsultores(lista, "nome", true);
    expect(lista.map((i) => i.nome)).toEqual(["BRUNO", "ANA"]);
    expect(ordenarConsultores([x, a], "percentual", false).map((i) => i.nome)).toEqual(["ANA", "ZELIA"]);
  });
});

describe("blocos do dashboard", () => {
  it("VisaoGeral mostra horas, meta, variação e os contadores", () => {
    const d = dashboardBase();
    tela = montar(<VisaoGeral visao={d.visao} nomeMes={d.nomeMes} ehMesAtual />);

    expect(tela.texto()).toContain("176hs:00min");
    expect(tela.texto()).toContain("de 369hs:36min de meta (48%)");
    expect(tela.texto()).toContain("▲ 11%");
    expect(tela.texto()).toContain("4 parados há mais de 7 dias");
    expect(tela.texto()).toContain("1 de 2");
  });

  it("ComparativoConsultores: ordena pelo cabeçalho e abre o consultor pelo nome", () => {
    const aoAbrir = vi.fn();
    const consultores = [consultorBase({ codigo: 2, nome: "BRUNO LIMA", percentualMeta: 30 }), consultorBase({ codigo: 1, nome: "ANA SOUZA", percentualMeta: 80 })];
    tela = montar(<ComparativoConsultores consultores={consultores} ehMesAtual onAbrirConsultor={aoAbrir} />);

    const nomes = () => Array.from(tela!.container.querySelectorAll("tbody tr td:first-child button")).map((b) => b.textContent);
    // padrão: maior % da meta primeiro
    expect(nomes()).toEqual(["ANA SOUZA", "BRUNO LIMA"]);

    tela.clicar(tela.botao("Consultor"));
    expect(nomes()).toEqual(["ANA SOUZA", "BRUNO LIMA"]);
    expect(tela.container.querySelector("th[aria-sort=ascending]")?.textContent).toContain("Consultor");

    tela.clicar(tela.botao("Consultor"));
    expect(nomes()).toEqual(["BRUNO LIMA", "ANA SOUZA"]);
    expect(tela.container.querySelector("th[aria-sort=descending]")?.textContent).toContain("Consultor");

    tela.clicar(tela.botao("BRUNO LIMA"));
    expect(aoAbrir).toHaveBeenCalledWith(2, "BRUNO LIMA");
  });

  it("proximaOrdem: crescente -> decrescente -> padrão; outra coluna começa em crescente", () => {
    expect(proximaOrdem(null, "nome")).toEqual({ coluna: "nome", crescente: true });
    expect(proximaOrdem({ coluna: "nome", crescente: true }, "nome")).toEqual({ coluna: "nome", crescente: false });
    expect(proximaOrdem({ coluna: "nome", crescente: false }, "nome")).toBeNull();
    expect(proximaOrdem({ coluna: "nome", crescente: false }, "horas")).toEqual({ coluna: "horas", crescente: true });
    expect(proximaOrdem({ coluna: "nome", crescente: true }, "percentual")).toEqual({ coluna: "percentual", crescente: true });
  });

  it("ComparativoConsultores: o terceiro clique volta à ordem padrão do carregamento (sem seta nem coluna marcada)", () => {
    // padrão = maior % da meta primeiro; por nome e por % a ordem é diferente
    const consultores = [
      consultorBase({ codigo: 1, nome: "ANA", percentualMeta: 30 }),
      consultorBase({ codigo: 2, nome: "BRUNO", percentualMeta: 90 }),
      consultorBase({ codigo: 3, nome: "CARLA", percentualMeta: 60 }),
    ];
    tela = montar(<ComparativoConsultores consultores={consultores} ehMesAtual onAbrirConsultor={vi.fn()} />);
    const nomes = () => Array.from(tela!.container.querySelectorAll("tbody tr td:first-child button")).map((b) => b.textContent);
    const marcadas = () => tela!.container.querySelectorAll("th[aria-sort=ascending], th[aria-sort=descending]").length;

    // ao carregar: ordem padrão e nenhuma coluna marcada
    expect(nomes()).toEqual(["BRUNO", "CARLA", "ANA"]);
    expect(marcadas()).toBe(0);

    tela.clicar(tela.botao("Consultor")); // crescente
    expect(nomes()).toEqual(["ANA", "BRUNO", "CARLA"]);
    expect(tela.container.querySelector("th[aria-sort=ascending]")?.textContent).toContain("▲");

    tela.clicar(tela.botao("Consultor")); // decrescente
    expect(nomes()).toEqual(["CARLA", "BRUNO", "ANA"]);
    expect(tela.container.querySelector("th[aria-sort=descending]")?.textContent).toContain("▼");

    tela.clicar(tela.botao("Consultor")); // padrão
    expect(nomes()).toEqual(["BRUNO", "CARLA", "ANA"]);
    expect(marcadas()).toBe(0);
    expect(tela.container.querySelector("thead")?.textContent).not.toMatch(/[▲▼]/);

    // e o ciclo recomeça em crescente
    tela.clicar(tela.botao("Consultor"));
    expect(nomes()).toEqual(["ANA", "BRUNO", "CARLA"]);
  });

  it("ComparativoConsultores: na ordem padrão todas as colunas têm o ícone neutro; a coluna ordenada troca por ▲/▼", () => {
    tela = montar(<ComparativoConsultores consultores={[consultorBase()]} ehMesAtual onAbrirConsultor={vi.fn()} />);
    const neutros = () => tela!.container.querySelectorAll("thead [data-icone-ordenar=padrao]").length;
    const iconeDa = (rotulo: string) => Array.from(tela!.container.querySelectorAll("thead th")).find((th) => th.textContent?.includes(rotulo))!.querySelector("[data-icone-ordenar=padrao]");

    // ordem padrão (ao abrir): as 8 colunas mostram o ícone neutro
    expect(neutros()).toBe(8);

    tela.clicar(tela.botao("Consultor")); // crescente: a coluna tem ▲ e perde o neutro; as outras 7 seguem com ele
    expect(neutros()).toBe(7);
    expect(iconeDa("Consultor")).toBeNull();

    tela.clicar(tela.botao("Consultor")); // decrescente
    expect(neutros()).toBe(7);

    tela.clicar(tela.botao("Consultor")); // volta ao padrão: o ícone neutro volta nas 8
    expect(neutros()).toBe(8);
    expect(iconeDa("Consultor")).not.toBeNull();
  });

  it("ComparativoConsultores: passar o mouse no cabeçalho mostra 'Clique para ordenar' em todas as colunas", () => {
    tela = montar(<ComparativoConsultores consultores={[consultorBase()]} ehMesAtual onAbrirConsultor={vi.fn()} />);
    const cabecalhos = Array.from(tela.container.querySelectorAll("thead th button"));
    const dica = () => document.querySelector("[role=tooltip]")?.textContent ?? null;

    expect(cabecalhos).toHaveLength(8);
    expect(dica()).toBeNull();

    for (const botao of cabecalhos) {
      const gatilho = botao.parentElement!; // o Tooltip escuta o mouse no <span> que envolve o botão
      // o React monta onMouseEnter/onMouseLeave a partir de mouseover/mouseout
      act(() => {
        gatilho.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, relatedTarget: document.body }));
      });
      expect(dica()).toBe("Clique para ordenar");

      act(() => {
        gatilho.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body }));
      });
      expect(dica()).toBeNull();
    }
  });

  it("ComparativoConsultores sem consultores mostra mensagem", () => {
    tela = montar(<ComparativoConsultores consultores={[]} ehMesAtual onAbrirConsultor={vi.fn()} />);

    expect(tela.texto()).toContain("Nenhum consultor ativo.");
  });

  it("ChamadosBloco: situação, parados, semanas, cliente e área", () => {
    tela = montar(<ChamadosBloco chamados={dashboardBase().chamados} />);

    expect(tela.texto()).toContain("Atribuído");
    expect(tela.texto()).toContain("StandBy");
    expect(tela.texto()).toContain("Chamados parados (4)");
    expect(tela.texto()).toContain("Erro na nota");
    // a lista é completa: não há mais aviso de "mostrando os N mais antigos"
    expect(tela.texto()).not.toContain("Mostrando os");
    expect(tela.texto()).toContain("28/09");
    expect(tela.texto()).toContain("CLIENTE A");
    expect(tela.texto()).toContain("Sem área");
  });

  it("QualidadeBloco: lista as três situações e abre o consultor pelo nome", () => {
    const aoAbrir = vi.fn();
    tela = montar(<QualidadeBloco qualidade={dashboardBase().qualidade} onAbrirConsultor={aoAbrir} />);

    expect(tela.texto()).toContain("1 dia");
    expect(tela.texto()).toContain("desde 01/08/2026 (62 dias)");
    expect(tela.texto()).toContain("2 de 30 OS (7%)");

    tela.clicar(tela.botao("BRUNO LIMA"));
    expect(aoAbrir).toHaveBeenCalledWith(2, "BRUNO LIMA");
  });

  it("QualidadeBloco: um consultor por linha, com TODOS os dias do mês sem apontamento e sem quebra de linha", () => {
    const dias = Array.from({ length: 22 }, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`);
    const q = {
      ...dashboardBase().qualidade,
      diasSemApontamento: [
        { codigo: 1, nome: "ANA SOUZA", quantidade: 22, dias },
        { codigo: 2, nome: "BRUNO LIMA", quantidade: 1, dias: ["2026-09-30"] },
      ],
    };
    tela = montar(<QualidadeBloco qualidade={q} onAbrirConsultor={vi.fn()} />);

    const linhas = Array.from(tela.container.querySelectorAll("section:first-of-type > ul > li"));
    expect(linhas).toHaveLength(2);
    // todos os 22 dias na mesma linha, sem "+N antes" e sem quebrar para a linha de baixo
    const chips = linhas[0].querySelectorAll("ul > li");
    expect(chips).toHaveLength(22);
    expect(linhas[0].querySelector("ul")?.className).toContain("flex-nowrap");
    expect(linhas[0].textContent).toContain("22 dias");
    expect(linhas[0].textContent).not.toContain("antes");
    expect(linhas[1].textContent).toContain("1 dia");
  });

  it("QualidadeBloco sem ocorrências mostra mensagens claras", () => {
    tela = montar(<QualidadeBloco qualidade={{ diasSemApontamento: [], permissoesAntigas: [], lancamentosAtrasados: [] }} onAbrirConsultor={vi.fn()} />);

    expect(tela.texto()).toContain("Nenhum dia útil sem apontamento.");
    expect(tela.texto()).toContain("Nenhuma permissão antiga.");
    expect(tela.texto()).toContain("Nenhum lançamento atrasado neste mês.");
  });
});

describe("cards com mais de 10 linhas: expandir e recolher", () => {
  const consultores = (n: number) => Array.from({ length: n }, (_, i) => consultorBase({ codigo: i + 1, nome: `CONSULTOR ${String(i + 1).padStart(2, "0")}`, percentualMeta: 100 - i }));
  const linhasDaTabela = () => tela!.container.querySelectorAll("tbody tr").length;

  it("até 10 linhas: mostra tudo e NÃO tem botão", () => {
    tela = montar(<ComparativoConsultores consultores={consultores(10)} ehMesAtual onAbrirConsultor={vi.fn()} />);

    expect(linhasDaTabela()).toBe(10);
    expect(tela.botao("Ver todas")).toBeUndefined();
    expect(tela.botao("Recolher")).toBeUndefined();
  });

  it("11 ou mais: começa recolhido com as 10 primeiras e o botão mostra o total", () => {
    tela = montar(<ComparativoConsultores consultores={consultores(23)} ehMesAtual onAbrirConsultor={vi.fn()} />);

    expect(linhasDaTabela()).toBe(10);
    const botao = tela.botao("Ver todas (23)")!;
    expect(botao.getAttribute("aria-expanded")).toBe("false");
    // o botão aponta para a região que controla
    expect(tela.container.querySelector(`#${CSS.escape(botao.getAttribute("aria-controls")!)}`)).not.toBeNull();
  });

  it("expandir mostra todas e vira 'Recolher'; recolher volta às 10", () => {
    tela = montar(<ComparativoConsultores consultores={consultores(23)} ehMesAtual onAbrirConsultor={vi.fn()} />);

    tela.clicar(tela.botao("Ver todas (23)"));
    expect(linhasDaTabela()).toBe(23);
    expect(tela.botao("Recolher")!.getAttribute("aria-expanded")).toBe("true");

    tela.clicar(tela.botao("Recolher"));
    expect(linhasDaTabela()).toBe(10);
    expect(tela.botao("Ver todas (23)")).toBeDefined();
  });

  it("a ordenação vale para a lista toda: as 10 mostradas são as 10 primeiras da ordem escolhida", () => {
    tela = montar(<ComparativoConsultores consultores={consultores(15)} ehMesAtual onAbrirConsultor={vi.fn()} />);

    tela.clicar(tela.botao("% da meta")); // inverte: menor % primeiro
    const nomes = Array.from(tela.container.querySelectorAll("tbody tr td:first-child button")).map((b) => b.textContent);

    expect(nomes[0]).toBe("CONSULTOR 15");
    expect(nomes).toHaveLength(10);
  });

  it("cada card tem o seu botão: um expandido não mexe nos outros", () => {
    const parados = Array.from({ length: 12 }, (_, i) => ({ codChamado: 100 + i, assunto: `Assunto ${i}`, cliente: "C", consultor: "X", status: "STANDBY", diasParado: 30 - i }));
    const q = {
      diasSemApontamento: Array.from({ length: 12 }, (_, i) => ({ codigo: i + 1, nome: `NOME ${i + 1}`, quantidade: 1, dias: ["2026-09-30"] })),
      permissoesAntigas: [{ codigo: 1, nome: "ANA", dataLimite: null, diasDesdeLimite: null }],
      lancamentosAtrasados: [],
    };
    tela = montar(
      <>
        <ChamadosBloco chamados={{ ...dashboardBase().chamados, parados, totalParados: 12 }} />
        <QualidadeBloco qualidade={q} onAbrirConsultor={vi.fn()} />
      </>,
    );

    // dois cards passam de 10 linhas (chamados parados e dias sem apontamento); os outros não têm botão
    const botoes = () => Array.from(tela!.container.querySelectorAll<HTMLButtonElement>("button")).filter((b) => /^Ver todas/.test(b.textContent ?? ""));
    const linhasDe = (botao: HTMLButtonElement) => {
      const regiao = tela!.container.querySelector(`#${CSS.escape(botao.getAttribute("aria-controls")!)}`)!;

      return regiao.querySelectorAll(regiao.tagName === "UL" ? ":scope > li" : "tbody tr").length;
    };
    expect(botoes()).toHaveLength(2);

    const [dosParados, dosDias] = botoes(); // na ordem da tela: chamados parados, depois dias sem apontamento
    expect([linhasDe(dosParados), linhasDe(dosDias)]).toEqual([10, 10]);

    tela.clicar(dosParados);
    // o card clicado mostra as 12; o outro continua recolhido, com o botão de expandir
    const restante = botoes();
    expect(restante).toHaveLength(1);
    expect(linhasDe(restante[0])).toBe(10);
    expect(tela.botao("Recolher")).toBeDefined();
    expect(tela.container.querySelectorAll("table")[1]?.querySelectorAll("tbody tr").length ?? 0).toBeGreaterThanOrEqual(12);
  });
});

describe("posição do botão 'Ver todas' no card", () => {
  it("fica no cabeçalho, ao lado do bloco do título (que encolhe e quebra linha em vez de empurrar o botão)", () => {
    const consultores = Array.from({ length: 12 }, (_, i) => consultorBase({ codigo: i + 1, nome: `CONSULTOR ${i + 1}` }));
    tela = montar(<ComparativoConsultores consultores={consultores} ehMesAtual onAbrirConsultor={vi.fn()} />);

    const botao = tela.botao("Ver todas (12)")!;
    const cabecalho = tela.container.querySelector("header")!;
    const [titulos, area] = Array.from(cabecalho.children);

    expect(cabecalho.contains(botao)).toBe(true);
    expect(cabecalho.className).not.toContain("flex-wrap"); // sem quebra para a linha de baixo
    expect(titulos.className).toContain("min-w-0");
    expect(titulos.className).toContain("flex-1");
    expect(area.contains(botao)).toBe(true);
    expect(area.className).toContain("shrink-0"); // o botão não encolhe nem sai do canto direito
  });
});

describe("DashboardAba", () => {
  it("carrega o mês atual e mostra todos os blocos", async () => {
    tela = montar(<PaginaFalsa />);
    await aguardar();

    expect(api.buscarDashboardAdmin).toHaveBeenCalledWith(mesAtual());
    for (const titulo of ["Visão geral", "Comparativo de consultores", "Tarefas perto do limite", "Tarefas com estouro liberado", "Chamados abertos", "Dias úteis sem apontamento", "Lançamentos atrasados"]) {
      expect(tela.texto(), titulo).toContain(titulo);
    }
    expect(tela.texto()).toContain("Atualizado");
    expect(tela.texto()).toContain("ANA SOUZA");
    expect(tela.texto()).toContain("MIGRACAO");
  });

  it("trocar o mês busca o mês anterior", async () => {
    tela = montar(<PaginaFalsa />);
    await aguardar();

    tela.clicar(tela.botao("Mês anterior"));
    await aguardar();

    expect(api.buscarDashboardAdmin).toHaveBeenCalledWith(mesAnterior(mesAtual()));
  });

  it("não tem mais o botão 'Atualizar agora' nem o texto 'Calculado às' dentro da aba", async () => {
    tela = montar(<PaginaFalsa />);
    await aguardar();

    expect(tela.botao("Atualizar agora")).toBeUndefined();
    expect(tela.texto()).not.toContain("Calculado às");
  });

  it("o badge mostra quando foi atualizado e quanto falta para a próxima atualização", async () => {
    tela = montar(<PaginaFalsa />);
    await aguardar();

    expect(tela.texto()).toMatch(/Atualizado há|Atualizado agora mesmo/);
    expect(tela.texto()).toContain("às 12:00 · próxima atualização em");
  });

  it("clicar no badge atualiza na hora, pedindo ao servidor para ignorar o cache dele", async () => {
    tela = montar(<PaginaFalsa />);
    await aguardar();
    api.buscarDashboardAdmin.mockClear();

    tela.clicar(tela.botao("Clique para atualizar agora"));
    await aguardar();

    expect(api.buscarDashboardAdmin).toHaveBeenCalledWith(mesAtual(), true);
  });

  it("atualiza sozinho a cada 5 minutos (e não antes)", async () => {
    vi.useFakeTimers();
    tela = montar(<PaginaFalsa />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(api.buscarDashboardAdmin).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4 * 60_000);
    });
    expect(api.buscarDashboardAdmin).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });
    expect(api.buscarDashboardAdmin).toHaveBeenCalledTimes(2);
    // a busca automática não pede para ignorar o cache (o do servidor vale 2 min, menos que o intervalo)
    expect(api.buscarDashboardAdmin).toHaveBeenLastCalledWith(mesAtual());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60_000);
    });
    expect(api.buscarDashboardAdmin).toHaveBeenCalledTimes(3);
  });

  it("o clique no selo reinicia a contagem: a próxima automática vem 5 min DEPOIS do clique", async () => {
    vi.useFakeTimers();
    tela = montar(<PaginaFalsa />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(api.buscarDashboardAdmin).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3 * 60_000);
    });
    tela.clicar(tela.botao("Clique para atualizar agora"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(api.buscarDashboardAdmin).toHaveBeenCalledTimes(2); // o clique

    // 3 min depois do clique (6 min da primeira busca): ainda NÃO buscou de novo
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3 * 60_000);
    });
    expect(api.buscarDashboardAdmin).toHaveBeenCalledTimes(2);

    // 5 min depois do clique: busca automática
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2 * 60_000 + 1000);
    });
    expect(api.buscarDashboardAdmin).toHaveBeenCalledTimes(3);
  });

  it("com a aba do navegador escondida a busca automática é pulada", async () => {
    vi.useFakeTimers();
    tela = montar(<PaginaFalsa />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    try {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5 * 60_000 + 1000);
      });
      expect(api.buscarDashboardAdmin).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    }
  });

  it("depois de uma falha a automática tenta de novo 5 min depois (não fica parada)", async () => {
    vi.useFakeTimers();
    tela = montar(<PaginaFalsa />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    api.buscarDashboardAdmin.mockRejectedValueOnce(new Error("banco fora"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60_000 + 1000);
    });
    expect(api.buscarDashboardAdmin).toHaveBeenCalledTimes(2); // a que falhou

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60_000 + 1000);
    });
    expect(api.buscarDashboardAdmin).toHaveBeenCalledTimes(3);
  });

  it("falha numa atualização: números antigos continuam na tela e o badge avisa", async () => {
    tela = montar(<PaginaFalsa />);
    await aguardar();

    api.buscarDashboardAdmin.mockRejectedValueOnce(new Error("banco fora"));
    tela.clicar(tela.botao("Clique para atualizar agora"));
    await aguardar();

    expect(tela.texto()).toContain("Falha ao atualizar");
    expect(tela.texto()).toContain("Última atualização às 12:00");
    expect(tela.texto()).toContain("ANA SOUZA"); // não some com o que já estava na tela

    // clicar de novo tenta outra vez e volta ao normal
    tela.clicar(tela.botao("Falha ao atualizar"));
    await aguardar();
    expect(tela.texto()).not.toContain("Falha ao atualizar");
  });

  it("clicar no consultor abre o painel dele (só leitura) e dá para voltar", async () => {
    tela = montar(<PaginaFalsa />);
    await aguardar();

    tela.clicar(tela.botao("ANA SOUZA"));
    await aguardar();

    expect(api.buscarPainelDoConsultorAdmin).toHaveBeenCalledWith(1, mesAtual());
    expect(tela.texto()).toContain("Mês do consultor");
    expect(tela.texto()).toContain("← Voltar ao dashboard");
    // nada de botões que gravam: o detalhe é só consulta
    expect(tela.botao("Apontar")).toBeUndefined();

    tela.clicar(tela.botao("← Voltar ao dashboard"));
    expect(tela.texto()).toContain("Comparativo de consultores");
  });

  it("o botão de editar da tarefa abre o mesmo modal da aba Tarefas", async () => {
    tela = montar(<PaginaFalsa />);
    await aguardar();

    tela.clicar(tela.botao("Editar a tarefa MIGRACAO"));
    await aguardar();

    expect(document.body.textContent).toContain("Editar tarefa");
    expect(document.body.textContent).toContain("MIGRACAO · #7");
  });

  it("exporta o que está na tela (CSV e PDF), sem nova consulta", async () => {
    tela = montar(<PaginaFalsa />);
    await aguardar();
    api.buscarDashboardAdmin.mockClear();

    tela.clicar(tela.botao("Baixar Excel (CSV)"));
    tela.clicar(tela.botao("Imprimir / salvar PDF"));

    expect(arquivos.baixarArquivo).toHaveBeenCalledTimes(1);
    expect(arquivos.baixarArquivo.mock.calls[0][0]).toBe(`dashboard-${mesAtual()}.csv`);
    expect(arquivos.baixarArquivo.mock.calls[0][1]).toContain("ANA SOUZA");
    expect(arquivos.imprimirHtml).toHaveBeenCalledTimes(1);
    expect(arquivos.imprimirHtml.mock.calls[0][0]).toContain("<!doctype html>");
    expect(api.buscarDashboardAdmin).not.toHaveBeenCalled();
  });

  it("erro ao carregar: mostra a mensagem e deixa tentar de novo", async () => {
    api.buscarDashboardAdmin.mockRejectedValueOnce(new Error("Não foi possível carregar o dashboard."));
    tela = montar(<PaginaFalsa />);
    await aguardar();

    expect(tela.container.querySelector("[role=alert]")?.textContent).toContain("Não foi possível carregar o dashboard.");

    tela.clicar(tela.botao("Tentar novamente"));
    await aguardar();

    expect(tela.texto()).toContain("Visão geral");
  });
});

describe("BadgeAtualizacao", () => {
  const GERADO = "2026-10-02T15:00:00.000Z"; // 12:00 em Brasília

  it("texto de idade se renova sozinho com o tempo", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T15:03:00Z"));
    tela = montar(<BadgeAtualizacao geradoEm={GERADO} ultimaBuscaEm={new Date(GERADO).getTime()} atualizando={false} falhou={false} onAtualizar={vi.fn()} />);

    expect(tela.texto()).toContain("Atualizado há 3 min");
    expect(tela.texto()).toContain("às 12:00 · próxima atualização em 2 min");

    act(() => {
      vi.advanceTimersByTime(2 * 60_000);
    });
    expect(tela.texto()).toContain("Atualizado há 5 min");
  });

  it("clicar chama a atualização; enquanto busca fica desabilitado e diz 'Atualizando...'", () => {
    const aoAtualizar = vi.fn();
    tela = montar(<BadgeAtualizacao geradoEm={GERADO} atualizando={false} falhou={false} onAtualizar={aoAtualizar} />);

    tela.clicar(tela.botao("Clique para atualizar agora"));
    expect(aoAtualizar).toHaveBeenCalledTimes(1);

    tela.desmontar();
    tela = montar(<BadgeAtualizacao geradoEm={GERADO} atualizando falhou={false} onAtualizar={aoAtualizar} />);
    expect(tela.texto()).toContain("Atualizando...");
    expect(tela.container.querySelector("button")?.disabled).toBe(true);
  });

  it("antes de chegar o primeiro dado mostra 'Carregando...'; com falha, o aviso e como tentar de novo", () => {
    tela = montar(<BadgeAtualizacao atualizando falhou={false} onAtualizar={vi.fn()} />);
    expect(tela.texto()).toContain("Carregando...");

    tela.desmontar();
    tela = montar(<BadgeAtualizacao geradoEm={GERADO} atualizando={false} falhou onAtualizar={vi.fn()} />);
    expect(tela.texto()).toContain("Falha ao atualizar");
    expect(tela.texto()).toContain("Clique para tentar de novo");
  });

  it("o nome acessível junta o estado e a ação (leitor de tela)", () => {
    tela = montar(<BadgeAtualizacao geradoEm={GERADO} atualizando={false} falhou={false} onAtualizar={vi.fn()} />);

    expect(tela.container.querySelector("button")?.getAttribute("aria-label")).toMatch(/^Atualizado .*às 12:00 · próxima atualização em .*\. Clique para atualizar agora\.$/);
  });
});

describe("barra da próxima atualização (no selo)", () => {
  const GERADO = "2026-10-02T15:00:00.000Z";
  const AGORA = new Date("2026-10-02T15:00:00Z").getTime();
  const progresso = () => Number(tela!.container.querySelector("[data-barra-progresso]")!.getAttribute("data-barra-progresso"));

  it("começa vazia, enche com o tempo e vai a 100% quando chega a hora", () => {
    vi.useFakeTimers();
    vi.setSystemTime(AGORA);
    tela = montar(<BadgeAtualizacao geradoEm={GERADO} ultimaBuscaEm={AGORA} atualizando={false} falhou={false} onAtualizar={vi.fn()} />);

    expect(progresso()).toBe(0);
    expect(tela.texto()).toContain("próxima atualização em 5 min");

    act(() => {
      vi.advanceTimersByTime(150_000); // 2 min 30
    });
    expect(progresso()).toBe(50);
    expect(tela.texto()).toContain("próxima atualização em 3 min");

    act(() => {
      vi.advanceTimersByTime(120_000); // 4 min 30
    });
    expect(progresso()).toBe(90);
    expect(tela.texto()).toContain("próxima atualização em menos de 1 min");

    act(() => {
      vi.advanceTimersByTime(60_000); // passou de 5 min: não passa de 100
    });
    expect(progresso()).toBe(100);
    expect(tela.texto()).toContain("próxima atualização em instantes");
  });

  it("a largura da barra acompanha o progresso", () => {
    vi.useFakeTimers();
    vi.setSystemTime(AGORA + 150_000);
    tela = montar(<BadgeAtualizacao geradoEm={GERADO} ultimaBuscaEm={AGORA} atualizando={false} falhou={false} onAtualizar={vi.fn()} />);

    const preenchimento = tela.container.querySelector<HTMLElement>("[data-barra-progresso] > span")!;
    expect(preenchimento.style.width).toBe("50%");
  });

  it("nova busca reinicia a barra", () => {
    vi.useFakeTimers();
    vi.setSystemTime(AGORA + 200_000);
    tela = montar(<BadgeAtualizacao geradoEm={GERADO} ultimaBuscaEm={AGORA} atualizando={false} falhou={false} onAtualizar={vi.fn()} />);
    expect(progresso()).toBe(67);

    tela.desmontar();
    tela = montar(<BadgeAtualizacao geradoEm={GERADO} ultimaBuscaEm={AGORA + 200_000} atualizando={false} falhou={false} onAtualizar={vi.fn()} />);
    expect(progresso()).toBe(0);
  });

  it("enquanto busca a barra fica cheia (e pulsando); sem referência de tempo fica vazia", () => {
    vi.useFakeTimers();
    vi.setSystemTime(AGORA + 60_000);
    tela = montar(<BadgeAtualizacao geradoEm={GERADO} ultimaBuscaEm={AGORA} atualizando falhou={false} onAtualizar={vi.fn()} />);
    expect(progresso()).toBe(100);

    tela.desmontar();
    tela = montar(<BadgeAtualizacao atualizando={false} falhou={false} onAtualizar={vi.fn()} />);
    expect(progresso()).toBe(0);
  });

  it("a barra é só visual (escondida do leitor de tela); o tempo que falta vai no texto", () => {
    vi.useFakeTimers();
    vi.setSystemTime(AGORA);
    tela = montar(<BadgeAtualizacao geradoEm={GERADO} ultimaBuscaEm={AGORA} atualizando={false} falhou={false} onAtualizar={vi.fn()} />);

    expect(tela.container.querySelector("[data-barra-progresso]")?.getAttribute("aria-hidden")).toBe("true");
    expect(tela.container.querySelector("button")?.getAttribute("aria-label")).toContain("próxima atualização em 5 min");
  });
});

describe("avanço da barra: contínuo e proporcional aos 5 minutos", () => {
  const T0 = new Date("2026-10-02T15:00:00Z").getTime();
  const CINCO_MIN = 5 * 60_000;

  it("progressoDaBarra é exatamente tempo decorrido / 5 minutos (limitado a 0..100)", () => {
    expect(progressoDaBarra(T0, T0)).toBe(0);
    expect(progressoDaBarra(T0, T0 + 3_000)).toBeCloseTo(1, 5); // 3 s = 1%
    expect(progressoDaBarra(T0, T0 + 30_000)).toBeCloseTo(10, 5);
    expect(progressoDaBarra(T0, T0 + CINCO_MIN / 2)).toBe(50);
    expect(progressoDaBarra(T0, T0 + CINCO_MIN)).toBe(100);
    expect(progressoDaBarra(T0, T0 + 10 * 60_000)).toBe(100);
    expect(progressoDaBarra(T0, T0 - 5_000)).toBe(0); // relógio adiantado
    expect(progressoDaBarra(null, T0)).toBe(0);
  });

  it("a largura muda a cada instante (4x por segundo), em passos minúsculos e crescentes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    tela = montar(<BadgeAtualizacao geradoEm="2026-10-02T15:00:00.000Z" ultimaBuscaEm={T0} atualizando={false} falhou={false} onAtualizar={vi.fn()} />);

    const largura = () => parseFloat(tela!.container.querySelector<HTMLElement>("[data-barra-progresso] > span")!.style.width);
    const medidas: number[] = [largura()];

    for (let i = 0; i < 8; i++) {
      act(() => {
        vi.advanceTimersByTime(250);
      });
      medidas.push(largura());
    }

    // 2 segundos = 0,67% da barra; cada passo é pequeno e nunca anda para trás
    expect(medidas[0]).toBe(0);
    expect(medidas[8]).toBeCloseTo(0.67, 1);
    for (let i = 1; i < medidas.length; i++) {
      expect(medidas[i]).toBeGreaterThan(medidas[i - 1]);
      expect(medidas[i] - medidas[i - 1]).toBeLessThan(0.2);
    }
  });

  it("chega a 50% em 2 min 30 s e a 100% em 5 min", () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    tela = montar(<BadgeAtualizacao geradoEm="2026-10-02T15:00:00.000Z" ultimaBuscaEm={T0} atualizando={false} falhou={false} onAtualizar={vi.fn()} />);
    const largura = () => parseFloat(tela!.container.querySelector<HTMLElement>("[data-barra-progresso] > span")!.style.width);

    act(() => {
      vi.advanceTimersByTime(150_000);
    });
    expect(largura()).toBeCloseTo(50, 0);

    act(() => {
      vi.advanceTimersByTime(150_000);
    });
    expect(largura()).toBe(100);
  });
});

describe("Chamados parados: lista completa e ordenação", () => {
  const parado = (cod: number, extra: Record<string, unknown> = {}) => ({ codChamado: cod, assunto: `Assunto ${cod}`, cliente: "CLIENTE", consultor: "ANA", status: "STANDBY", diasParado: 10, ...extra });
  const muitos = (n: number) => Array.from({ length: n }, (_, i) => parado(1000 + i, { diasParado: 8 + i }));
  const chamados = (parados: ReturnType<typeof parado>[]) => ({ ...dashboardBase().chamados, parados, totalParados: parados.length });
  const codigos = () => Array.from(tela!.container.querySelectorAll("table:not([class*=max-w-sm]) tbody tr td:first-child")).map((td) => td.textContent);

  it("ordenarParados: padrão = o mais parado primeiro, desempatando pelo número do chamado", () => {
    const lista = [parado(3, { diasParado: 10 }), parado(1, { diasParado: 30 }), parado(2, { diasParado: 10 })];

    expect(ordenarParados(lista, null).map((c) => c.codChamado)).toEqual([1, 2, 3]);
  });

  it("ordenarParados: por texto (pt-BR), por número e pela situação como aparece na tela", () => {
    const lista = [
      parado(1, { assunto: "Zeta", status: "STANDBY", diasParado: 9 }),
      parado(2, { assunto: "álamo", status: "AGUARDANDO VALIDACAO", diasParado: 40 }),
      parado(3, { assunto: "Beta", status: "ATRIBUIDO", diasParado: 20 }),
    ];

    expect(ordenarParados(lista, { coluna: "assunto", crescente: true }).map((c) => c.codChamado)).toEqual([2, 3, 1]);
    expect(ordenarParados(lista, { coluna: "dias", crescente: true }).map((c) => c.codChamado)).toEqual([1, 3, 2]);
    expect(ordenarParados(lista, { coluna: "chamado", crescente: false }).map((c) => c.codChamado)).toEqual([3, 2, 1]);
    // "Aguardando validação" < "Atribuído" < "StandBy"
    expect(ordenarParados(lista, { coluna: "situacao", crescente: true }).map((c) => c.codChamado)).toEqual([2, 3, 1]);
    // não altera a lista original
    expect(lista.map((c) => c.codChamado)).toEqual([1, 2, 3]);
  });

  it("recolhido mostra 10; expandir mostra a primeira página de 25 (e não só 15)", () => {
    tela = montar(<ChamadosBloco chamados={chamados(muitos(50))} />);

    expect(tela.texto()).toContain("Chamados parados (50)");
    expect(codigos()).toHaveLength(10);
    expect(tela.container.querySelector("nav[aria-label='Páginas da lista']")).toBeNull(); // recolhido: sem paginação

    tela.clicar(tela.botao("Ver todas (50)"));
    expect(codigos()).toHaveLength(25);

    tela.clicar(tela.botao("Recolher"));
    expect(codigos()).toHaveLength(10);
  });

  it("abre na ordem padrão (mais parado primeiro), sem coluna marcada e com o ícone neutro nas 6 colunas", () => {
    tela = montar(<ChamadosBloco chamados={chamados(muitos(12))} />);

    // diasParado cresce com o código: o mais parado (1011) vem primeiro
    expect(codigos()[0]).toBe("1.011");
    expect(tela.container.querySelectorAll("th[aria-sort=ascending], th[aria-sort=descending]")).toHaveLength(0);
    expect(tela.container.querySelectorAll("thead [data-icone-ordenar=padrao]")).toHaveLength(6);
  });

  it("clicar no cabeçalho: crescente -> decrescente -> padrão, valendo para a lista toda (também expandida)", () => {
    tela = montar(<ChamadosBloco chamados={chamados(muitos(15))} />);
    tela.clicar(tela.botao("Ver todas (15)"));

    tela.clicar(colunaDosParados("Chamado")); // crescente por número
    expect(codigos()[0]).toBe("1.000");
    expect(codigos()[14]).toBe("1.014");
    expect(tela.container.querySelector("th[aria-sort=ascending]")?.textContent).toContain("▲");

    tela.clicar(colunaDosParados("Chamado")); // decrescente
    expect(codigos()[0]).toBe("1.014");
    expect(tela.container.querySelector("th[aria-sort=descending]")?.textContent).toContain("▼");

    tela.clicar(colunaDosParados("Chamado")); // padrão: o mais parado primeiro
    expect(codigos()[0]).toBe("1.014");
    expect(tela.container.querySelectorAll("th[aria-sort=ascending], th[aria-sort=descending]")).toHaveLength(0);
    expect(tela.container.querySelectorAll("thead [data-icone-ordenar=padrao]")).toHaveLength(6);

    tela.clicar(colunaDosParados("Dias parado")); // crescente por dias: o menos parado primeiro
    expect(codigos()[0]).toBe("1.000");
  });

  it("recolhido, a ordenação escolhe QUAIS 10 aparecem (as 10 primeiras da ordem pedida)", () => {
    tela = montar(<ChamadosBloco chamados={chamados(muitos(30))} />);

    tela.clicar(colunaDosParados("Dias parado")); // crescente: os menos parados
    expect(codigos()).toHaveLength(10);
    expect(codigos()[0]).toBe("1.000");
    expect(codigos()[9]).toBe("1.009");
  });

  it("passar o mouse no cabeçalho mostra 'Clique para ordenar'", () => {
    tela = montar(<ChamadosBloco chamados={chamados(muitos(3))} />);
    const gatilho = tela.botao("Assunto")!.parentElement!;

    act(() => {
      gatilho.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, relatedTarget: document.body }));
    });
    expect(document.querySelector("[role=tooltip]")?.textContent).toBe("Clique para ordenar");
  });
});

describe("Chamados parados: paginação com slide", () => {
  const parado = (cod: number, dias: number) => ({ codChamado: cod, assunto: `Assunto ${cod}`, cliente: "CLIENTE", consultor: "ANA", status: "STANDBY", diasParado: dias });
  // 65 chamados: o código 1000 é o MENOS parado e o 1064 o MAIS parado (ordem padrão: 1064, 1063, ...)
  const lista = (n: number) => Array.from({ length: n }, (_, i) => parado(1000 + i, 8 + i));
  const montarCom = (n: number) => {
    tela = montar(<ChamadosBloco chamados={{ ...dashboardBase().chamados, parados: lista(n), totalParados: n }} />);
    tela.clicar(tela.botao(`Ver todas (${n})`));
  };
  const codigos = () => Array.from(tela!.container.querySelectorAll("tbody")).find((tb) => tb.querySelector("td"))
    ? Array.from(tela!.container.querySelectorAll("table:not([class*=max-w-sm]) tbody tr td:first-child")).map((td) => td.textContent)
    : [];
  // a página mostrada no seletor do rodapé ("2 / 3"); o texto por extenso agora só existe para leitor de tela
  const indicador = () => tela!.container.querySelector("nav[aria-label='Páginas da lista']")?.textContent?.match(/(\d+) \/ (\d+)/)?.[0];
  const avisoDeLeitor = () => tela!.container.querySelector("nav[aria-label='Páginas da lista'] p.sr-only")?.textContent;
  const tbodyDosParados = () => tela!.container.querySelector("table:not([class*=max-w-sm]) tbody")!;
  // botões de página do RODAPÉ (o <nav>); "Próxima"/"Anterior" são os rótulos curtos usados nos testes
  const botaoPagina = (nome: "Próxima" | "Anterior") =>
    tela!.container.querySelector<HTMLButtonElement>(`nav[aria-label='Páginas da lista'] button[aria-label='${nome === "Próxima" ? "Ir para a próxima página" : "Ir para a página anterior"}']`)!;
  // cabeçalho do card "Chamados parados" (a tela tem vários cards, cada um com o seu header)
  const cabecalhoDosParados = () => Array.from(tela!.container.querySelectorAll("section")).find((s) => s.querySelector("h3")?.textContent?.startsWith("Chamados parados"))!.querySelector("header")!;

  it("expandido: 25 por página, com o indicador e Anterior desabilitado na primeira", () => {
    montarCom(65);

    expect(codigos()).toHaveLength(25);
    expect(codigos()[0]).toBe("1.064");
    expect(codigos()[24]).toBe("1.040");
    expect(indicador()).toBe("1 / 3");
    expect(botaoPagina("Anterior").disabled).toBe(true);
    expect(botaoPagina("Próxima").disabled).toBe(false);
  });

  it("Próxima: troca para as linhas 26–50 e depois 51–65; na última, Próxima fica desabilitada", () => {
    montarCom(65);

    tela!.clicar(botaoPagina("Próxima"));
    expect(codigos()).toHaveLength(25);
    expect(codigos()[0]).toBe("1.039");
    expect(codigos()[24]).toBe("1.015");
    expect(indicador()).toBe("2 / 3");
    expect(botaoPagina("Anterior").disabled).toBe(false);

    tela!.clicar(botaoPagina("Próxima"));
    expect(codigos()).toHaveLength(15);
    expect(codigos()[0]).toBe("1.014");
    expect(codigos()[14]).toBe("1.000");
    expect(indicador()).toBe("3 / 3");
    expect(botaoPagina("Próxima").disabled).toBe(true);
  });

  it("o rodapé não mostra mais o texto '1–25 de 65 · página 1 de 3'; só o aviso invisível para leitor de tela", () => {
    montarCom(65);

    expect(tela!.container.textContent).not.toContain("1–25 de 65");
    expect(tela!.container.textContent).not.toContain("· página");
    expect(avisoDeLeitor()).toBe("Página 1 de 3, itens 1 a 25 de 65");
    expect(tela!.container.querySelector("nav[aria-label='Páginas da lista'] p.sr-only")?.getAttribute("aria-live")).toBe("polite");

    tela!.clicar(botaoPagina("Próxima"));
    expect(avisoDeLeitor()).toBe("Página 2 de 3, itens 26 a 50 de 65");

    tela!.clicar(botaoPagina("Próxima"));
    expect(avisoDeLeitor()).toBe("Página 3 de 3, itens 51 a 65 de 65");
  });

  it("Anterior volta uma página", () => {
    montarCom(65);
    tela!.clicar(botaoPagina("Próxima"));

    tela!.clicar(botaoPagina("Anterior"));

    expect(codigos()[0]).toBe("1.064");
    expect(indicador()).toBe("1 / 3");
  });

  it("slide: sem animação ao expandir; ao avançar entra pela direita, ao voltar entra pela esquerda", () => {
    montarCom(65);
    expect(tbodyDosParados().className).not.toContain("animate");

    tela!.clicar(botaoPagina("Próxima"));
    expect(tbodyDosParados().className).toContain("slide-proxima");

    tela!.clicar(botaoPagina("Anterior"));
    expect(tbodyDosParados().className).toContain("slide-anterior");
  });

  it("o slide só vale para quem não pediu menos animação (motion-safe)", () => {
    montarCom(65);
    tela!.clicar(botaoPagina("Próxima"));

    expect(tbodyDosParados().className).toContain("motion-safe:animate-");
  });

  it("o cabeçalho do card também tem os botões de página (só expandido e com mais de uma página)", () => {
    tela = montar(<ChamadosBloco chamados={{ ...dashboardBase().chamados, parados: lista(65), totalParados: 65 }} />);
    const cabecalho = () => cabecalhoDosParados();
    const noCabecalho = (rotulo: string) => cabecalho().querySelector<HTMLButtonElement>(`button[aria-label='${rotulo}']`);

    // recolhido: só o botão Ver todas
    expect(noCabecalho("Ir para a próxima página")).toBeNull();
    expect(cabecalho().textContent).toContain("Ver todas (65)");

    tela.clicar(tela.botao("Ver todas (65)"));
    expect(noCabecalho("Ir para a próxima página")).not.toBeNull();
    expect(cabecalho().textContent).toContain("1 / 3");
    expect(cabecalho().textContent).toContain("Recolher");
  });

  it("cabeçalho: os botões trocam a página (mesmo estado do rodapé), com slide e desabilitados nas pontas", () => {
    montarCom(65);
    const cab = (rotulo: string) => cabecalhoDosParados().querySelector<HTMLButtonElement>(`button[aria-label='${rotulo}']`)!;

    expect(cab("Ir para a página anterior").disabled).toBe(true);

    tela!.clicar(cab("Ir para a próxima página"));
    expect(codigos()[0]).toBe("1.039");
    expect(indicador()).toBe("2 / 3"); // o rodapé acompanha
    expect(cabecalhoDosParados().textContent).toContain("2 / 3");
    expect(tbodyDosParados().className).toContain("slide-proxima");

    tela!.clicar(cab("Ir para a próxima página"));
    expect(cab("Ir para a próxima página").disabled).toBe(true);
    expect(cabecalhoDosParados().textContent).toContain("3 / 3");

    tela!.clicar(cab("Ir para a página anterior"));
    expect(codigos()[0]).toBe("1.039");
    expect(tbodyDosParados().className).toContain("slide-anterior");
  });

  it("rodapé e cabeçalho andam juntos: avançar no rodapé muda também o cabeçalho", () => {
    montarCom(65);

    tela!.clicar(botaoPagina("Próxima"));

    expect(cabecalhoDosParados().textContent).toContain("2 / 3");
  });

  it("até 25 chamados: expandido, o cabeçalho só tem o Recolher (sem botões de página)", () => {
    montarCom(25);

    expect(cabecalhoDosParados().querySelector("button[aria-label='Ir para a próxima página']")).toBeNull();
    expect(cabecalhoDosParados().textContent).toContain("Recolher");
  });

  it("os keyframes do slide existem no CSS global (senão a animação não faz nada)", () => {
    const css = fs.readFileSync("src/app/globals.css", "utf8");

    expect(css).toContain("@keyframes slide-proxima");
    expect(css).toContain("@keyframes slide-anterior");
    expect(css).toMatch(/slide-proxima[\s\S]*translateX\(48px\)/);
    expect(css).toMatch(/slide-anterior[\s\S]*translateX\(-48px\)/);
  });

  it("recolher e expandir de novo volta à primeira página, sem animação", () => {
    montarCom(65);
    tela!.clicar(botaoPagina("Próxima"));
    tela!.clicar(tela!.botao("Recolher"));
    expect(codigos()).toHaveLength(10);

    tela!.clicar(tela!.botao("Ver todas (65)"));

    expect(indicador()).toBe("1 / 3");
    expect(tbodyDosParados().className).not.toContain("animate");
  });

  it("mudar a ordenação volta para a primeira página", () => {
    montarCom(65);
    tela!.clicar(botaoPagina("Próxima"));
    expect(indicador()).toBe("2 / 3");

    tela!.clicar(colunaDosParados("Chamado")); // crescente por número

    expect(indicador()).toBe("1 / 3");
    expect(codigos()[0]).toBe("1.000");
    expect(codigos()[24]).toBe("1.024");
  });

  it("a ordenação vale para todas as páginas (a página 2 continua a partir de onde a 1 parou)", () => {
    montarCom(65);

    tela!.clicar(colunaDosParados("Chamado"));
    tela!.clicar(botaoPagina("Próxima"));

    expect(codigos()[0]).toBe("1.025");
    expect(codigos()[24]).toBe("1.049");
  });

  it("até 25 chamados: expande mas não tem paginação", () => {
    montarCom(25);

    expect(codigos()).toHaveLength(25);
    expect(tela!.container.querySelector("nav[aria-label='Páginas da lista']")).toBeNull();
  });

  it("26 chamados já formam duas páginas (25 + 1)", () => {
    montarCom(26);

    expect(indicador()).toBe("1 / 2");
    tela!.clicar(botaoPagina("Próxima"));
    expect(codigos()).toHaveLength(1);
    expect(indicador()).toBe("2 / 2");
  });

  it("uma lista nova (ex.: outro mês) com menos chamados abre na primeira página", () => {
    montarCom(65);
    tela!.clicar(botaoPagina("Próxima"));
    tela!.clicar(botaoPagina("Próxima")); // página 3

    tela!.desmontar();
    tela = montar(<ChamadosBloco chamados={{ ...dashboardBase().chamados, parados: lista(30), totalParados: 30 }} />);
    tela.clicar(tela.botao("Ver todas (30)"));

    expect(indicador()).toBe("1 / 2");
  });
});

describe("rodapé da paginação: mesmo estilo do cabeçalho", () => {
  const parado = (cod: number) => ({ codChamado: cod, assunto: `A${cod}`, cliente: "C", consultor: "X", status: "STANDBY", diasParado: 9 });
  const montarExpandido = () => {
    tela = montar(<ChamadosBloco chamados={{ ...dashboardBase().chamados, parados: Array.from({ length: 60 }, (_, i) => parado(i + 1)), totalParados: 60 }} />);
    tela.clicar(tela.botao("Ver todas (60)"));
  };

  it("o rodapé usa o mesmo seletor compacto (‹ 1 / 3 ›): botões quadrados iguais aos do cabeçalho", () => {
    montarExpandido();
    const rodape = tela!.container.querySelector("nav[aria-label='Páginas da lista']")!;
    const cabecalho = Array.from(tela!.container.querySelectorAll("section")).find((s) => s.querySelector("h3")?.textContent?.startsWith("Chamados parados"))!.querySelector("header")!;
    const botoes = (area: Element) => Array.from(area.querySelectorAll<HTMLButtonElement>("button[aria-label^='Ir para']"));

    expect(botoes(rodape)).toHaveLength(2);
    expect(botoes(cabecalho)).toHaveLength(2);
    // mesmas classes (estilo idêntico) e mesmos símbolos
    expect(botoes(rodape).map((b) => b.className)).toEqual(botoes(cabecalho).map((b) => b.className));
    expect(botoes(rodape).map((b) => b.textContent)).toEqual(["‹", "›"]);
    expect(rodape.textContent).toContain("1 / 3");
  });

  it("não sobrou o estilo antigo (botões largos com texto 'Anterior' / 'Próxima')", () => {
    montarExpandido();
    const rodape = tela!.container.querySelector("nav[aria-label='Páginas da lista']")!;

    expect(rodape.textContent).not.toContain("‹ Anterior");
    expect(rodape.textContent).not.toContain("Próxima ›");
    // o texto "1–25 de 60 · página 1 de 3" saiu da tela: sobra o seletor e um aviso só para leitor de tela
    expect(rodape.textContent).not.toContain("1–25 de 60");
    expect(rodape.textContent).not.toContain("· página");
    expect(rodape.querySelector("p.sr-only")?.textContent).toBe("Página 1 de 3, itens 1 a 25 de 60");
  });

  it("clicar no rodapé troca a página e o slide continua funcionando", () => {
    montarExpandido();
    const rodape = tela!.container.querySelector("nav[aria-label='Páginas da lista']")!;

    tela!.clicar(rodape.querySelector<HTMLButtonElement>("button[aria-label='Ir para a próxima página']")!);

    expect(rodape.textContent).toContain("2 / 3");
    expect(rodape.querySelector("p.sr-only")?.textContent).toBe("Página 2 de 3, itens 26 a 50 de 60");
    expect(tela!.container.querySelector("table:not([class*=max-w-sm]) tbody")!.className).toContain("slide-proxima");
  });
});

describe("botão de ajuda ('?') em cada card", () => {
  const dash = dashboardBase();
  const ajudas = () => Array.from(tela!.container.querySelectorAll<HTMLButtonElement>("button[aria-label^='Como funciona:']"));
  const rotulos = () => ajudas().map((b) => b.getAttribute("aria-label"));
  const dialogo = () => document.querySelector<HTMLElement>("[role=dialog]");

  it("todos os 12 cards do dashboard têm o botão, cada um com o nome do seu card", () => {
    tela = montar(
      <>
        <VisaoGeral visao={dash.visao} nomeMes={dash.nomeMes} ehMesAtual />
        <ComparativoConsultores consultores={dash.consultores} ehMesAtual onAbrirConsultor={vi.fn()} />
        <TarefasBloco emRisco={dash.tarefas.emRisco} comEstouroLiberado={dash.tarefas.comEstouroLiberado} totalEmRisco={1} totalComEstouroLiberado={1} nomeMes={dash.nomeMes} onEditar={vi.fn()} />
        <ChamadosBloco chamados={dash.chamados} />
        <QualidadeBloco qualidade={dash.qualidade} onAbrirConsultor={vi.fn()} />
      </>,
    );

    expect(rotulos()).toEqual([
      "Como funciona: Visão geral",
      "Como funciona: Comparativo de consultores",
      "Como funciona: Tarefas perto do limite",
      "Como funciona: Tarefas com estouro liberado",
      "Como funciona: Chamados abertos",
      "Como funciona: Chamados por semana",
      "Como funciona: Chamados parados",
      "Como funciona: Chamados por cliente",
      "Como funciona: Chamados por área de atuação",
      "Como funciona: Dias úteis sem apontamento",
      "Como funciona: Permissão de apontar no passado a rever",
      "Como funciona: Lançamentos atrasados",
    ]);
  });

  it("o botão é o ÚLTIMO do cabeçalho, depois de 'Ver todas'", () => {
    const consultores = Array.from({ length: 12 }, (_, i) => consultorBase({ codigo: i + 1, nome: `CONSULTOR ${i + 1}` }));
    tela = montar(<ComparativoConsultores consultores={consultores} ehMesAtual onAbrirConsultor={vi.fn()} />);

    const botoes = Array.from(tela.container.querySelector("header")!.querySelectorAll("button"));

    expect(botoes.map((b) => b.getAttribute("aria-label") ?? b.textContent)).toEqual(["Ver todas (12)", "Como funciona: Comparativo de consultores"]);
  });

  it("no card de parados expandido a ordem é: páginas, Recolher e por último a ajuda", () => {
    const parados = Array.from({ length: 60 }, (_, i) => ({ codChamado: i + 1, assunto: "A", cliente: "C", consultor: "X", status: "STANDBY", diasParado: 9 }));
    tela = montar(<ChamadosBloco chamados={{ ...dash.chamados, parados, totalParados: 60 }} />);
    tela.clicar(tela.botao("Ver todas (60)"));

    const cab = Array.from(tela.container.querySelectorAll("section")).find((s) => s.querySelector("h3")?.textContent?.startsWith("Chamados parados"))!.querySelector("header")!;
    const botoes = Array.from(cab.querySelectorAll("button")).map((b) => b.getAttribute("aria-label") ?? b.textContent);

    expect(botoes).toEqual(["Ir para a página anterior", "Ir para a próxima página", "Recolher", "Como funciona: Chamados parados"]);
  });

  it("abre a janela com 'Para que serve', 'O que mostra' e 'Como ler' do card", () => {
    tela = montar(<VisaoGeral visao={dash.visao} nomeMes={dash.nomeMes} ehMesAtual />);
    const botao = ajudas()[0];
    expect(dialogo()).toBeNull();
    expect(botao.getAttribute("aria-expanded")).toBe("false");

    tela.clicar(botao);

    const d = dialogo()!;
    expect(d).not.toBeNull();
    expect(d.getAttribute("aria-modal")).toBe("true");
    expect(d.textContent).toContain("Como funciona este card");
    expect(d.querySelector("h2")?.textContent).toBe("Visão geral");
    expect(d.getAttribute("aria-labelledby")).toBe(d.querySelector("h2")!.id);
    for (const secao of ["Para que serve", "O que mostra", "Como ler"]) expect(d.textContent, secao).toContain(secao);
    expect(botao.getAttribute("aria-expanded")).toBe("true");
  });

  it("o foco vai para o botão Fechar ao abrir e volta para o '?' ao fechar", () => {
    tela = montar(<VisaoGeral visao={dash.visao} nomeMes={dash.nomeMes} ehMesAtual />);
    const botao = ajudas()[0];

    tela.clicar(botao);
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Fechar");

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(dialogo()).toBeNull();
    expect(document.activeElement).toBe(botao);
  });

  it("fecha com o X, com 'Entendi' e com Esc", () => {
    tela = montar(<VisaoGeral visao={dash.visao} nomeMes={dash.nomeMes} ehMesAtual />);
    const abrir = () => tela!.clicar(ajudas()[0]);

    abrir();
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(dialogo()).toBeNull();

    abrir();
    tela.clicar(document.querySelector<HTMLElement>("[role=dialog] [aria-label='Fechar']")!);
    expect(dialogo()).toBeNull();

    abrir();
    tela.clicar(Array.from(document.querySelectorAll<HTMLElement>("[role=dialog] button")).find((b) => b.textContent === "Entendi")!);
    expect(dialogo()).toBeNull();

  });

  it("clicar FORA da janela (no fundo escurecido) ou dentro dela NÃO fecha", () => {
    tela = montar(<VisaoGeral visao={dash.visao} nomeMes={dash.nomeMes} ehMesAtual />);
    tela.clicar(ajudas()[0]);
    const janela = dialogo()!;
    const fundo = janela.parentElement!;

    for (const alvo of [fundo, janela, janela.querySelector("h2")!]) {
      for (const tipo of ["mousedown", "mouseup", "click"]) {
        act(() => {
          alvo.dispatchEvent(new MouseEvent(tipo, { bubbles: true }));
        });
      }
    }

    expect(dialogo()).not.toBeNull();
    expect(ajudas()[0].getAttribute("aria-expanded")).toBe("true");

    // só os botões dela fecham
    tela.clicar(document.querySelector<HTMLElement>("[role=dialog] [aria-label='Fechar']")!);
    expect(dialogo()).toBeNull();
  });

  it("o Tab fica preso dentro da janela (do último volta ao primeiro, e vice-versa)", () => {
    tela = montar(<VisaoGeral visao={dash.visao} nomeMes={dash.nomeMes} ehMesAtual />);
    tela.clicar(ajudas()[0]);
    const focaveis = Array.from(dialogo()!.querySelectorAll<HTMLElement>("button"));
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];

    ultimo.focus();
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    });
    expect(document.activeElement).toBe(primeiro);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));
    });
    expect(document.activeElement).toBe(ultimo);
  });

  it("a rolagem da página trava enquanto a janela está aberta e é restaurada ao fechar", () => {
    tela = montar(<VisaoGeral visao={dash.visao} nomeMes={dash.nomeMes} ehMesAtual />);
    document.body.style.overflow = "";

    tela.clicar(ajudas()[0]);
    expect(document.body.style.overflow).toBe("hidden");

    tela.clicar(document.querySelector<HTMLElement>("[role=dialog] [aria-label='Fechar']")!);
    expect(document.body.style.overflow).toBe("");
  });

  it("a janela vai para o <body> (não fica dentro do card, que poderia cortá-la)", () => {
    tela = montar(<ComparativoConsultores consultores={[consultorBase()]} ehMesAtual onAbrirConsultor={vi.fn()} />); // este card tem overflow-hidden
    tela.clicar(ajudas()[0]);

    expect(tela.container.querySelector("[role=dialog]")).toBeNull();
    expect(dialogo()!.closest("body")).toBe(document.body);
  });

  it("passar o mouse no '?' mostra a dica 'Como funciona este card'", () => {
    tela = montar(<VisaoGeral visao={dash.visao} nomeMes={dash.nomeMes} ehMesAtual />);

    act(() => {
      ajudas()[0].parentElement!.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, relatedTarget: document.body }));
    });

    expect(document.querySelector("[role=tooltip]")?.textContent).toBe("Como funciona este card");
  });

  it("os textos explicam cada card: frases-chave das regras (para o texto não ficar velho)", async () => {
    const { AJUDAS } = await import("./ajudas");
    const texto = (a: (typeof AJUDAS)[keyof typeof AJUDAS]) => [a.paraQueServe, ...a.oQueMostra, ...a.comoLer].join(" ");

    expect(texto(AJUDAS.visaoGeral)).toContain("jornada diária");
    expect(texto(AJUDAS.visaoGeral)).toContain("mês INTEIRO");
    expect(texto(AJUDAS.visaoGeral)).toContain("5 minutos");
    expect(texto(AJUDAS.comparativo)).toContain("3º volta à ordem padrão");
    expect(texto(AJUDAS.tarefasPertoDoLimite)).toContain("80%");
    expect(texto(AJUDAS.chamadosParados)).toContain("mais de 7 dias");
    expect(texto(AJUDAS.chamadosParados)).toContain("25 por página");
    expect(texto(AJUDAS.chamadosPorSemana)).toContain("8 semanas");
    expect(texto(AJUDAS.diasSemApontamento)).toContain("hoje não conta");
    expect(texto(AJUDAS.permissaoAntiga)).toContain("início do mês passado");
    expect(texto(AJUDAS.lancamentosAtrasados)).toContain("1 dia útil");
  });

  it("todo texto de ajuda está preenchido e os títulos batem com os dos cards", async () => {
    const { AJUDAS } = await import("./ajudas");
    const todas = Object.values(AJUDAS);

    expect(todas).toHaveLength(12);
    for (const a of todas) {
      expect(a.titulo.length).toBeGreaterThan(3);
      expect(a.paraQueServe.length).toBeGreaterThan(20);
      expect(a.oQueMostra.length).toBeGreaterThan(0);
      expect(a.comoLer.length).toBeGreaterThan(0);
      for (const linha of [...a.oQueMostra, ...a.comoLer]) expect(linha.trim().length).toBeGreaterThan(10);
    }
    expect(new Set(todas.map((a) => a.titulo)).size).toBe(12); // sem títulos repetidos
  });
});

describe("frases de 'nenhum dado': centralizadas no card", () => {
  const vazio = dashboardBase({
    consultores: [],
    tarefas: { emRisco: [], comEstouroLiberado: [] },
    chamados: { abertosPorStatus: [], abertos: [], parados: [], totalParados: 0, porCliente: [], porArea: [], semanas: [] },
    qualidade: { diasSemApontamento: [], permissoesAntigas: [], lancamentosAtrasados: [] },
  });

  const FRASES = [
    "Nenhum consultor ativo.",
    "Nenhuma tarefa perto do limite mensal.",
    "Nenhuma tarefa com estouro liberado.",
    "Nenhum chamado em aberto.",
    "Nenhum chamado parado.",
    "Nenhum chamado aberto no mês.",
    "Nenhum dia útil sem apontamento.",
    "Nenhuma permissão antiga.",
    "Nenhum lançamento atrasado neste mês.",
  ];

  it("todas as frases de card vazio saem centralizadas (horizontal e vertical)", () => {
    tela = montar(
      <>
        <ComparativoConsultores consultores={vazio.consultores} ehMesAtual onAbrirConsultor={vi.fn()} />
        <TarefasBloco emRisco={[]} comEstouroLiberado={[]} totalEmRisco={0} totalComEstouroLiberado={0} nomeMes={vazio.nomeMes} onEditar={vi.fn()} />
        <ChamadosBloco chamados={vazio.chamados} />
        <QualidadeBloco qualidade={vazio.qualidade} onAbrirConsultor={vi.fn()} />
      </>,
    );
    const paragrafos = Array.from(tela.container.querySelectorAll("p"));

    for (const frase of FRASES) {
      const p = paragrafos.find((x) => x.textContent === frase);
      expect(p, frase).toBeDefined();
      expect(p!.className, frase).toContain("text-center"); // texto centralizado (também se quebrar em duas linhas)
      expect(p!.className, frase).toContain("justify-center"); // centralizado na horizontal do card
      expect(p!.className, frase).toContain("items-center"); // e na vertical
      expect(p!.className, frase).toContain("flex-1"); // ocupa o espaço que sobra no card
    }
  });

  it("a frase fica direto no corpo do card (filha do card), para o centro ser o do card inteiro", () => {
    tela = montar(<ChamadosBloco chamados={vazio.chamados} />);
    const p = Array.from(tela.container.querySelectorAll("p")).find((x) => x.textContent === "Nenhum chamado parado.")!;

    expect(p.parentElement?.tagName).toBe("SECTION");
    expect(p.parentElement?.className).toContain("flex-col");
  });
});

describe("card 'Chamados abertos': cor de fundo por situação (as mesmas da tabela do consultor)", () => {
  const porStatus = [
    { status: "ATRIBUIDO", quantidade: 22 },
    { status: "EM ATENDIMENTO", quantidade: 7 },
    { status: "STANDBY", quantidade: 46 },
    { status: "AGUARDANDO VALIDACAO", quantidade: 2 },
  ];
  const fichas = () => Array.from(tela!.container.querySelectorAll<HTMLElement>("button[data-situacao]"));
  const ficha = (status: string) => fichas().find((f) => f.getAttribute("data-situacao") === status)!;

  it("cada situação tem o fundo da tabela do consultor: azul, cinza, amarelo e laranja, com texto branco", () => {
    tela = montar(<ChamadosBloco chamados={{ ...dashboardBase().chamados, abertosPorStatus: porStatus }} />);

    expect(ficha("EM ATENDIMENTO").className).toContain("bg-blue-500");
    expect(ficha("ATRIBUIDO").className).toContain("bg-slate-500");
    expect(ficha("STANDBY").className).toContain("bg-yellow-500");
    expect(ficha("AGUARDANDO VALIDACAO").className).toContain("bg-orange-500");
    for (const f of fichas()) expect(f.className).toContain("text-white");
  });

  it("é o MESMO mapa de cores da tabela (fonte única): mudar lá muda aqui", () => {
    tela = montar(<ChamadosBloco chamados={{ ...dashboardBase().chamados, abertosPorStatus: porStatus }} />);

    for (const { status } of porStatus) {
      expect(corDaSituacao(status)).toBe(CORES_DA_TABELA[status as keyof typeof CORES_DA_TABELA]);
      for (const classe of CORES_DA_TABELA[status as keyof typeof CORES_DA_TABELA].split(" ")) expect(ficha(status).className).toContain(classe);
    }

    // e o selo da própria tabela do consultor usa essas mesmas classes
    tela.desmontar();
    tela = montar(<StatusBadge status="STANDBY" />);
    expect(tela.container.querySelector("span")!.className).toContain("bg-yellow-500");
  });

  it("os textos e as quantidades continuam (só o fundo mudou)", () => {
    tela = montar(<ChamadosBloco chamados={{ ...dashboardBase().chamados, abertosPorStatus: porStatus }} />);

    expect(ficha("ATRIBUIDO").textContent).toBe("22Atribuído");
    expect(ficha("EM ATENDIMENTO").textContent).toBe("7Em atendimento");
    expect(ficha("STANDBY").textContent).toBe("46StandBy");
    expect(ficha("AGUARDANDO VALIDACAO").textContent).toBe("2Aguardando validação");
  });

  it("os badges ficam centralizados só na HORIZONTAL do card (no alto, sem centralizar na vertical)", () => {
    tela = montar(<ChamadosBloco chamados={{ ...dashboardBase().chamados, abertosPorStatus: porStatus }} />);
    const lista = ficha("STANDBY").closest("ul")!;

    expect(lista.className).toContain("justify-center"); // centralizados na horizontal, também quando quebram de linha
    expect(lista.className).toContain("flex-wrap");
    // nada de centralização vertical: não ocupa o espaço que sobra nem centraliza as linhas na altura do card
    expect(lista.className).not.toContain("flex-1");
    expect(lista.className).not.toContain("content-center");
    expect(lista.parentElement?.tagName).toBe("SECTION"); // o centro horizontal é o do card inteiro
  });

  it("os badges têm profundidade e continuam com CARA de badge (pílula, relevo suave), mesmo sendo clicáveis", () => {
    tela = montar(<ChamadosBloco chamados={{ ...dashboardBase().chamados, abertosPorStatus: porStatus }} />);

    for (const f of fichas()) {
      expect(f.className).toContain("depth-badge");
      expect(f.className).toContain("rounded-full"); // pílula, como o selo da tabela (botão comum é retangular)
      // sem o relevo nem os efeitos de botão (borda escura, brilho ciano, elevação ao passar o mouse)
      expect(f.className).not.toContain("depth-btn");
      expect(f.className).not.toMatch(/hover:-translate|active:scale|hover:bg-/);
      // clicável: cursor de mão, foco visível e estado "pressionado" para leitor de tela
      expect(f.tagName).toBe("BUTTON");
      expect(f.className).toContain("cursor-pointer");
      expect(f.className).toContain("focus-visible:ring-2");
    }
  });

  it("o número fica num fundo próprio, dentro do badge, com um relevo diferente (afundado)", () => {
    tela = montar(<ChamadosBloco chamados={{ ...dashboardBase().chamados, abertosPorStatus: porStatus }} />);

    for (const f of fichas()) {
      const numero = f.querySelector<HTMLElement>("[data-contador]")!;

      expect(numero).not.toBeNull();
      expect(numero.className).toContain("depth-contador"); // fundo + relevo para dentro
      expect(numero.className).toContain("rounded-full");
      expect(numero.className).not.toContain("depth-badge"); // não é o mesmo relevo do badge
      expect(f.className).toContain("depth-badge"); // o badge continua saliente
      expect(f.firstElementChild).toBe(numero); // o número vem antes do nome da situação
    }
  });

  it("o número continua legível e alinhado (centralizado no seu fundo, mesma altura do texto)", () => {
    tela = montar(<ChamadosBloco chamados={{ ...dashboardBase().chamados, abertosPorStatus: porStatus }} />);
    const f = ficha("STANDBY");
    const numero = f.querySelector<HTMLElement>("[data-contador]")!;

    expect(numero.textContent).toBe("46");
    expect(numero.className).toContain("text-center");
    expect(numero.className).toContain("tabular-nums");
    expect(numero.className).toContain("min-w-"); // 1 e 3 dígitos ocupam fundos parecidos
    expect(f.className).toContain("items-center"); // fundo e rótulo alinhados no meio
    expect(f.textContent).toBe("46StandBy"); // os textos não mudaram
  });

  it("o relevo do número existe no CSS e é o INVERSO do relevo do badge (sombra por dentro em cima, luz por dentro embaixo)", () => {
    const css = fs.readFileSync("src/app/globals.css", "utf8");
    const contador = css.slice(css.indexOf(".depth-contador {"), css.indexOf(".dark .depth-contador {"));
    const badge = css.slice(css.indexOf(".depth-badge {"), css.indexOf(".dark .depth-badge {"));

    expect(css).toContain(".depth-contador {");
    expect(css).toContain(".dark .depth-contador {"); // versão própria para o tema escuro
    expect(contador).toContain("background-color: rgba(0, 0, 0"); // o fundo escurecido
    expect(contador).toContain("inset 0 2px 4px rgba(0, 0, 0"); // sombra interna no alto (afundado)
    expect(contador).toContain("inset 0 -1px 0 rgba(255, 255, 255"); // fio de luz embaixo
    // o badge é o oposto: luz por dentro EM CIMA e sombra por fora
    expect(badge).toContain("inset 0 1px 0 rgba(255, 255, 255");
    expect(badge).not.toContain("inset 0 2px 4px rgba(0, 0, 0");
  });

  it("situação desconhecida não quebra: cinza claro com texto escuro e o nome como veio", () => {
    tela = montar(<ChamadosBloco chamados={{ ...dashboardBase().chamados, abertosPorStatus: [{ status: "NOVA SITUACAO", quantidade: 3 }] }} />);

    expect(ficha("NOVA SITUACAO").className).toContain("bg-slate-100");
    expect(ficha("NOVA SITUACAO").className).toContain("text-slate-700");
    expect(ficha("NOVA SITUACAO").textContent).toBe("3NOVA SITUACAO");
  });
});

describe("card 'Chamados abertos': ordem fixa das situações", () => {
  const ordem = () => Array.from(tela!.container.querySelectorAll<HTMLElement>("button[data-situacao]")).map((f) => f.getAttribute("data-situacao"));

  it("ordenarSituacoes: Não iniciado, Em atendimento, Atribuído, StandBy, Aguardando validação e Finalizado", () => {
    const embaralhado = [
      { status: "FINALIZADO", quantidade: 1 },
      { status: "STANDBY", quantidade: 46 },
      { status: "AGUARDANDO VALIDACAO", quantidade: 2 },
      { status: "ATRIBUIDO", quantidade: 22 },
      { status: "NAO INICIADO", quantidade: 5 },
      { status: "EM ATENDIMENTO", quantidade: 7 },
    ];

    expect(ordenarSituacoes(embaralhado).map((s) => s.status)).toEqual(["NAO INICIADO", "EM ATENDIMENTO", "ATRIBUIDO", "STANDBY", "AGUARDANDO VALIDACAO", "FINALIZADO"]);
  });

  it("a ordem NÃO depende da quantidade (o que tem mais chamados não vem primeiro)", () => {
    tela = montar(
      <ChamadosBloco
        chamados={{
          ...dashboardBase().chamados,
          abertosPorStatus: [
            { status: "STANDBY", quantidade: 46 }, // o maior
            { status: "ATRIBUIDO", quantidade: 22 },
            { status: "EM ATENDIMENTO", quantidade: 7 },
            { status: "AGUARDANDO VALIDACAO", quantidade: 2 },
          ],
        }}
      />,
    );

    expect(ordem()).toEqual(["EM ATENDIMENTO", "ATRIBUIDO", "STANDBY", "AGUARDANDO VALIDACAO"]);
  });

  it("só aparecem as situações que têm chamados, mantendo a ordem", () => {
    tela = montar(<ChamadosBloco chamados={{ ...dashboardBase().chamados, abertosPorStatus: [{ status: "AGUARDANDO VALIDACAO", quantidade: 1 }, { status: "EM ATENDIMENTO", quantidade: 3 }] }} />);

    expect(ordem()).toEqual(["EM ATENDIMENTO", "AGUARDANDO VALIDACAO"]);
  });

  it("Não iniciado e Finalizado, se aparecerem, têm nome e lugar certos; Finalizado com o verde da tabela", () => {
    tela = montar(<ChamadosBloco chamados={{ ...dashboardBase().chamados, abertosPorStatus: [{ status: "FINALIZADO", quantidade: 4 }, { status: "NAO INICIADO", quantidade: 6 }, { status: "STANDBY", quantidade: 1 }] }} />);

    expect(ordem()).toEqual(["NAO INICIADO", "STANDBY", "FINALIZADO"]);
    const texto = (s: string) => tela!.container.querySelector(`button[data-situacao='${s}']`)!.textContent;
    expect(texto("NAO INICIADO")).toBe("6Não iniciado");
    expect(texto("FINALIZADO")).toBe("4Finalizado");
    expect(tela.container.querySelector("button[data-situacao='FINALIZADO']")!.className).toContain("bg-green-600");
  });

  it("situação desconhecida vai depois das conhecidas, da maior quantidade para a menor", () => {
    expect(
      ordenarSituacoes([
        { status: "NOVA B", quantidade: 1 },
        { status: "STANDBY", quantidade: 9 },
        { status: "NOVA A", quantidade: 5 },
      ]).map((s) => s.status),
    ).toEqual(["STANDBY", "NOVA A", "NOVA B"]);
  });

  it("não altera a lista original", () => {
    const lista = [{ status: "STANDBY", quantidade: 1 }, { status: "ATRIBUIDO", quantidade: 2 }];

    ordenarSituacoes(lista);

    expect(lista.map((s) => s.status)).toEqual(["STANDBY", "ATRIBUIDO"]);
  });
});

describe("card 'Chamados abertos': linha de baixo quando todas as situações estão no card", () => {
  const todas = [
    { status: "NAO INICIADO", quantidade: 3 },
    { status: "EM ATENDIMENTO", quantidade: 7 },
    { status: "ATRIBUIDO", quantidade: 22 },
    { status: "STANDBY", quantidade: 46 },
    { status: "AGUARDANDO VALIDACAO", quantidade: 2 },
    { status: "FINALIZADO", quantidade: 1 },
  ];
  // a lista com as quebras de linha como aparecem na tela: ["A","B","C","D","|","E","F"]
  const sequencia = () =>
    Array.from(tela!.container.querySelectorAll<HTMLElement>("button[data-situacao], li[data-quebra-de-linha]")).map((li) => (li.hasAttribute("data-quebra-de-linha") ? "|" : li.getAttribute("data-situacao")));
  const montarCom = (abertosPorStatus: { status: string; quantidade: number }[]) => {
    tela = montar(<ChamadosBloco chamados={{ ...dashboardBase().chamados, abertosPorStatus }} />);
  };

  it("temTodasAsSituacoes: só é verdade com as 6 situações presentes", () => {
    expect(temTodasAsSituacoes(todas)).toBe(true);
    expect(temTodasAsSituacoes(todas.slice(0, 5))).toBe(false);
    expect(temTodasAsSituacoes(todas.filter((s) => s.status !== "NAO INICIADO"))).toBe(false);
    expect(temTodasAsSituacoes([])).toBe(false);
    expect(temTodasAsSituacoes([...todas, { status: "NOVA", quantidade: 1 }])).toBe(true); // extra não atrapalha
  });

  it("com todas as situações: 4 na primeira linha e Aguardando validação + Finalizado na de baixo", () => {
    montarCom(todas);

    expect(sequencia()).toEqual(["NAO INICIADO", "EM ATENDIMENTO", "ATRIBUIDO", "STANDBY", "|", "AGUARDANDO VALIDACAO", "FINALIZADO"]);
  });

  it("a quebra força a linha nova (ocupa a largura toda, sem altura) e é invisível para leitor de tela", () => {
    montarCom(todas);
    const quebra = tela!.container.querySelector<HTMLElement>("li[data-quebra-de-linha]")!;

    expect(quebra.className).toContain("basis-full");
    expect(quebra.className).toContain("h-0");
    expect(quebra.getAttribute("aria-hidden")).toBe("true");
    expect(quebra.getAttribute("role")).toBe("presentation");
    expect(quebra.textContent).toBe("");
  });

  it("as duas linhas continuam centralizadas no card", () => {
    montarCom(todas);
    const lista = tela!.container.querySelector("button[data-situacao]")!.closest("ul")!;

    expect(lista.className).toContain("flex-wrap");
    expect(lista.className).toContain("justify-center");
    expect(lista.className).not.toContain("content-center");
  });

  it("situação nova (fora da lista) vem depois, também na linha de baixo", () => {
    montarCom([...todas, { status: "NOVA SITUACAO", quantidade: 4 }]);

    expect(sequencia()).toEqual(["NAO INICIADO", "EM ATENDIMENTO", "ATRIBUIDO", "STANDBY", "|", "AGUARDANDO VALIDACAO", "FINALIZADO", "NOVA SITUACAO"]);
  });

  it("faltando alguma situação, NÃO há quebra: os badges seguem numa linha só (quebrando só se faltar espaço)", () => {
    montarCom(todas.filter((s) => s.status !== "FINALIZADO"));
    expect(sequencia()).toEqual(["NAO INICIADO", "EM ATENDIMENTO", "ATRIBUIDO", "STANDBY", "AGUARDANDO VALIDACAO"]);

    tela!.desmontar();
    montarCom([{ status: "AGUARDANDO VALIDACAO", quantidade: 2 }, { status: "STANDBY", quantidade: 1 }]);
    expect(sequencia()).toEqual(["STANDBY", "AGUARDANDO VALIDACAO"]);
  });

  it("os quatro situações de hoje (sem Não iniciado nem Finalizado) continuam numa linha só", () => {
    montarCom([
      { status: "ATRIBUIDO", quantidade: 22 },
      { status: "EM ATENDIMENTO", quantidade: 7 },
      { status: "STANDBY", quantidade: 46 },
      { status: "AGUARDANDO VALIDACAO", quantidade: 2 },
    ]);

    expect(sequencia()).toEqual(["EM ATENDIMENTO", "ATRIBUIDO", "STANDBY", "AGUARDANDO VALIDACAO"]);
  });
});

describe("card 'Chamados abertos': clicar num badge abre a tabela dos chamados da situação, no próprio card", () => {
  const dash = dashboardBase();
  // fixture: 20 abertos; 15000..15011 = ATRIBUIDO (12) e 15012..15019 = STANDBY (8); cliente A nos índices pares,
  // consultor ANA nos índices múltiplos de 3 (BRUNO nos demais)
  const badge = (status: string) => tela!.container.querySelector<HTMLButtonElement>(`button[data-situacao='${status}']`);
  const regiao = () => tela!.container.querySelector<HTMLElement>("[role=region][aria-label^='Chamados:']");
  const noCabecalho = () => regiao()?.querySelector<HTMLElement>("[data-situacao-aberta]") ?? null;
  const fileira = () => Array.from(tela!.container.querySelectorAll("button[data-situacao]")).map((b) => b.getAttribute("data-situacao"));
  const linhas = () => Array.from(regiao()!.querySelectorAll("tbody tr"));
  const celulas = (linha: Element) => Array.from(linha.querySelectorAll("td")).map((td) => td.textContent);
  const codigos = () => linhas().map((l) => l.querySelector("td")!.textContent);
  const cabecalho = (texto: string) => Array.from(regiao()!.querySelectorAll<HTMLButtonElement>("thead button")).find((b) => b.textContent?.trim().startsWith(texto))!;
  const botaoFechar = () => regiao()!.querySelector<HTMLButtonElement>("button[aria-label='Fechar a lista']")!;
  const clicar = (status: string) => tela!.clicar(badge(status)!);
  const montarCard = () => {
    tela = montar(<ChamadosBloco chamados={dash.chamados} />);
  };
  // 4 situações (hoje no sistema) com 2 chamados cada
  const quatro = ["EM ATENDIMENTO", "ATRIBUIDO", "STANDBY", "AGUARDANDO VALIDACAO"];
  const comSituacoes = (situacoes: string[], porSituacao = 2) =>
    montar(
      <ChamadosBloco
        chamados={{
          ...dash.chamados,
          abertosPorStatus: situacoes.map((status) => ({ status, quantidade: porSituacao })),
          abertos: situacoes.flatMap((status, i) => Array.from({ length: porSituacao }, (_, j) => ({ codChamado: 100 * (i + 1) + j, assunto: `Assunto ${status} ${j}`, cliente: "CLIENTE", consultor: "ANA SOUZA", status }))),
        }}
      />,
    );

  it("fechado ao carregar: nenhuma tabela e todos os badges na fileira", () => {
    montarCard();

    expect(regiao()).toBeNull();
    expect(fileira()).toEqual(["ATRIBUIDO", "STANDBY"]);
  });

  it("clicar no badge abre a tabela abaixo dos badges, DENTRO do mesmo card", () => {
    montarCard();

    clicar("ATRIBUIDO");

    const r = regiao()!;
    expect(r).not.toBeNull();
    // está no card "Chamados abertos" (e não numa janela por cima), logo depois da fileira de badges
    expect(r.closest("section")!.querySelector("h3")?.textContent).toBe("Chamados abertos");
    expect(r.previousElementSibling?.tagName).toBe("UL");
    expect(document.querySelector("[role=dialog]")).toBeNull();
  });

  it("o badge clicado SOME da fileira e passa a aparecer no cabeçalho da tabela (mesmo número, nome e cor)", () => {
    montarCard();
    expect(badge("ATRIBUIDO")).not.toBeNull();

    clicar("ATRIBUIDO");

    // saiu da fileira: sobrou só o outro badge
    expect(badge("ATRIBUIDO")).toBeNull();
    expect(fileira()).toEqual(["STANDBY"]);
    // e está no cabeçalho da tabela, igual ao da fileira
    const b = noCabecalho()!;
    expect(b).not.toBeNull();
    expect(b.getAttribute("data-situacao-aberta")).toBe("ATRIBUIDO");
    expect(b.textContent).toBe("12Atribuído");
    expect(b.className).toContain("bg-slate-500"); // a cor da situação
    expect(b.className).toContain("depth-badge"); // o mesmo relevo
    expect(b.className).toContain("rounded-full");
    expect(b.querySelector("[data-contador]")!.className).toContain("depth-contador"); // número afundado, como na fileira
  });

  it("no cabeçalho o badge só informa: não é botão nem tem foco; o que fecha é o 'Fechar a lista'", () => {
    montarCard();
    clicar("STANDBY");
    const b = noCabecalho()!;

    expect(b.tagName).toBe("DIV");
    expect(b.querySelector("button, a, [tabindex]")).toBeNull();
    expect(b.className).not.toMatch(/cursor-pointer|hover:/);
    expect(regiao()!.querySelectorAll("header button")).toHaveLength(1);
    expect(botaoFechar()).toBeDefined();
    // o chip pequeno antigo (só com o nome) não existe mais
    expect(regiao()!.querySelector("header")!.textContent).toBe("8StandBy");
  });

  it("ao fechar, o badge VOLTA para a fileira, no mesmo lugar, e sai do cabeçalho", () => {
    montarCard();
    clicar("ATRIBUIDO");
    expect(fileira()).toEqual(["STANDBY"]);

    tela!.clicar(botaoFechar());

    expect(regiao()).toBeNull();
    expect(noCabecalho()).toBeNull();
    expect(fileira()).toEqual(["ATRIBUIDO", "STANDBY"]); // a ordem de antes: voltou para o lugar dele
    expect(badge("ATRIBUIDO")!.querySelector("[data-contador]")!.textContent).toBe("12");
  });

  it("volta ao lugar certo mesmo no meio da fileira (ordem fixa das situações)", () => {
    tela = comSituacoes(quatro);
    expect(fileira()).toEqual(["EM ATENDIMENTO", "ATRIBUIDO", "STANDBY", "AGUARDANDO VALIDACAO"]);

    clicar("ATRIBUIDO"); // o 2º da fileira
    expect(fileira()).toEqual(["EM ATENDIMENTO", "STANDBY", "AGUARDANDO VALIDACAO"]);

    tela.clicar(botaoFechar());
    expect(fileira()).toEqual(["EM ATENDIMENTO", "ATRIBUIDO", "STANDBY", "AGUARDANDO VALIDACAO"]);
  });

  it("o badge que volta reaparece com um fade e recebe o foco (quem usa teclado não se perde)", () => {
    montarCard();
    clicar("STANDBY");

    tela!.clicar(botaoFechar());

    expect(document.activeElement).toBe(badge("STANDBY"));
    expect(badge("STANDBY")!.closest("li")!.className).toContain("animate-modal-fade");
    // os outros badges não ganham a animação
    expect(badge("ATRIBUIDO")!.closest("li")!.className).not.toContain("animate");
  });

  it("ao abrir, o foco vai para o 'Fechar a lista' (o badge clicado sumiu e levaria o foco junto)", () => {
    montarCard();

    clicar("ATRIBUIDO");

    expect(document.activeElement).toBe(botaoFechar());
  });

  it("clicar em OUTRO badge troca a lista: o anterior volta para a fileira e o novo vai para o cabeçalho", () => {
    montarCard();
    clicar("ATRIBUIDO");
    expect(fileira()).toEqual(["STANDBY"]);

    clicar("STANDBY");

    expect(regiao()!.getAttribute("aria-label")).toBe("Chamados: StandBy");
    expect(noCabecalho()!.getAttribute("data-situacao-aberta")).toBe("STANDBY");
    expect(fileira()).toEqual(["ATRIBUIDO"]); // o Atribuído voltou; o StandBy foi para o cabeçalho
    expect(tela!.container.querySelectorAll("[role=region][aria-label^='Chamados:']")).toHaveLength(1);
    expect(document.activeElement).toBe(botaoFechar());
  });

  it("com todas as situações, abrir uma delas mantém a quebra de linha (Finalizado continua embaixo)", () => {
    tela = comSituacoes(["NAO INICIADO", "EM ATENDIMENTO", "ATRIBUIDO", "STANDBY", "AGUARDANDO VALIDACAO", "FINALIZADO"]);
    const sequencia = () => Array.from(tela!.container.querySelectorAll("button[data-situacao], li[data-quebra-de-linha]")).map((e) => (e.hasAttribute("data-quebra-de-linha") ? "|" : e.getAttribute("data-situacao")));

    clicar("AGUARDANDO VALIDACAO"); // o badge que abre a 2ª linha vai para o cabeçalho

    expect(sequencia()).toEqual(["NAO INICIADO", "EM ATENDIMENTO", "ATRIBUIDO", "STANDBY", "|", "FINALIZADO"]);

    tela.clicar(botaoFechar());
    expect(sequencia()).toEqual(["NAO INICIADO", "EM ATENDIMENTO", "ATRIBUIDO", "STANDBY", "|", "AGUARDANDO VALIDACAO", "FINALIZADO"]);
  });

  it("mostra número, cliente, assunto e consultor dos chamados DA SITUAÇÃO clicada", () => {
    montarCard();
    clicar("ATRIBUIDO");

    expect(Array.from(regiao()!.querySelectorAll("thead th")).map((th) => th.textContent?.trim().replace(/\s+/g, " ").split(" ")[0])).toEqual(["Chamado", "Cliente", "Assunto", "Consultor"]);
    expect(linhas()).toHaveLength(12);
    expect(celulas(linhas()[0])).toEqual(["15.000", "CLIENTE", "Assunto do chamado 1", "ANA SOUZA"]); // cliente: só o primeiro nome ("CLIENTE A" -> "CLIENTE")
    expect(celulas(linhas()[1])).toEqual(["15.001", "CLIENTE", "Assunto do chamado 2", "BRUNO LIMA"]);
    // só os atribuídos: nenhum dos de StandBy (15.012 em diante)
    expect(codigos()).not.toContain("15.012");
    expect(codigos()[11]).toBe("15.011");
  });

  it("singular quando há um chamado só (o número do badge no cabeçalho é 1)", () => {
    tela = montar(<ChamadosBloco chamados={{ ...dash.chamados, abertosPorStatus: [{ status: "STANDBY", quantidade: 1 }], abertos: [dash.chamados.abertos[19]] }} />);

    clicar("STANDBY");

    expect(noCabecalho()!.textContent).toBe("1StandBy");
    expect(linhas()).toHaveLength(1);
  });

  it("a quantidade do badge é a mesma da tabela (cada situação)", () => {
    montarCard();

    clicar("ATRIBUIDO");
    expect(noCabecalho()!.querySelector("[data-contador]")!.textContent).toBe("12");
    expect(linhas()).toHaveLength(12);

    clicar("STANDBY");
    expect(noCabecalho()!.querySelector("[data-contador]")!.textContent).toBe("8");
    expect(linhas()).toHaveLength(8);
  });

  it("o badge da fileira tem nome acessível com a ação e a dica 'Clique para ver os chamados'", () => {
    montarCard();

    expect(badge("ATRIBUIDO")!.getAttribute("aria-label")).toBe("12 Atribuído: ver os chamados");

    act(() => {
      badge("STANDBY")!.parentElement!.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, relatedTarget: document.body }));
    });
    expect(document.querySelector("[role=tooltip]")?.textContent).toBe("Clique para ver os chamados");
  });

  it("padrão: do chamado mais antigo para o mais novo; o cabeçalho ordena em 3 cliques (crescente, decrescente, padrão)", () => {
    montarCard();
    clicar("ATRIBUIDO");
    const primeiro = () => celulas(linhas()[0]);

    expect(codigos()[0]).toBe("15.000");
    expect(regiao()!.querySelectorAll("th[aria-sort=ascending], th[aria-sort=descending]")).toHaveLength(0);
    expect(regiao()!.querySelectorAll("thead [data-icone-ordenar=padrao]")).toHaveLength(4);

    tela!.clicar(cabecalho("Consultor")); // crescente: ANA antes de BRUNO
    expect(primeiro()[3]).toBe("ANA SOUZA");
    expect(regiao()!.querySelector("th[aria-sort=ascending]")?.textContent).toContain("▲");

    tela!.clicar(cabecalho("Consultor")); // decrescente: BRUNO primeiro
    expect(primeiro()[3]).toBe("BRUNO LIMA");
    expect(regiao()!.querySelector("th[aria-sort=descending]")?.textContent).toContain("▼");

    tela!.clicar(cabecalho("Consultor")); // padrão
    expect(codigos()[0]).toBe("15.000");
    expect(regiao()!.querySelectorAll("th[aria-sort=ascending], th[aria-sort=descending]")).toHaveLength(0);
  });

  it("ordenar por número (decrescente) e por assunto (texto, à moda pt-BR)", () => {
    montarCard();
    clicar("ATRIBUIDO");

    tela!.clicar(cabecalho("Chamado")); // crescente (= padrão, mas marcada)
    tela!.clicar(cabecalho("Chamado")); // decrescente
    expect(codigos()[0]).toBe("15.011");
    expect(codigos()[11]).toBe("15.000");

    tela!.clicar(cabecalho("Assunto")); // crescente: "Assunto do chamado 1", "...10", "...11", "...12", "...2"
    expect(celulas(linhas()[0])[2]).toBe("Assunto do chamado 1");
    expect(celulas(linhas()[1])[2]).toBe("Assunto do chamado 10");
  });

  it("ordenarAbertos: padrão pelo número; texto sem diferenciar acento/maiúscula; empate pelo número; não altera a lista", () => {
    const c = (cod: number, extra: Partial<{ cliente: string; assunto: string; consultor: string }> = {}) => ({ codChamado: cod, assunto: "A", cliente: "C", consultor: "X", status: "STANDBY", ...extra });
    const lista = [c(3, { cliente: "Zé" }), c(1, { cliente: "álamo" }), c(2, { cliente: "Zé" })];

    expect(ordenarAbertos(lista, null).map((x) => x.codChamado)).toEqual([1, 2, 3]);
    expect(ordenarAbertos(lista, { coluna: "cliente", crescente: true }).map((x) => x.codChamado)).toEqual([1, 2, 3]); // álamo < Zé; empate 2 < 3
    expect(ordenarAbertos(lista, { coluna: "cliente", crescente: false }).map((x) => x.codChamado)).toEqual([2, 3, 1]);
    expect(lista.map((x) => x.codChamado)).toEqual([3, 1, 2]);
  });

  it("a ordenação recomeça no padrão ao abrir outra situação", () => {
    montarCard();
    clicar("ATRIBUIDO");
    tela!.clicar(cabecalho("Consultor"));

    clicar("STANDBY");

    expect(regiao()!.querySelectorAll("th[aria-sort=ascending], th[aria-sort=descending]")).toHaveLength(0);
    expect(codigos()[0]).toBe("15.012");
  });

  it("o consultor aparece só com os 2 primeiros nomes (nome completo ao passar o mouse); a ordenação segue o nome completo", () => {
    const abertos = [
      { codChamado: 1, assunto: "A", cliente: "C", consultor: "MARIA DE FÁTIMA FALCÃO LIMA", status: "STANDBY" },
      { codChamado: 2, assunto: "B", cliente: "C", consultor: "DAVI TAVARES DIAMANTINO MONTALVÃO", status: "STANDBY" },
      { codChamado: 3, assunto: "C", cliente: "C", consultor: "ANA SOUZA", status: "STANDBY" },
    ];
    tela = montar(<ChamadosBloco chamados={{ ...dash.chamados, abertosPorStatus: [{ status: "STANDBY", quantidade: 3 }], abertos }} />);
    clicar("STANDBY");
    const consultores = () => linhas().map((l) => l.querySelectorAll("td")[3]);

    expect(consultores().map((td) => td.textContent)).toEqual(["MARIA DE FÁTIMA", "DAVI TAVARES", "ANA SOUZA"]);
    expect(consultores().map((td) => td.getAttribute("title"))).toEqual(["MARIA DE FÁTIMA FALCÃO LIMA", "DAVI TAVARES DIAMANTINO MONTALVÃO", "ANA SOUZA"]);

    tela.clicar(cabecalho("Consultor")); // crescente pelo nome completo: ANA, DAVI, MARIA
    expect(consultores().map((td) => td.textContent)).toEqual(["ANA SOUZA", "DAVI TAVARES", "MARIA DE FÁTIMA"]);
  });

  it("o cliente aparece só com o PRIMEIRO nome (nome completo ao passar o mouse); 'Sem cliente' fica inteiro; a ordenação segue o nome completo", () => {
    const abertos = [
      { codChamado: 1, assunto: "A", cliente: "SOMAPEL LTDA", consultor: "X", status: "STANDBY" },
      { codChamado: 2, assunto: "B", cliente: "GV PNEUS E SERVICOS SA", consultor: "X", status: "STANDBY" },
      { codChamado: 3, assunto: "C", cliente: "Sem cliente", consultor: "X", status: "STANDBY" },
      { codChamado: 4, assunto: "D", cliente: "DOX BRASIL", consultor: "X", status: "STANDBY" },
    ];
    tela = montar(<ChamadosBloco chamados={{ ...dash.chamados, abertosPorStatus: [{ status: "STANDBY", quantidade: 4 }], abertos }} />);
    clicar("STANDBY");
    const clientes = () => linhas().map((l) => l.querySelectorAll("td")[1]);

    expect(clientes().map((td) => td.textContent)).toEqual(["SOMAPEL", "GV", "Sem cliente", "DOX"]);
    expect(clientes().map((td) => td.getAttribute("title"))).toEqual(["SOMAPEL LTDA", "GV PNEUS E SERVICOS SA", "Sem cliente", "DOX BRASIL"]);

    tela.clicar(cabecalho("Cliente")); // crescente pelo nome completo: DOX BRASIL, GV PNEUS..., Sem cliente, SOMAPEL LTDA
    expect(clientes().map((td) => td.textContent)).toEqual(["DOX", "GV", "Sem cliente", "SOMAPEL"]);
  });

  it("fonte menor na tabela (para não estourar): corpo 11px e cabeçalho 10px, sem os tamanhos maiores", () => {
    montarCard();
    clicar("ATRIBUIDO");
    const tabela = regiao()!.querySelector("table")!;

    expect(tabela.className).toContain("text-[11px]");
    expect(tabela.className).not.toMatch(/\btext-xs\b|\bsm:text-sm\b/);
    expect(tabela.querySelector("thead tr")!.className).toContain("text-[10px]");
  });

  it("a lista tem rolagem própria (não estica o card) e o cabeçalho da tabela fica fixo", () => {
    montarCard();
    clicar("ATRIBUIDO");
    const rolagem = regiao()!.querySelector("table")!.parentElement!;

    expect(rolagem.className).toContain("max-h-96");
    expect(rolagem.className).toContain("overflow-auto");
    expect(regiao()!.querySelector("thead")!.className).toContain("sticky");
  });

  it("assunto e cliente longos são cortados na tela mas aparecem inteiros ao passar o mouse (title)", () => {
    const longo = { ...dash.chamados.abertos[0], cliente: "CLIENTE COM UM NOME MUITO COMPRIDO LTDA", assunto: "Um assunto enorme ".repeat(10) };
    tela = montar(<ChamadosBloco chamados={{ ...dash.chamados, abertosPorStatus: [{ status: "ATRIBUIDO", quantidade: 1 }], abertos: [{ ...longo, status: "ATRIBUIDO" }] }} />);
    clicar("ATRIBUIDO");
    const [, cliente, assunto] = Array.from(linhas()[0].querySelectorAll("td"));

    expect(cliente.textContent).toBe("CLIENTE"); // só o primeiro nome
    expect(cliente.className).toContain("truncate");
    expect(cliente.getAttribute("title")).toBe(longo.cliente); // o nome completo, ao passar o mouse
    expect(assunto.className).toContain("truncate");
    expect(assunto.getAttribute("title")).toBe(longo.assunto);
  });

  it("situação sem chamados na lista não abre tabela vazia e o badge continua na fileira", () => {
    tela = montar(<ChamadosBloco chamados={{ ...dash.chamados, abertosPorStatus: [{ status: "STANDBY", quantidade: 5 }], abertos: [] }} />);

    clicar("STANDBY");

    expect(regiao()).toBeNull();
    expect(fileira()).toEqual(["STANDBY"]); // não some à toa: não há tabela para ele ir
  });

  it("a ajuda do card explica o clique no badge e o caminho dele até o cabeçalho", async () => {
    const { AJUDAS } = await import("./ajudas");
    const texto = AJUDAS.chamadosAbertos.comoLer.join(" ");

    expect(texto).toContain("Clique num badge");
    expect(texto).toContain("número, cliente, assunto e consultor");
    expect(texto).toContain("vai para o cabeçalho da tabela");
    expect(texto).toContain("volta ao lugar dele");
  });
});

describe("botão de ajuda ('?') nos cards do painel de detalhe do consultor", () => {
  const ajudas = () => Array.from(tela!.container.querySelectorAll<HTMLButtonElement>("button[aria-label^='Como funciona:']"));
  const rotulos = () => ajudas().map((b) => b.getAttribute("aria-label"));
  const dialogo = () => document.querySelector<HTMLElement>("[role=dialog]");
  const abrirDetalhe = async () => {
    tela = montar(<PaginaFalsa />);
    await aguardar();
    tela.clicar(tela.botao("ANA SOUZA"));
    await aguardar();
  };

  it("os 11 cards do detalhe têm o botão, cada um com o nome do seu card (e na ordem em que aparecem)", async () => {
    await abrirDetalhe();

    expect(tela!.texto()).toContain("Mês do consultor");
    expect(rotulos()).toEqual([
      "Como funciona: Mês do consultor",
      "Como funciona: Comparado ao mês anterior",
      "Como funciona: Horas por dia",
      "Como funciona: SLA dos chamados",
      "Como funciona: Faturamento das horas",
      "Como funciona: Avaliações dos clientes",
      "Como funciona: Chamados abertos do consultor",
      "Como funciona: Tarefas em andamento",
      "Como funciona: Evolução",
      "Como funciona: Horas por cliente",
      "Como funciona: Horas por tarefa",
    ]);
  });

  it("o botão fica no canto direito do cabeçalho de cada card (depois do bloco do título)", async () => {
    await abrirDetalhe();

    for (const b of ajudas()) {
      const cabecalho = b.closest("header")!;
      const [titulos, area] = Array.from(cabecalho.children);

      expect(titulos.querySelector("h3")).not.toBeNull();
      expect(area.contains(b)).toBe(true);
      expect(area.className).toContain("shrink-0");
      expect(cabecalho.lastElementChild).toBe(area);
    }
  });

  it("clicar abre a janela com o resumo do card (para que serve, o que mostra e como ler)", async () => {
    await abrirDetalhe();

    tela!.clicar(ajudas().find((b) => b.getAttribute("aria-label") === "Como funciona: Horas por dia")!);

    const d = dialogo()!;
    expect(d.querySelector("h2")?.textContent).toBe("Horas por dia");
    for (const secao of ["Para que serve", "O que mostra", "Como ler"]) expect(d.textContent, secao).toContain(secao);
    expect(d.textContent).toContain("A linha tracejada é a jornada diária");
    // fecha só pelo X ou pelo Entendi (a janela é a mesma dos cards do dashboard)
    tela!.clicar(document.querySelector<HTMLElement>("[role=dialog] [aria-label='Fechar']")!);
    expect(dialogo()).toBeNull();
  });

  it("cada card explica a SUA regra (frases-chave)", async () => {
    const { AJUDAS_DO_DETALHE: A } = await import("./ajudas");
    const texto = (a: (typeof A)[keyof typeof A]) => [a.paraQueServe, ...a.oQueMostra, ...a.comoLer].join(" ");

    expect(texto(A.mesDoConsultor)).toContain("jornada diária × dias úteis");
    expect(texto(A.comparacao)).toContain("mesmo dia útil do mês anterior");
    expect(texto(A.horasPorDia)).toContain("jornada diária");
    expect(texto(A.sla)).toContain("8h às 18h");
    expect(texto(A.sla)).toContain("80%");
    expect(texto(A.faturamento)).toContain("faturáveis");
    expect(texto(A.avaliacoes)).toContain("todos os chamados avaliados");
    expect(texto(A.chamados)).toContain("mais de 7 dias");
    expect(texto(A.tarefas)).toContain("horas estimadas");
    expect(texto(A.evolucao)).toContain("últimos 6 meses");
    expect(texto(A.horasPorCliente)).toContain("8 clientes");
    expect(texto(A.horasPorTarefa)).toContain("8 tarefas");
  });

  it("todo texto de ajuda do detalhe está preenchido, com 11 títulos diferentes (e nenhum repete o dos cards do dashboard)", async () => {
    const { AJUDAS_DO_DETALHE, AJUDAS } = await import("./ajudas");
    const todas = Object.values(AJUDAS_DO_DETALHE);

    expect(todas).toHaveLength(11);
    for (const a of todas) {
      expect(a.titulo.length).toBeGreaterThan(3);
      expect(a.paraQueServe.length).toBeGreaterThan(20);
      expect(a.oQueMostra.length).toBeGreaterThan(0);
      expect(a.comoLer.length).toBeGreaterThan(0);
      for (const linha of [...a.oQueMostra, ...a.comoLer]) expect(linha.trim().length).toBeGreaterThan(10);
    }
    expect(new Set(todas.map((a) => a.titulo)).size).toBe(11);
    const titulosDoDashboard = new Set(Object.values(AJUDAS).map((a) => a.titulo));
    for (const a of todas) expect(titulosDoDashboard.has(a.titulo), a.titulo).toBe(false);
  });
});

describe("Meu Painel do consultor continua SEM botão de ajuda (o botão é só do painel do administrador)", () => {
  it("Cartao sem 'acao': cabeçalho com só o bloco do título, como antes", () => {
    tela = montar(
      <Cartao titulo="Título" subtitulo="Sub">
        <p>conteúdo</p>
      </Cartao>,
    );
    const cabecalho = tela.container.querySelector("header")!;

    expect(cabecalho.children).toHaveLength(1);
    expect(cabecalho.textContent).toBe("TítuloSub");
    expect(tela.container.querySelector("button")).toBeNull();
  });

  it("Cartao com 'acao': mostra a ação à direita do título", () => {
    tela = montar(
      <Cartao titulo="Título" acao={<button type="button">Ação</button>}>
        <p>conteúdo</p>
      </Cartao>,
    );
    const cabecalho = tela.container.querySelector("header")!;

    expect(cabecalho.children).toHaveLength(2);
    expect(cabecalho.lastElementChild!.textContent).toBe("Ação");
  });

  it("Comparacao e Resultado do Meu Painel, sem as ações, não têm nenhum botão de ajuda", () => {
    tela = montar(
      <>
        <ComparacaoDoMeuPainel dados={painelBase()} />
        <ResultadoDoMeuPainel dados={painelBase()} />
      </>,
    );

    expect(tela.container.querySelectorAll("button[aria-label^='Como funciona:']")).toHaveLength(0);
    expect(tela.container.querySelectorAll("button")).toHaveLength(0);
    // e continuam falando em primeira pessoa (o consultor vendo o próprio painel)
    expect(tela.texto()).toContain("SLA dos meus chamados");
  });

  it("Comparacao e Resultado repassam as ações ao cabeçalho de cada cartão quando elas são dadas", () => {
    tela = montar(
      <>
        <ComparacaoDoMeuPainel dados={painelBase()} acao={<button type="button">A1</button>} />
        <ResultadoDoMeuPainel dados={painelBase()} deOutro acoes={{ sla: <button type="button">A2</button>, faturamento: <button type="button">A3</button>, avaliacoes: <button type="button">A4</button> }} />
      </>,
    );

    expect(Array.from(tela.container.querySelectorAll("header button")).map((b) => b.textContent)).toEqual(["A1", "A2", "A3", "A4"]);
  });
});
