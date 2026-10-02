// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { DashboardResposta } from "@/types/admin-dashboard";
import { criarCacheDoDashboard } from "./dashboard-cache";

const resposta = (mes: string, n: number) => ({ mes, n }) as unknown as DashboardResposta;

function criar(validadeMs = 1000) {
  let agora = 0;
  let contador = 0;
  const montar = vi.fn(async (mes: string) => resposta(mes, ++contador));
  const cache = criarCacheDoDashboard(montar, validadeMs, () => agora);

  return { montar, cache, avancar: (ms: number) => (agora += ms) };
}

describe("cache do dashboard", () => {
  it("dentro da validade devolve o guardado, sem consultar de novo", async () => {
    const { montar, cache, avancar } = criar();

    const a = await cache.obter("2026-10");
    avancar(999);
    const b = await cache.obter("2026-10");

    expect(b).toBe(a);
    expect(montar).toHaveBeenCalledTimes(1);
  });

  it("passada a validade, calcula de novo", async () => {
    const { montar, cache, avancar } = criar();

    await cache.obter("2026-10");
    avancar(1000);
    await cache.obter("2026-10");

    expect(montar).toHaveBeenCalledTimes(2);
  });

  it("cada mês tem o seu", async () => {
    const { montar, cache } = criar();

    await cache.obter("2026-10");
    await cache.obter("2026-09");
    await cache.obter("2026-10");

    expect(montar).toHaveBeenCalledTimes(2);
  });

  it("'atualizar' ignora o guardado e põe o novo no lugar", async () => {
    const { montar, cache } = criar();

    const velho = await cache.obter("2026-10");
    const novo = await cache.obter("2026-10", { atualizar: true });
    const depois = await cache.obter("2026-10");

    expect(montar).toHaveBeenCalledTimes(2);
    expect(novo).not.toBe(velho);
    expect(depois).toBe(novo);
  });

  it("pedidos simultâneos do mesmo mês dividem UMA consulta", async () => {
    const { montar, cache } = criar();

    const [a, b, c] = await Promise.all([cache.obter("2026-10"), cache.obter("2026-10"), cache.obter("2026-10")]);

    expect(montar).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("falha não fica guardada: o pedido seguinte tenta de novo", async () => {
    const montar = vi.fn<(mes: string) => Promise<DashboardResposta>>().mockRejectedValueOnce(new Error("banco fora")).mockResolvedValue(resposta("2026-10", 2));
    const cache = criarCacheDoDashboard(montar, 1000, () => 0);

    await expect(cache.obter("2026-10")).rejects.toThrow("banco fora");
    await expect(cache.obter("2026-10")).resolves.toMatchObject({ n: 2 });
    expect(montar).toHaveBeenCalledTimes(2);
  });

  it("descartar força nova consulta (depois de uma alteração do painel)", async () => {
    const { montar, cache } = criar();

    await cache.obter("2026-10");
    cache.descartar();
    await cache.obter("2026-10");

    expect(montar).toHaveBeenCalledTimes(2);
  });

  it("cálculo que começou ANTES de uma alteração não é guardado (seria número velho)", async () => {
    let liberar!: () => void;
    const montar = vi
      .fn<(mes: string) => Promise<DashboardResposta>>()
      .mockImplementationOnce(() => new Promise((resolve) => (liberar = () => resolve(resposta("2026-10", 1)))))
      .mockResolvedValue(resposta("2026-10", 2));
    const cache = criarCacheDoDashboard(montar, 1000, () => 0);

    const lento = cache.obter("2026-10");
    cache.descartar(); // alguém alterou uma jornada no meio do cálculo
    liberar();
    await lento;

    // o resultado do cálculo antigo NÃO ficou no cache: o próximo pedido calcula de novo
    await expect(cache.obter("2026-10")).resolves.toMatchObject({ n: 2 });
    expect(montar).toHaveBeenCalledTimes(2);
  });

  it("guarda no máximo 12 meses (os mais antigos saem)", async () => {
    const { montar, cache } = criar();
    const meses = Array.from({ length: 13 }, (_, i) => `2025-${String((i % 12) + 1).padStart(2, "0")}-${i}`);

    for (const m of meses) await cache.obter(m);
    montar.mockClear();

    await cache.obter(meses[12]); // o mais novo continua guardado
    expect(montar).not.toHaveBeenCalled();
    await cache.obter(meses[0]); // o mais antigo foi descartado
    expect(montar).toHaveBeenCalledTimes(1);
  });
});
