// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiGet, apiPost, MENSAGEM_FALHA_REDE, mensagemDoErro } from "./api";
import { criarQueryClient, limparCacheDoUsuario, tentarDeNovo } from "./query-client";

const resposta = (corpo: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: () => (corpo === undefined ? Promise.reject(new Error("sem json")) : Promise.resolve(corpo)) } as Response);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiJson / apiGet / apiPost", () => {
  it("devolve o JSON da resposta de sucesso", async () => {
    vi.stubGlobal("fetch", vi.fn(() => resposta([{ id: 1 }])));

    expect(await apiGet("/api/x")).toEqual([{ id: 1 }]);
  });

  it("POST envia o corpo em JSON; sem corpo não manda body", async () => {
    const fetchMock = vi.fn(() => resposta({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await apiPost("/api/x", { a: 1 });
    await apiPost("/api/y");

    expect(fetchMock.mock.calls[0]).toEqual(["/api/x", { method: "POST", body: '{"a":1}' }]);
    expect(fetchMock.mock.calls[1]).toEqual(["/api/y", { method: "POST" }]);
  });

  it("status de erro vira ApiError com a mensagem do servidor", async () => {
    vi.stubGlobal("fetch", vi.fn(() => resposta({ error: "Horas esgotadas" }, 400)));

    await expect(apiPost("/api/x")).rejects.toMatchObject({ name: "ApiError", message: "Horas esgotadas", status: 400 });
  });

  it("sem mensagem do servidor usa a padrão da chamada, ou uma genérica", async () => {
    vi.stubGlobal("fetch", vi.fn(() => resposta(undefined, 500)));

    await expect(apiGet("/api/x", { mensagemPadrao: "Falha ao carregar" })).rejects.toThrow("Falha ao carregar");
    await expect(apiGet("/api/x")).rejects.toThrow("Não foi possível concluir a operação.");
  });

  it("falha de rede vira ApiError de status 0 com mensagem amigável", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))));

    await expect(apiGet("/api/x")).rejects.toMatchObject({ status: 0, message: MENSAGEM_FALHA_REDE });
  });

  it("requisição cancelada não é tratada como falha de rede", async () => {
    const cancelamento = new DOMException("cancelado", "AbortError");
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(cancelamento)));

    await expect(apiGet("/api/x")).rejects.toBe(cancelamento);
  });

  it("lê o fetch no momento da chamada (o SessionGuard troca window.fetch)", async () => {
    const primeiro = vi.fn(() => resposta({ v: 1 }));
    vi.stubGlobal("fetch", primeiro);
    await apiGet("/api/x");

    const segundo = vi.fn(() => resposta({ v: 2 }));
    vi.stubGlobal("fetch", segundo);
    await apiGet("/api/x");

    expect(primeiro).toHaveBeenCalledTimes(1);
    expect(segundo).toHaveBeenCalledTimes(1);
  });
});

describe("mensagemDoErro", () => {
  it("usa a mensagem da ApiError; outros erros caem na padrão (sem vazar detalhe)", () => {
    expect(mensagemDoErro(new ApiError("Sessão expirada", 401), "padrão")).toBe("Sessão expirada");
    expect(mensagemDoErro(new Error("ECONNRESET 10.0.0.5"), "padrão")).toBe("padrão");
  });
});

describe("política de cache e repetição", () => {
  it("erro 4xx nunca é repetido (sessão, permissão e parâmetro não melhoram repetindo)", () => {
    for (const status of [400, 401, 403, 404, 422]) {
      expect(tentarDeNovo(0, new ApiError("x", status))).toBe(false);
    }
  });

  it("falha de rede e erro 5xx são repetidos uma única vez", () => {
    expect(tentarDeNovo(0, new ApiError("x", 0))).toBe(true);
    expect(tentarDeNovo(0, new ApiError("x", 503))).toBe(true);
    expect(tentarDeNovo(1, new ApiError("x", 503))).toBe(false);
    expect(tentarDeNovo(0, new Error("inesperado"))).toBe(true);
  });

  it("gravação nunca é repetida sozinha (poderia duplicar um apontamento)", () => {
    expect(criarQueryClient().getDefaultOptions().mutations?.retry).toBe(false);
  });

  it("dados ficam frescos por 1 minuto e a janela em foco os atualiza depois disso", () => {
    const opcoes = criarQueryClient().getDefaultOptions().queries;

    expect(opcoes?.staleTime).toBe(60_000);
    expect(opcoes?.refetchOnWindowFocus).toBe(true);
  });

  it("limparCacheDoUsuario não falha quando ainda não há cliente (servidor/primeiro acesso)", () => {
    expect(() => limparCacheDoUsuario()).not.toThrow();
  });
});
