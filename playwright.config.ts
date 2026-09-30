import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

// Credenciais de teste (E2E_USERNAME/E2E_PASSWORD) ficam em .env.local, que
// já é ignorado pelo git -- nunca commitamos usuário/senha reais aqui.
dotenv.config({ path: ".env.local" });

// Suíte E2E enxuta -- só Chromium, pra não gastar tempo/recursos rodando os
// mesmos fluxos em vários navegadores. O dev server já precisa estar de pé
// em localhost:3001 (webServer abaixo sobe um se não houver).
export default defineConfig({
    testDir: "./e2e",
    fullyParallel: false,
    retries: 0,
    workers: 1,
    reporter: [["list"]],
    // O primeiro login de cada execução costuma ser lento (o pool de conexão
    // do Firebird "esfria" entre execuções) -- 60s cobre esse cold-start sem
    // mascarar uma trava real.
    timeout: 60_000,
    use: {
        baseURL: "http://localhost:3001",
        trace: "retain-on-failure",
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],
    webServer: {
        command: "pnpm dev",
        url: "http://localhost:3001/login",
        reuseExistingServer: true,
        timeout: 60_000,
    },
});
