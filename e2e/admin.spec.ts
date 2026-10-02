import { test, expect } from "@playwright/test";
import { entrar, PASSWORD, USERNAME } from "./helpers";

// O usuário de teste (E2E_USERNAME) é um consultor comum: o painel de administração
// precisa ser inacessível para ele, na página e nas rotas. (O lado do administrador
// é coberto pelos testes unitários e por verificação manual com uma sessão de ADM.)
test.describe("Painel admin: consultor comum é barrado", () => {
    test.skip(!USERNAME || !PASSWORD, "E2E_USERNAME/E2E_PASSWORD não configurados em .env.local");
    test.setTimeout(120_000);

    test("abrir /admin leva de volta para /home", async ({ page }) => {
        await entrar(page);

        await page.goto("/admin");

        await expect(page).toHaveURL(/\/home$/);
        await expect(page.getByRole("heading", { name: "Painel de Controle" })).toHaveCount(0);
    });

    test("todas as rotas /api/admin (inclusive o dashboard) respondem 403 (nada de administração vaza)", async ({ page }) => {
        await entrar(page);

        const respostas = await page.evaluate(async () => {
            const json = { "Content-Type": "application/json" };
            const pedir = async (url: string, init?: RequestInit) => (await fetch(url, init)).status;

            return {
                consultores: await pedir("/api/admin/consultores"),
                tarefas: await pedir("/api/admin/tarefas"),
                historico: await pedir("/api/admin/historico"),
                dashboard: await pedir("/api/admin/dashboard"),
                painelDoConsultor: await pedir("/api/admin/dashboard/consultor/1"),
                patchConsultor: await pedir("/api/admin/consultores/1", { method: "PATCH", headers: json, body: '{"jornada":"08:00"}' }),
                patchTarefa: await pedir("/api/admin/tarefas/1", { method: "PATCH", headers: json, body: '{"permiteExceder":true}' }),
            };
        });

        expect(respostas).toEqual({ consultores: 403, tarefas: 403, historico: 403, dashboard: 403, painelDoConsultor: 403, patchConsultor: 403, patchTarefa: 403 });
    });

    test("o consultor continua usando o sistema normalmente (a Home e as rotas dele não mudaram)", async ({ page }) => {
        await entrar(page);

        await expect(page.getByRole("button", { name: "Chamados", exact: true })).toBeVisible();
        const status = await page.evaluate(async () => (await fetch("/api/painel/pendentes")).status);

        expect(status).toBe(200);
    });
});
