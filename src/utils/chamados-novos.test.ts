import { describe, expect, it } from "vitest";
import { chamadosNovos, textoChamadosNovos } from "./chamados-novos";

const c = (n: number) => ({ COD_CHAMADO: n });

describe("chamadosNovos", () => {
  it("devolve só os que ainda não foram vistos", () => {
    expect(chamadosNovos(new Set([1, 2]), [c(1), c(2), c(3), c(4)])).toEqual([c(3), c(4)]);
  });

  it("sem novidade, lista vazia; chamado que saiu da lista não conta", () => {
    expect(chamadosNovos(new Set([1, 2, 3]), [c(1), c(2)])).toEqual([]);
  });
});

describe("textoChamadosNovos", () => {
  it("singular, plural e resumo com 'e mais N'", () => {
    expect(textoChamadosNovos([c(15200)])).toBe("Chegou um chamado novo para você: #15200.");
    expect(textoChamadosNovos([c(1), c(2)])).toBe("Chegaram 2 chamados novos para você: #1, #2.");
    expect(textoChamadosNovos([c(1), c(2), c(3), c(4), c(5)])).toBe("Chegaram 5 chamados novos para você: #1, #2, #3 e mais 2.");
  });
});
