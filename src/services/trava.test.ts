// @vitest-environment node
import { describe, expect, it } from "vitest";
import { comTrava } from "./trava";

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("comTrava", () => {
  it("mesma chave: uma depois da outra, na ordem em que chegaram", async () => {
    const ordem: string[] = [];

    await Promise.all(
      ["a", "b", "c"].map((nome, i) =>
        comTrava("os:152:2026-10-02", async () => {
          ordem.push(`${nome} começa`);
          await dormir(10 - i * 3); // a primeira demora mais: mesmo assim termina antes
          ordem.push(`${nome} termina`);
        }),
      ),
    );

    expect(ordem).toEqual(["a começa", "a termina", "b começa", "b termina", "c começa", "c termina"]);
  });

  it("chaves diferentes rodam em paralelo", async () => {
    const ordem: string[] = [];

    await Promise.all([
      comTrava("os:152:2026-10-02", async () => {
        ordem.push("x começa");
        await dormir(20);
        ordem.push("x termina");
      }),
      comTrava("os:153:2026-10-02", async () => {
        ordem.push("y começa");
        await dormir(1);
        ordem.push("y termina");
      }),
    ]);

    expect(ordem).toEqual(["x começa", "y começa", "y termina", "x termina"]);
  });

  it("devolve o resultado de cada uma", async () => {
    const r = await Promise.all([comTrava("k", async () => 1), comTrava("k", async () => 2)]);

    expect(r).toEqual([1, 2]);
  });

  it("um erro não trava a fila: a seguinte roda normalmente e o erro volta só para quem o causou", async () => {
    const resultados = await Promise.allSettled([
      comTrava("k", async () => {
        throw new Error("falhou");
      }),
      comTrava("k", async () => "ok"),
    ]);

    expect(resultados[0]).toMatchObject({ status: "rejected" });
    expect(resultados[1]).toEqual({ status: "fulfilled", value: "ok" });
  });

  it("se quem está na frente trava, a fila NÃO fica parada para sempre (espera máxima)", async () => {
    // a primeira nunca termina
    void comTrava("emperrada", () => new Promise(() => {}), { esperaMaximaMs: 30 });

    const inicio = Date.now();
    const r = await comTrava("emperrada", async () => "seguiu", { esperaMaximaMs: 30 });

    expect(r).toBe("seguiu");
    expect(Date.now() - inicio).toBeGreaterThanOrEqual(25);
    expect(Date.now() - inicio).toBeLessThan(500);
  });

  it("não deixa lixo na memória depois que a fila esvazia", async () => {
    await comTrava("limpa", async () => 1);

    const mapa = (globalThis as any).__gerprojTravas as Map<string, unknown>;

    expect(mapa.has("limpa")).toBe(false);
  });
});
