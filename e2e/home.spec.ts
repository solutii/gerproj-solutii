import { test, expect } from "@playwright/test";

// Testes autenticados -- exigem E2E_USERNAME/E2E_PASSWORD em .env.local
// (nunca commitados). Sem essas variáveis, a suíte inteira é pulada em vez
// de falhar, já que não há credencial de teste dedicada no ambiente do CI.
const USERNAME = process.env.E2E_USERNAME;
const PASSWORD = process.env.E2E_PASSWORD;

test.describe("Home (autenticado)", () => {
    test.skip(!USERNAME || !PASSWORD, "E2E_USERNAME/E2E_PASSWORD não configurados em .env.local");

    test.beforeEach(async ({ page }) => {
        await page.goto("/login");
        await page.getByRole("textbox", { name: "Usuário" }).fill(USERNAME!);
        await page.getByRole("textbox", { name: "Senha" }).fill(PASSWORD!);
        await page.getByRole("button", { name: "Entrar" }).click();
        await page.waitForURL("/home");
    });

    test("faz login e chega em /home com a aba Chamados ativa", async ({ page }) => {
        await expect(page.getByRole("button", { name: "Chamados" })).toBeVisible();
    });

    test("trocar de aba limpa a seleção de chamado (sem OS residual)", async ({ page }) => {
        const table = page.locator("table").first();
        const firstRow = table.locator("tbody tr").first();
        const hasRow = (await firstRow.count()) > 0;
        test.skip(!hasRow, "Nenhum chamado disponível pra este usuário de teste");

        await firstRow.click();
        await expect(page.getByText(/Apontamentos do chamado/)).toBeVisible();

        await page.getByRole("button", { name: "Tarefas" }).click();
        await expect(page.getByText(/Apontamentos do chamado/)).toHaveCount(0);

        await page.getByRole("button", { name: "Chamados" }).click();
        await expect(page.getByText(/Apontamentos do chamado/)).toHaveCount(0);
    });

    test("clicar duas vezes no mesmo chamado desmarca a seleção (toggle)", async ({ page }) => {
        const table = page.locator("table").first();
        const firstRow = table.locator("tbody tr").first();
        const hasRow = (await firstRow.count()) > 0;
        test.skip(!hasRow, "Nenhum chamado disponível pra este usuário de teste");

        await firstRow.click();
        await expect(page.getByText(/Apontamentos do chamado/)).toBeVisible();

        await firstRow.click();
        await expect(page.getByText(/Apontamentos do chamado/)).toHaveCount(0);
    });

    test("o toggle de tema alterna entre claro e escuro", async ({ page }) => {
        const html = page.locator("html");
        const themeToggle = page.getByRole("switch");

        const initiallyDark = await html.evaluate((el) => el.classList.contains("dark"));
        await themeToggle.click();
        await expect(html).toHaveClass(initiallyDark ? /^(?!.*dark).*$/ : /dark/);
    });
});
