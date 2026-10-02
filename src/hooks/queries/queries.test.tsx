import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { useHomeStore } from "@/stores/home-store";
import { aguardar, clienteParaTeste, montarHook, respostaJson } from "@/test/hook-harness";
import { chaves } from "./chaves";
import { alvoDasOs, useChamados, useHorariosOcupados, useOsLista, usePendentes, useTarefas } from "./leituras";
import { useColocarEmStandby, useExcluirOs, useIniciarChamado, useRegistrarApontamento } from "./mutacoes";

// consultor da sessão (mudado por teste quando preciso)
const sessao = vi.hoisted(() => ({ recurso: 122 as number | undefined }));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: sessao.recurso === undefined ? null : { user: { recurso: sessao.recurso } } }),
}));

const ESTADO_INICIAL = useHomeStore.getState();

// um fetch que responde conforme a rota e conta as chamadas
// `rotas`: resposta por prefixo de URL; `status`: status HTTP por prefixo (padrão 200).
// Os dois podem ser alterados no meio do teste.
function servidor(rotas: Record<string, unknown>) {
  const chamadas: string[] = [];
  const status: Record<string, number> = {};
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    chamadas.push(`${init?.method ?? "GET"} ${url}`);
    const chave = Object.keys(rotas).find((r) => url.startsWith(r));
    const codigo = Object.keys(status).find((r) => url.startsWith(r));

    return respostaJson(chave ? rotas[chave] : [], codigo ? status[codigo] : 200);
  });
  vi.stubGlobal("fetch", fetchMock);

  return {
    chamadas,
    fetchMock,
    rotas,
    status,
    quantas: (trecho: string) => chamadas.filter((c) => c.includes(trecho)).length,
    // chamadas exatamente iguais (ex.: "POST /api/os/list" não conta "/api/os/list-for-trf")
    exatas: (chamada: string) => chamadas.filter((c) => c === chamada).length,
  };
}

beforeEach(() => {
  sessao.recurso = 122;
  useHomeStore.setState(ESTADO_INICIAL, true);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("não busca à toa", () => {
  it("remontar a tela dentro do tempo de cache NÃO refaz a requisição", async () => {
    const api = servidor({ "/api/call/list": [{ COD_CHAMADO: 1 }] });
    const cliente = clienteParaTeste({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } });

    const primeira = montarHook(() => useChamados(), cliente);
    await aguardar();
    expect(primeira.resultado().data).toEqual([{ COD_CHAMADO: 1 }]);
    primeira.desmontar();

    // o usuário troca de aba e volta: o mesmo dado aparece na hora
    const segunda = montarHook(() => useChamados(), cliente);
    expect(segunda.resultado().data).toEqual([{ COD_CHAMADO: 1 }]);
    await aguardar();

    expect(api.quantas("/api/call/list")).toBe(1);
    segunda.desmontar();
  });

  it("dois componentes pedindo o mesmo dado ao mesmo tempo geram uma só requisição", async () => {
    const api = servidor({ "/api/os/list?recurso": [{ COD_TAREFA: 7 }] });
    const cliente = clienteParaTeste();

    const a = montarHook(() => useTarefas(), cliente);
    const b = montarHook(() => useTarefas(), cliente);
    await aguardar();

    expect(api.quantas("/api/os/list?recurso")).toBe(1);
    a.desmontar();
    b.desmontar();
  });

  it("sem consultor na sessão nenhuma busca é feita", async () => {
    sessao.recurso = undefined;
    const api = servidor({});
    const cliente = clienteParaTeste();

    const h = montarHook(() => ({ c: useChamados(), t: useTarefas(), p: usePendentes() }), cliente);
    await aguardar();

    expect(api.fetchMock).not.toHaveBeenCalled();
    h.desmontar();
  });

  it("o cache de um consultor não é reaproveitado por outro", async () => {
    const api = servidor({ "/api/call/list": [] });
    const cliente = clienteParaTeste({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } });

    const h1 = montarHook(() => useChamados(), cliente);
    await aguardar();
    h1.desmontar();

    sessao.recurso = 999;
    const h2 = montarHook(() => useChamados(), cliente);
    await aguardar();

    expect(api.quantas("recurso=122")).toBe(1);
    expect(api.quantas("recurso=999")).toBe(1);
    h2.desmontar();
  });
});

describe("lista de OS", () => {
  const chamado = { COD_CHAMADO: 15102 } as any;
  const tarefa = { COD_TAREFA: "1099" } as any;

  it("alvoDasOs: chamado > tarefa > data > nada", () => {
    expect(alvoDasOs({ selectedCall: chamado, selectedProj: null, selectedDate: "" })).toEqual({ tipo: "chamado", codigo: 15102 });
    expect(alvoDasOs({ selectedCall: null, selectedProj: tarefa, selectedDate: "" })).toEqual({ tipo: "tarefa", codigo: "1099" });
    expect(alvoDasOs({ selectedCall: null, selectedProj: null, selectedDate: "2026-09-01" })).toEqual({ tipo: "data", data: "2026-09-01" });
    expect(alvoDasOs({ selectedCall: null, selectedProj: null, selectedDate: "" })).toBeNull();
  });

  it("sem seleção não há requisição nem lista", async () => {
    const api = servidor({});
    const h = montarHook(() => useOsLista(), clienteParaTeste());
    await aguardar();

    expect(h.resultado().lista).toEqual([]);
    expect(api.fetchMock).not.toHaveBeenCalled();
    h.desmontar();
  });

  it("chamado selecionado busca as OS do chamado; voltar a ele depois usa o cache", async () => {
    const api = servidor({ "/api/os/list": [{ COD_OS: 1 }], "/api/os/list-for-trf": [{ COD_OS: 2 }] });
    const cliente = clienteParaTeste({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } });
    const h = montarHook(() => useOsLista(), cliente);

    act(() => useHomeStore.getState().setSelectedCall(chamado));
    await aguardar();
    expect(h.resultado().lista).toEqual([{ COD_OS: 1 }]);
    expect(JSON.parse(api.fetchMock.mock.calls[0][1]!.body as string)).toEqual({ chamado: 15102, data: "", recurso: 122 });

    // troca para uma tarefa (outra rota)...
    act(() => {
      useHomeStore.getState().setSelectedCall(null);
      useHomeStore.getState().setSelectedProj(tarefa);
    });
    await aguardar();
    expect(api.quantas("/api/os/list-for-trf")).toBe(1);

    // ...e volta ao chamado: aparece na hora, sem nova requisição
    act(() => {
      useHomeStore.getState().setSelectedProj(null);
      useHomeStore.getState().setSelectedCall(chamado);
    });
    expect(h.resultado().lista).toEqual([{ COD_OS: 1 }]);
    await aguardar();
    expect(api.exatas("POST /api/os/list")).toBe(1);
    h.desmontar();
  });

  it("filtro por data busca por data; desmarcar tudo esvazia a lista", async () => {
    const api = servidor({ "/api/os/list": [{ COD_OS: 9 }] });
    const h = montarHook(() => useOsLista(), clienteParaTeste());

    act(() => useHomeStore.getState().setSelectedDate("2026-09-01"));
    await aguardar();
    expect(JSON.parse(api.fetchMock.mock.calls[0][1]!.body as string)).toEqual({ data: "2026-09-01", recurso: 122 });
    expect(h.resultado().lista).toEqual([{ COD_OS: 9 }]);

    act(() => useHomeStore.getState().setSelectedDate(""));
    await aguardar();
    expect(h.resultado().lista).toEqual([]);
    h.desmontar();
  });

  it("erro do servidor aparece como erro (sem derrubar a tela) e a lista fica vazia", async () => {
    vi.stubGlobal("fetch", vi.fn(() => respostaJson({ error: "Falha no banco" }, 500)));
    const h = montarHook(() => useOsLista(), clienteParaTeste());

    act(() => useHomeStore.getState().setSelectedCall(chamado));
    await aguardar();

    expect(h.resultado().lista).toEqual([]);
    expect((h.resultado().erro as Error).message).toBe("Falha no banco");
    h.desmontar();
  });
});

describe("horários ocupados (modais de apontamento)", () => {
  const osDoDia = [
    { COD_OS: 1, HRINI_OS: "0900", HRFIM_OS: "1000" },
    { COD_OS: 2, HRINI_OS: "1400", HRFIM_OS: "1500" },
  ];

  it("com o modal fechado não faz requisição", async () => {
    const api = servidor({ "/api/os/list": osDoDia });
    const h = montarHook(() => useHorariosOcupados(false), clienteParaTeste());
    await aguardar();

    expect(api.fetchMock).not.toHaveBeenCalled();
    h.desmontar();
  });

  it("busca as OS da data escolhida e devolve os intervalos ocupados", async () => {
    const api = servidor({ "/api/os/list": osDoDia });
    act(() => useHomeStore.getState().setDate("2026-09-10"));
    const h = montarHook(() => useHorariosOcupados(true), clienteParaTeste());
    await aguardar();

    expect(JSON.parse(api.fetchMock.mock.calls[0][1]!.body as string)).toEqual({ data: "2026-09-10", recurso: 122 });
    expect(h.resultado().ocupados.map((o) => `${o.inicio}-${o.fim}`)).toEqual(["09:00-10:00", "14:00-15:00"]);
    expect(h.resultado().conflito).toBeNull();
    h.desmontar();
  });

  it("detecta conflito do intervalo escolhido; encostar não conta", async () => {
    servidor({ "/api/os/list": osDoDia });
    act(() => {
      useHomeStore.getState().setDate("2026-09-10");
      useHomeStore.getState().setHours({ initial: "09:30", final: "10:30" });
    });
    const h = montarHook(() => useHorariosOcupados(true), clienteParaTeste());
    await aguardar();

    expect(h.resultado().conflito?.codOs).toBe(1);

    act(() => useHomeStore.getState().setHours({ initial: "10:00", final: "11:00" }));
    await aguardar();
    expect(h.resultado().conflito).toBeNull();
    h.desmontar();
  });

  it("na edição, a própria OS não conta como ocupada", async () => {
    servidor({ "/api/os/list": osDoDia });
    act(() => {
      useHomeStore.getState().setDate("2026-09-10");
      useHomeStore.getState().setSelectedOs({ COD_OS: 1 });
      useHomeStore.getState().setHours({ initial: "09:00", final: "10:00" });
    });
    const h = montarHook(() => useHorariosOcupados(true), clienteParaTeste());
    await aguardar();

    expect(h.resultado().conflito).toBeNull();
    expect(h.resultado().ocupados.map((o) => o.codOs)).toEqual([2]);
    h.desmontar();
  });

  it("falha ao buscar não bloqueia nada (o servidor continua validando)", async () => {
    vi.stubGlobal("fetch", vi.fn(() => respostaJson({ error: "x" }, 500)));
    act(() => {
      useHomeStore.getState().setDate("2026-09-10");
      useHomeStore.getState().setHours({ initial: "09:00", final: "10:00" });
    });
    const h = montarHook(() => useHorariosOcupados(true), clienteParaTeste());
    await aguardar();

    expect(h.resultado().ocupados).toEqual([]);
    expect(h.resultado().conflito).toBeNull();
    h.desmontar();
  });
});

describe("depois de gravar, atualiza só o que mudou", () => {
  // tela com chamados e pendentes ATIVOS e tarefas/painel do mês já em cache mas fora da tela
  async function prepararTela() {
    const api = servidor({ "/api/call/list": [], "/api/painel/pendentes": { hoje: "2026-10-02", dias: [] }, "/api/call/start": { ok: true }, "/api/os/apoint": { ok: true }, "/api/call/standby": { ok: true }, "/api/os/delete": { ok: true } });
    const cliente = clienteParaTeste({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } });

    cliente.setQueryData(chaves.tarefas(122), [{ COD_TAREFA: 1 }]);
    cliente.setQueryData(chaves.painel(122, "2026-10"), { mes: "2026-10" });

    const tela = montarHook(() => ({ c: useChamados(), p: usePendentes() }), cliente);
    await aguardar();
    api.fetchMock.mockClear();
    api.chamadas.length = 0;

    return { api, cliente, tela };
  }

  it("iniciar chamado: refaz chamados (na tela) e pendentes (na tela); não busca tarefas", async () => {
    const { api, cliente, tela } = await prepararTela();
    const mutacao = montarHook(() => useIniciarChamado(), cliente);

    await act(async () => {
      await mutacao.resultado().mutateAsync(15102);
    });
    await aguardar();

    expect(api.quantas("/api/call/list")).toBe(1);
    expect(api.quantas("/api/painel/pendentes")).toBe(1);
    expect(api.quantas("/api/os/list?recurso")).toBe(0); // tarefas intactas
    expect(cliente.getQueryState(chaves.tarefas(122))?.isInvalidated).toBe(false);
    // o painel do mês não está aberto: fica marcado como velho e é buscado só quando abrir
    expect(cliente.getQueryState(chaves.painel(122, "2026-10"))?.isInvalidated).toBe(true);
    expect(api.quantas("/api/painel?mes")).toBe(0);

    mutacao.desmontar();
    tela.desmontar();
  });

  it("registrar apontamento: lista de OS e painel atualizam; chamados não", async () => {
    const { api, cliente, tela } = await prepararTela();
    const mutacao = montarHook(() => useRegistrarApontamento(), cliente);

    await act(async () => {
      await mutacao.resultado().mutateAsync({ os: 1 });
    });
    await aguardar();

    expect(api.quantas("/api/painel/pendentes")).toBe(1);
    expect(api.quantas("/api/call/list")).toBe(0);
    mutacao.desmontar();
    tela.desmontar();
  });

  it("standby: chamados, OS e painel; excluir OS na aba Tarefas não refaz chamados", async () => {
    const { api, cliente, tela } = await prepararTela();
    const standby = montarHook(() => useColocarEmStandby(), cliente);

    await act(async () => {
      await standby.resultado().mutateAsync({ chamado: 1 });
    });
    await aguardar();
    expect(api.quantas("/api/call/list")).toBe(1);

    api.chamadas.length = 0;
    const excluir = montarHook(() => useExcluirOs(), cliente);
    await act(async () => {
      await excluir.resultado().mutateAsync({ codOs: 5, recarregarChamados: false });
    });
    await aguardar();
    expect(api.quantas("/api/call/list")).toBe(0);

    api.chamadas.length = 0;
    await act(async () => {
      await excluir.resultado().mutateAsync({ codOs: 6, recarregarChamados: true });
    });
    await aguardar();
    expect(api.quantas("/api/call/list")).toBe(1);

    standby.desmontar();
    excluir.desmontar();
    tela.desmontar();
  });

  it("gravação recusada (erro 4xx) não atualiza nada e a mensagem do servidor chega a quem chamou", async () => {
    const { api, cliente, tela } = await prepararTela();
    api.rotas["/api/os/apoint"] = { error: "Limite estourado" };
    api.status["/api/os/apoint"] = 400;
    const mutacao = montarHook(() => useRegistrarApontamento(), cliente);

    await act(async () => {
      await expect(mutacao.resultado().mutateAsync({ os: 1 })).rejects.toMatchObject({ message: "Limite estourado", status: 400 });
    });
    await aguardar();

    // só a própria tentativa de gravação saiu; nenhuma busca extra
    expect(api.fetchMock).toHaveBeenCalledTimes(1);
    mutacao.desmontar();
    tela.desmontar();
  });

  it("a gravação não é repetida sozinha mesmo com erro de servidor", async () => {
    const { api, cliente, tela } = await prepararTela();
    api.rotas["/api/os/apoint"] = { error: "Indisponível" };
    api.status["/api/os/apoint"] = 503;
    const mutacao = montarHook(() => useRegistrarApontamento(), cliente);

    await act(async () => {
      await mutacao.resultado().mutateAsync({ os: 1 }).catch(() => {});
    });
    await aguardar();

    expect(api.fetchMock).toHaveBeenCalledTimes(1);
    mutacao.desmontar();
    tela.desmontar();
  });
});
