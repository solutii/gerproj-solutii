import { expect, type Page } from "@playwright/test";

// Credenciais de teste: E2E_USERNAME/E2E_PASSWORD em .env.local (nunca commitado).
export const USERNAME = process.env.E2E_USERNAME;
export const PASSWORD = process.env.E2E_PASSWORD;

export async function entrar(page: Page) {
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Usuário" }).fill(USERNAME!);
    await page.getByRole("textbox", { name: "Senha" }).fill(PASSWORD!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL("/home", { timeout: 60_000 });
    // as tabelas só aparecem depois de a lista de chamados/tarefas carregar
    await expect(page.locator("table").first()).toBeVisible({ timeout: 60_000 });
}

// Modal de apontamento/standby/edição (camada fixa por cima da tela).
export const modal = (page: Page) => page.locator("div.fixed.inset-0.z-50");

// Registra as chamadas à API (sem /api/auth) feitas a partir de agora.
export function registrarApi(page: Page) {
    const chamadas: string[] = [];

    page.on("request", (r) => {
        const url = new URL(r.url());

        if (url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/auth")) {
            chamadas.push(`${r.method()} ${url.pathname}`);
        }
    });

    return {
        chamadas,
        limpar: () => chamadas.splice(0),
    };
}

// Opções habilitadas (com valor) de um <select> de horário.
export async function horariosLivres(page: Page, indice: 0 | 1): Promise<string[]> {
    return page
        .locator("select")
        .nth(indice)
        .locator("option")
        .evaluateAll((opcoes) =>
            (opcoes as HTMLOptionElement[]).filter((o) => o.value && !o.disabled).map((o) => o.value),
        );
}
