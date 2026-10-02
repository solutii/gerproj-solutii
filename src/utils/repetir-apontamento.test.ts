import { describe, expect, it } from "vitest";
import { destinoParaRepetir } from "./repetir-apontamento";

const chamados = [{ COD_CHAMADO: 100 }, { COD_CHAMADO: 200 }];
const tarefas = [{ COD_TAREFA: "1771" }, { COD_TAREFA: "1099" }];

describe("destinoParaRepetir", () => {
  it("OS de chamado vai para o StandBy do chamado, com a mesma descrição", () => {
    const d = destinoParaRepetir({ OBS: " Ajuste do relatório ", CHAMADO_OS: "100", CODTRF_OS: 1771 }, chamados, tarefas);

    expect(d).toEqual({ tipo: "chamado", chamado: { COD_CHAMADO: 100 }, descricao: "Ajuste do relatório" });
  });

  it("OS de tarefa (sem chamado) vai para o apontamento na tarefa", () => {
    const d = destinoParaRepetir({ OBS: "Teste", CHAMADO_OS: null, CODTRF_OS: 1771 }, chamados, tarefas);

    expect(d).toEqual({ tipo: "tarefa", tarefa: { COD_TAREFA: "1771" }, descricao: "Teste" });
  });

  it("compara código como texto (o banco devolve número ou texto com espaços)", () => {
    expect(destinoParaRepetir({ CHAMADO_OS: " 200 " }, chamados, tarefas).tipo).toBe("chamado");
    expect(destinoParaRepetir({ CHAMADO_OS: "", CODTRF_OS: "1099" }, chamados, tarefas).tipo).toBe("tarefa");
  });

  it("chamado que saiu da lista (finalizado/reatribuído) avisa em vez de abrir o modal", () => {
    const d = destinoParaRepetir({ CHAMADO_OS: "999" }, chamados, tarefas);

    expect(d).toEqual({ tipo: "indisponivel", motivo: expect.stringContaining("#999") });
  });

  it("tarefa que saiu da lista avisa; OS sem descrição repete com texto vazio", () => {
    expect(destinoParaRepetir({ CODTRF_OS: 5 }, chamados, tarefas).tipo).toBe("indisponivel");
    expect(destinoParaRepetir({ CODTRF_OS: 1771 }, chamados, tarefas)).toMatchObject({ descricao: "" });
  });
});
