import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import AvisoChamadosNovos from "./AvisoChamadosNovos";
import { montar } from "./painel/painel.fixture";
import { chaves } from "@/hooks/queries/chaves";

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { recurso: 122 } } }),
}));

let tela: ReturnType<typeof montar> | null = null;

const lista = (...codigos: number[]) => codigos.map((COD_CHAMADO) => ({ COD_CHAMADO }));
const resposta = (corpo: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(corpo) } as Response);
const aguardar = async () => {
  for (let i = 0; i < 5; i++) await act(async () => new Promise((r) => setTimeout(r, 5)));
};

// a "API" devolve a lista corrente (alterada pelo teste para simular chegada de chamado)
let chamadosNoServidor: { COD_CHAMADO: number }[] = [];

beforeEach(() => {
  chamadosNoServidor = lista(1, 2);
  vi.stubGlobal("fetch", vi.fn(() => resposta(chamadosNoServidor)));
});

afterEach(() => {
  tela?.desmontar();
  tela = null;
  vi.unstubAllGlobals();
});

async function chegouOutraBusca() {
  // o que o intervalo de 3 min faz: busca de novo
  await act(async () => {
    await tela!.cliente.invalidateQueries({ queryKey: chaves.chamados(122) });
  });
  await aguardar();
}

describe("AvisoChamadosNovos", () => {
  it("a lista inicial é só a base: abrir a Home não avisa dos chamados que já existiam", async () => {
    tela = montar(<AvisoChamadosNovos onVer={vi.fn()} />);
    await aguardar();

    expect(tela.container.querySelector("[role=status]")).toBeNull();
  });

  it("chegou um chamado novo: avisa com o número", async () => {
    tela = montar(<AvisoChamadosNovos onVer={vi.fn()} />);
    await aguardar();

    chamadosNoServidor = lista(1, 2, 15200);
    await chegouOutraBusca();

    expect(tela.texto()).toContain("Chegou um chamado novo para você: #15200.");
  });

  it("mesma lista de novo não avisa; novos seguintes se somam ao aviso", async () => {
    tela = montar(<AvisoChamadosNovos onVer={vi.fn()} />);
    await aguardar();

    await chegouOutraBusca();
    expect(tela.container.querySelector("[role=status]")).toBeNull();

    chamadosNoServidor = lista(1, 2, 3);
    await chegouOutraBusca();
    chamadosNoServidor = lista(1, 2, 3, 4);
    await chegouOutraBusca();

    expect(tela.texto()).toContain("Chegaram 2 chamados novos para você: #3, #4.");
  });

  it("'Ver chamados' navega e some; 'Dispensar' só some; o mesmo chamado não é avisado de novo", async () => {
    const onVer = vi.fn();
    tela = montar(<AvisoChamadosNovos onVer={onVer} />);
    await aguardar();

    chamadosNoServidor = lista(1, 2, 3);
    await chegouOutraBusca();
    tela.clicar(tela.botao("Ver chamados"));

    expect(onVer).toHaveBeenCalledTimes(1);
    expect(tela.container.querySelector("[role=status]")).toBeNull();

    await chegouOutraBusca(); // continua com o #3: já foi avisado
    expect(tela.container.querySelector("[role=status]")).toBeNull();

    chamadosNoServidor = lista(1, 2, 3, 9);
    await chegouOutraBusca();
    tela.clicar(tela.botao("Dispensar"));
    expect(tela.container.querySelector("[role=status]")).toBeNull();
  });

  it("falha na checagem não mostra aviso nem erro", async () => {
    tela = montar(<AvisoChamadosNovos onVer={vi.fn()} />);
    await aguardar();

    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ error: "x" }) } as Response)));
    await chegouOutraBusca();

    expect(tela.texto()).toBe("");
  });
});
