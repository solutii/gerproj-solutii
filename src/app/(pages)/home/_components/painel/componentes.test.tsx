import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import Comparacao from "./Comparacao";
import Hoje from "./Hoje";
import MeusChamados from "./MeusChamados";
import Pendencias from "./Pendencias";
import ResumoMes from "./ResumoMes";
import TarefasAndamento from "./TarefasAndamento";
import { montar, painelBase } from "./painel.fixture";

let tela: ReturnType<typeof montar> | null = null;

afterEach(() => {
  tela?.desmontar();
  tela = null;
});

describe("Hoje", () => {
  it("lista as OS de hoje e a falta para a jornada", () => {
    tela = montar(<Hoje dados={painelBase()} onApontarEm={vi.fn()} />);

    expect(tela.texto()).toContain("08:00–09:00");
    expect(tela.texto()).toContain("Faltam 7hs:48min para completar a jornada de 8hs:48min");
  });

  it("clicar num horário livre prepara o apontamento de hoje naquele horário", () => {
    const onApontarEm = vi.fn();
    tela = montar(<Hoje dados={painelBase()} onApontarEm={onApontarEm} />);

    tela.clicar(tela.botao("Apontar hoje das 09:00 às 10:30"));

    expect(onApontarEm).toHaveBeenCalledWith("2026-10-02", "09:00", "10:30");
  });

  it("'Apontar hoje' só passa a data", () => {
    const onApontarEm = vi.fn();
    tela = montar(<Hoje dados={painelBase()} onApontarEm={onApontarEm} />);

    tela.clicar(tela.botao(/^Apontar hoje$/));

    expect(onApontarEm).toHaveBeenCalledWith("2026-10-02");
  });

  it("sem OS e sem horários livres mostra mensagens claras e não oferece horários", () => {
    const base = painelBase();
    tela = montar(
      <Hoje
        dados={painelBase({ hojeBloco: { ...base.hojeBloco, osDeHoje: [], minutosHoje: 0, livres: [] } })}
        onApontarEm={vi.fn()}
      />,
    );

    expect(tela.texto()).toContain("Nenhuma OS lançada hoje.");
    expect(tela.texto()).toContain("Sem horários livres até agora.");
    expect(tela.botao("Apontar hoje das")).toBeUndefined();
  });

  it("jornada completa troca o aviso de falta", () => {
    const base = painelBase();
    tela = montar(<Hoje dados={painelBase({ hojeBloco: { ...base.hojeBloco, faltaJornadaMin: 0 } })} onApontarEm={vi.fn()} />);

    expect(tela.texto()).toContain("Jornada de hoje completa.");
  });
});

describe("ResumoMes", () => {
  it("dia sem apontamento dentro do prazo é clicável e envia a data", () => {
    const onApontarEm = vi.fn();
    tela = montar(<ResumoMes dados={painelBase()} onApontarEm={onApontarEm} />);

    tela.clicar(tela.botao("Apontar em 01/10/2026"));

    expect(onApontarEm).toHaveBeenCalledWith("2026-10-01");
  });

  it("dia anterior ao limite de apontamento fica desabilitado e não dispara", () => {
    const onApontarEm = vi.fn();
    tela = montar(<ResumoMes dados={painelBase({ apontarAPartirDe: "2026-10-01" })} onApontarEm={onApontarEm} />);

    const fora = tela.botao("fora do prazo para apontar");

    expect(fora?.disabled).toBe(true);
    tela.clicar(fora);
    expect(onApontarEm).not.toHaveBeenCalled();
  });

  it("mostra a projeção no ritmo atual e, abaixo da meta, o quanto falta por dia", () => {
    const base = painelBase();
    tela = montar(
      <ResumoMes
        dados={painelBase({
          projecao: { ...base.projecao!, situacao: "abaixo", projecaoMesMin: 6000, necessarioPorDiaMin: 600, faltaParaMetaMin: 12000 },
        })}
        onApontarEm={vi.fn()}
      />,
    );

    expect(tela.texto()).toContain("No ritmo atual");
    expect(tela.texto()).toContain("Abaixo da meta");
    expect(tela.texto()).toContain("10hs:00min por dia nos 20 dias úteis restantes");
  });

  it("com média zero não fala em 'ritmo' e diz quanto é preciso por dia", () => {
    const base = painelBase();
    tela = montar(
      <ResumoMes
        dados={painelBase({
          projecao: { ...base.projecao!, mediaDiariaMin: 0, projecaoMesMin: 0, situacao: "abaixo", necessarioPorDiaMin: 554 },
        })}
        onApontarEm={vi.fn()}
      />,
    );

    expect(tela.texto()).toContain("Nenhuma hora apontada neste mês ainda");
    expect(tela.texto()).not.toContain("No ritmo atual");
  });

  it("mês fechado não mostra projeção", () => {
    tela = montar(<ResumoMes dados={painelBase({ ehMesAtual: false, projecao: null })} onApontarEm={vi.fn()} />);

    expect(tela.texto()).not.toContain("No ritmo atual");
  });
});

describe("Pendencias", () => {
  const acoes = () => ({ onIrParaChamado: vi.fn(), onIrParaTarefa: vi.fn(), onVerOsDoDia: vi.fn() });

  it("chamado parado abre o chamado", () => {
    const a = acoes();
    tela = montar(<Pendencias dados={painelBase()} {...a} />);

    tela.clicar(tela.botao("#300"));

    expect(a.onIrParaChamado).toHaveBeenCalledWith(300);
  });

  it("tarefa da aba Tarefas é clicável; a que não está na aba é só texto", () => {
    const a = acoes();
    tela = montar(<Pendencias dados={painelBase()} {...a} />);

    tela.clicar(tela.botao("Migração"));
    expect(a.onIrParaTarefa).toHaveBeenCalledWith(10);

    expect(tela.botao("Fora da aba")).toBeUndefined();
    expect(tela.texto()).toContain("Fora da aba");
  });

  it("OS contestada lista as OS do dia", () => {
    const a = acoes();
    tela = montar(<Pendencias dados={painelBase()} {...a} />);

    tela.clicar(tela.botao("OS 7"));

    expect(a.onVerOsDoDia).toHaveBeenCalledWith("2026-10-01");
  });
});

describe("MeusChamados", () => {
  it("mostra contadores por status e abre o chamado clicado", () => {
    const onIrParaChamado = vi.fn();
    tela = montar(<MeusChamados dados={painelBase()} onIrParaChamado={onIrParaChamado} />);

    expect(tela.texto()).toContain("2 · StandBy");
    expect(tela.texto()).toContain("há 5 dias aguardando");

    tela.clicar(tela.botao("#200"));
    tela.clicar(tela.botao("#100"));

    expect(onIrParaChamado).toHaveBeenNthCalledWith(1, 200);
    expect(onIrParaChamado).toHaveBeenNthCalledWith(2, 100);
  });

  it("sem chamados em aberto mostra mensagem vazia", () => {
    tela = montar(
      <MeusChamados
        dados={painelBase({ chamados: { porStatus: [], maisAntigos: [], aguardandoValidacao: [] } })}
        onIrParaChamado={vi.fn()}
      />,
    );

    expect(tela.texto()).toContain("Nenhum chamado em aberto.");
  });
});

describe("TarefasAndamento", () => {
  it("mostra o percentual, 'passou do estimado' e o prazo vencido só como informação", () => {
    tela = montar(<TarefasAndamento dados={painelBase()} onIrParaTarefa={vi.fn()} />);

    expect(tela.texto()).toContain("75%");
    expect(tela.texto()).toContain("passou do estimado");
    expect(tela.texto()).toContain("vencido há 124 dias");
    expect(tela.texto()).toContain("sem estimativa");
  });

  it("a barra nunca passa de 100% e clicar abre a tarefa", () => {
    const onIrParaTarefa = vi.fn();
    tela = montar(<TarefasAndamento dados={painelBase()} onIrParaTarefa={onIrParaTarefa} />);

    const barras = Array.from(tela.container.querySelectorAll("[role=progressbar]"));

    expect(barras.map((b) => b.getAttribute("aria-valuenow"))).toEqual(["75", "100"]);

    tela.clicar(tela.botao("Estourada"));
    expect(onIrParaTarefa).toHaveBeenCalledWith(11);
  });
});

describe("Comparacao", () => {
  it("mostra a variação com seta e o texto do período", () => {
    tela = montar(<Comparacao dados={painelBase()} />);

    expect(tela.texto()).toContain("Comparado a setembro de 2026");
    expect(tela.texto()).toContain("▲ 25%");
    expect(tela.texto()).toContain("▼ 25%");
    expect(tela.texto()).toContain("até o mesmo dia útil");
    // SLA: 90 contra 80 = +10 pontos
    expect(tela.texto()).toContain("▲ 10%");
  });

  it("sem base de comparação não inventa variação", () => {
    const base = painelBase();
    tela = montar(
      <Comparacao
        dados={painelBase({
          comparacao: {
            ...base.comparacao,
            horas: { atualMin: 60, anteriorMin: 0, variacao: null },
            sla: { atualPercentual: null, anteriorPercentual: null },
          },
        })}
      />,
    );

    expect(tela.texto()).toContain("sem base");
  });
});

// garante que o act do React está disponível neste ambiente de teste
it("ambiente de teste de tela está pronto", () => {
  expect(typeof act).toBe("function");
});
