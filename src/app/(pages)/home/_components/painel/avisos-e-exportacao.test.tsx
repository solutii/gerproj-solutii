import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import AvisoDiasPendentes from "../AvisoDiasPendentes";
import ExportarEspelho from "./ExportarEspelho";
import { montar } from "./painel.fixture";

// o aviso e os hooks pedem o consultor da sessão
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { recurso: 122 } } }),
}));

let tela: ReturnType<typeof montar> | null = null;

const resposta = (corpo: unknown, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(corpo) } as Response);
// deixa o Query concluir a busca e a tela atualizar (várias voltas do laço de eventos)
const aguardar = async () => {
  for (let i = 0; i < 5; i++) await act(async () => new Promise((r) => setTimeout(r, 5)));
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  tela?.desmontar();
  tela = null;
  vi.unstubAllGlobals();
});

describe("ExportarEspelho", () => {
  const espelho = {
    consultor: "FULANO",
    nomeMes: "setembro de 2026",
    totalMin: 90,
    linhas: [
      { data: "2026-09-01", inicio: "09:00", fim: "10:30", minutos: 90, cliente: "A", tarefa: "T", chamado: "", codOs: 1, descricao: "Ajuste" },
    ],
  };

  it("baixa o CSV do mês pedido", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockReturnValue(resposta(espelho));
    const criar = vi.fn(() => "blob:teste");
    const revogar = vi.fn();
    Object.assign(URL, { createObjectURL: criar, revokeObjectURL: revogar });
    const baixados: string[] = [];
    const clique = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      baixados.push(this.download);
    });
    const onErro = vi.fn();

    tela = montar(<ExportarEspelho mes="2026-09" nomeMes="setembro de 2026" onErro={onErro} />);
    tela.clicar(tela.botao("Baixar Excel"));
    await aguardar();

    expect(fetchMock.mock.calls[0][0]).toBe("/api/painel/espelho?mes=2026-09");
    expect(baixados).toEqual(["espelho-2026-09.csv"]);
    expect(revogar).toHaveBeenCalledWith("blob:teste");
    expect(onErro).not.toHaveBeenCalled();
    clique.mockRestore();
  });

  it("mês sem OS avisa em vez de baixar um arquivo vazio", async () => {
    vi.mocked(fetch).mockReturnValue(resposta({ ...espelho, linhas: [], totalMin: 0 }));
    const clique = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const onErro = vi.fn();

    tela = montar(<ExportarEspelho mes="2026-09" nomeMes="setembro de 2026" onErro={onErro} />);
    tela.clicar(tela.botao("Baixar Excel"));
    await aguardar();

    expect(onErro).toHaveBeenCalledWith("Não há OS lançadas em setembro de 2026 para exportar.");
    expect(clique).not.toHaveBeenCalled();
    clique.mockRestore();
  });

  it("erro do servidor chega ao usuário e libera os botões", async () => {
    vi.mocked(fetch).mockReturnValue(resposta({ error: "Erro interno" }, false));
    const onErro = vi.fn();

    tela = montar(<ExportarEspelho mes="2026-09" nomeMes="setembro de 2026" onErro={onErro} />);
    tela.clicar(tela.botao("Baixar Excel"));
    await aguardar();

    expect(onErro).toHaveBeenCalledWith("Erro interno");
    expect(tela.botao("Baixar Excel")?.disabled).toBe(false);
  });
});

describe("AvisoDiasPendentes", () => {
  it("sem dias pendentes não mostra nada", async () => {
    vi.mocked(fetch).mockReturnValue(resposta({ hoje: "2026-10-02", dias: [] }));

    tela = montar(<AvisoDiasPendentes onApontarEm={vi.fn()} onVerPainel={vi.fn()} />);
    await aguardar();

    expect(tela.container.querySelector("[role=status]")).toBeNull();
  });

  it("falha na busca não mostra aviso nem erro", async () => {
    vi.mocked(fetch).mockReturnValue(resposta({ error: "x" }, false));

    tela = montar(<AvisoDiasPendentes onApontarEm={vi.fn()} onVerPainel={vi.fn()} />);
    await aguardar();

    expect(tela.texto()).toBe("");
  });

  it("lista os dias, apontar abre o mais antigo e 'Ver no painel' navega", async () => {
    vi.mocked(fetch).mockReturnValue(resposta({ hoje: "2026-10-02", dias: ["2026-09-30", "2026-10-01"] }));
    const onApontarEm = vi.fn();
    const onVerPainel = vi.fn();

    tela = montar(<AvisoDiasPendentes onApontarEm={onApontarEm} onVerPainel={onVerPainel} />);
    await aguardar();

    expect(tela.texto()).toContain("Você tem 2 dias úteis sem apontamento: 30/09, 01/10.");

    tela.clicar(tela.botao("Apontar em 30/09"));
    tela.clicar(tela.botao("Ver no painel"));

    expect(onApontarEm).toHaveBeenCalledWith("2026-09-30");
    expect(onVerPainel).toHaveBeenCalled();
  });

  it("muitos dias: mostra os primeiros e o resto em '+N'", async () => {
    const dias = ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-28", "2026-09-29"];
    vi.mocked(fetch).mockReturnValue(resposta({ hoje: "2026-10-02", dias }));

    tela = montar(<AvisoDiasPendentes onApontarEm={vi.fn()} onVerPainel={vi.fn()} />);
    await aguardar();

    expect(tela.texto()).toContain("Você tem 7 dias úteis sem apontamento: 21/09, 22/09, 23/09, 24/09, 25/09 e mais 2.");
  });

  // por último: "Dispensar" vale até recarregar a página (estado do módulo)
  it("Dispensar esconde o aviso e ele não volta ao remontar", async () => {
    vi.mocked(fetch).mockReturnValue(resposta({ hoje: "2026-10-02", dias: ["2026-10-01"] }));

    tela = montar(<AvisoDiasPendentes onApontarEm={vi.fn()} onVerPainel={vi.fn()} />);
    await aguardar();
    expect(tela.texto()).toContain("Você tem 1 dia útil sem apontamento");

    tela.clicar(tela.botao("Dispensar"));
    expect(tela.container.querySelector("[role=status]")).toBeNull();

    tela.desmontar();
    tela = montar(<AvisoDiasPendentes onApontarEm={vi.fn()} onVerPainel={vi.fn()} />);
    await aguardar();

    expect(tela.container.querySelector("[role=status]")).toBeNull();
  });
});
