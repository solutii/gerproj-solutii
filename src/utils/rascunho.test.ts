import { afterEach, describe, expect, it, vi } from "vitest";
import {
  chaveRascunhoChamado,
  chaveRascunhoTarefa,
  descartarRascunho,
  lerRascunho,
  limparTodosRascunhos,
  salvarRascunho,
  VALIDADE_RASCUNHO_MS,
} from "./rascunho";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("rascunho da descrição", () => {
  it("salva e devolve o texto da mesma chave; chaves diferentes não se misturam", () => {
    salvarRascunho(chaveRascunhoTarefa(1771), "Ajuste do relatório de vendas");

    expect(lerRascunho(chaveRascunhoTarefa(1771))).toBe("Ajuste do relatório de vendas");
    expect(lerRascunho(chaveRascunhoTarefa(1099))).toBe("");
    expect(lerRascunho(chaveRascunhoChamado(1771))).toBe("");
  });

  it("texto vazio ou só espaços apaga o rascunho", () => {
    salvarRascunho("tarefa:1", "texto");
    salvarRascunho("tarefa:1", "   ");

    expect(lerRascunho("tarefa:1")).toBe("");
    expect(localStorage.length).toBe(0);
  });

  it("expira depois de 24 horas e a entrada vencida é removida", () => {
    const agora = Date.now();
    salvarRascunho("tarefa:1", "texto", agora);

    expect(lerRascunho("tarefa:1", agora + VALIDADE_RASCUNHO_MS)).toBe("texto");
    expect(lerRascunho("tarefa:1", agora + VALIDADE_RASCUNHO_MS + 1)).toBe("");
    expect(localStorage.length).toBe(0);
  });

  it("descartar remove só aquele rascunho; limparTodos remove todos (logout)", () => {
    salvarRascunho("tarefa:1", "a");
    salvarRascunho("chamado:2", "b");
    localStorage.setItem("gerproj-theme", "{}");

    descartarRascunho("tarefa:1");
    expect(lerRascunho("tarefa:1")).toBe("");
    expect(lerRascunho("chamado:2")).toBe("b");

    limparTodosRascunhos();
    expect(lerRascunho("chamado:2")).toBe("");
    expect(localStorage.getItem("gerproj-theme")).toBe("{}"); // não mexe no resto
  });

  it("conteúdo corrompido é ignorado, sem erro", () => {
    localStorage.setItem("gerproj-rascunho:tarefa:1", "{quebrado");
    localStorage.setItem("gerproj-rascunho:tarefa:2", JSON.stringify({ texto: 5, em: "x" }));

    expect(lerRascunho("tarefa:1")).toBe("");
    expect(lerRascunho("tarefa:2")).toBe("");
  });

  it("localStorage indisponível (bloqueado/cheio) não quebra a tela", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("cheio", "QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("bloqueado", "SecurityError");
    });

    expect(() => salvarRascunho("tarefa:1", "texto")).not.toThrow();
    expect(lerRascunho("tarefa:1")).toBe("");
    expect(() => descartarRascunho("tarefa:1")).not.toThrow();
    expect(() => limparTodosRascunhos()).not.toThrow();
  });
});
