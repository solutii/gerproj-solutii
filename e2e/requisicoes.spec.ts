import { test, expect } from "@playwright/test";
import { entrar, PASSWORD, registrarApi, USERNAME } from "./helpers";

// Garante a regra "nada de requisição à toa": o cache do TanStack Query evita
// buscar de novo ao trocar de aba ou ao reabrir uma tela já vista.
test.describe("Requisições (autenticado)", () => {
    test.skip(!USERNAME || !PASSWORD, "E2E_USERNAME/E2E_PASSWORD não configurados em .env.local");
    test.setTimeout(180_000);

    test("alternar entre Chamados e Tarefas não faz requisição", async ({ page }) => {
        await entrar(page);
        await page.waitForTimeout(2000); // deixa a carga inicial terminar
        const api = registrarApi(page);

        for (const aba of ["Tarefas", "Chamados", "Tarefas", "Chamados"]) {
            await page.getByRole("button", { name: aba, exact: true }).click();
            await page.waitForTimeout(800);
        }

        expect(api.chamadas).toEqual([]);
    });

    test("Meu Painel: a 1ª abertura busca uma vez e voltar logo depois não busca de novo", async ({ page }) => {
        await entrar(page);
        await page.waitForTimeout(2000);
        const api = registrarApi(page);

        await page.getByRole("button", { name: "Meu Painel", exact: true }).click();
        await expect(page.getByText("Meu mês")).toBeVisible({ timeout: 90_000 });
        await page.waitForTimeout(1000);

        expect(api.chamadas.filter((c) => c.includes("/api/painel?") || c === "GET /api/painel")).toHaveLength(1);

        api.limpar();
        await page.getByRole("button", { name: "Chamados", exact: true }).click();
        await page.waitForTimeout(500);
        await page.getByRole("button", { name: "Meu Painel", exact: true }).click();
        await expect(page.getByText("Meu mês")).toBeVisible();
        await page.waitForTimeout(1000);

        expect(api.chamadas).toEqual([]);
    });

    test("selecionar de novo um chamado já visto usa o cache (sem requisição)", async ({ page }) => {
        await entrar(page);
        const linhas = page.locator("table").first().locator("tbody tr");
        test.skip((await linhas.count()) === 0, "Nenhum chamado disponível pra este usuário de teste");
        const api = registrarApi(page);

        await linhas.first().click(); // 1ª vez: busca as OS do chamado
        await expect(page.getByText(/OS's do chamado/i)).toBeVisible({ timeout: 60_000 });
        expect(api.chamadas.filter((c) => c === "POST /api/os/list")).toHaveLength(1);

        api.limpar();
        await linhas.first().click(); // desmarca
        await linhas.first().click(); // marca de novo
        await expect(page.getByText(/OS's do chamado/i)).toBeVisible();
        await page.waitForTimeout(800);

        expect(api.chamadas).toEqual([]);
    });
});
