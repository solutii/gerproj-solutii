import { test, expect } from "@playwright/test";

// Testes que não dependem de credenciais reais -- só validação de formulário
// e o fluxo de erro do NextAuth.
test.describe("Login", () => {
    test("mostra erros de campo obrigatório ao submeter vazio", async ({ page }) => {
        await page.goto("/login");

        await page.getByRole("button", { name: "Entrar" }).click();

        await expect(page.getByText("Campo obrigatório.")).toHaveCount(2);
    });

    test("mostra mensagem de erro para usuário/senha inválidos", async ({ page }) => {
        await page.goto("/login");

        await page.getByRole("textbox", { name: "Usuário" }).fill("usuario-que-nao-existe");
        await page.getByRole("textbox", { name: "Senha" }).fill("senha-errada");
        await page.getByRole("button", { name: "Entrar" }).click();

        // a checagem de credenciais bate no banco Firebird de verdade -- em
        // dev isso pode levar bem mais que os 5s padrão do Playwright.
        await expect(page.getByText("Usuário ou senha inválidos.")).toBeVisible({
            timeout: 30_000,
        });
        // não deve navegar pra /home com credenciais inválidas
        await expect(page).toHaveURL(/\/login/);
    });
});
