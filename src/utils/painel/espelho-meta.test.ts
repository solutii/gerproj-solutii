import { describe, expect, it } from "vitest";
import { htmlEspelho, textoMetaEspelho, type DadosEspelho } from "./espelho";

const meta = { jornadaDiariaMin: 528, diasUteis: 21, metaMesMin: 11088 };

const dados = (sobrescrever: Partial<DadosEspelho> = {}): DadosEspelho => ({
  consultor: "FULANO",
  nomeMes: "setembro de 2026",
  linhas: [],
  totalMin: 5544,
  meta,
  ...sobrescrever,
});

describe("meta no espelho", () => {
  it("texto da meta com jornada, dias úteis e percentual", () => {
    expect(textoMetaEspelho(meta, 5544)).toBe("Meta do mês: 184hs:48min (21 dias úteis × 8hs:48min) · apontado 92hs:24min (50% da meta)");
  });

  it("sem meta (jornada não cadastrada) não gera texto", () => {
    expect(textoMetaEspelho(undefined, 100)).toBe("");
    expect(textoMetaEspelho({ ...meta, metaMesMin: 0 }, 100)).toBe("");
  });

  it("o PDF/impressão traz a meta no cabeçalho", () => {
    expect(htmlEspelho(dados())).toContain("Meta do mês: 184hs:48min");
  });

  it("sem meta o cabeçalho continua igual ao de antes", () => {
    expect(htmlEspelho(dados({ meta: undefined }))).not.toContain("Meta do mês");
  });
});
