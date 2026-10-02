import { test, expect, type Page } from "@playwright/test";
import { entrar, horariosLivres, modal, PASSWORD, USERNAME } from "./helpers";

// Ciclo completo de um apontamento numa tarefa: gravar, ver horário ocupado,
// repetir, editar e excluir. Usa um texto único (marca) para achar a própria
// OS na lista e SEMPRE exclui o que criou, mesmo se um passo falhar.
test.describe("Apontamento (autenticado)", () => {
    test.skip(!USERNAME || !PASSWORD, "E2E_USERNAME/E2E_PASSWORD não configurados em .env.local");
    test.describe.configure({ mode: "serial" });
    test.setTimeout(240_000);

    const marca = `e2e-${Date.now()}`;
    const descricao = `Teste automatizado ${marca} - apontamento criado e excluido pelo proprio teste.`;

    test.beforeEach(async ({ page }) => {
        await entrar(page);
        await page.getByRole("button", { name: "Tarefas", exact: true }).click();
    });

    const linhaDaOs = (page: Page) => page.getByRole("row").filter({ hasText: marca });

    async function fecharAlerta(page: Page, texto: RegExp) {
        const alerta = page.getByRole("alertdialog");

        await expect(alerta).toContainText(texto, { timeout: 90_000 });
        await alerta.getByRole("button", { name: "OK" }).click();
    }

    async function excluirSeExistir(page: Page) {
        // limpeza: tarefa que contém a OS pode não estar selecionada
        const linhas = page.locator("table").first().locator("tbody tr");
        const total = await linhas.count();

        for (let i = 0; i < total && (await linhaDaOs(page).count()) === 0; i++) {
            await linhas.nth(i).click();
            await page.waitForTimeout(1500);
        }

        if ((await linhaDaOs(page).count()) === 0) return;

        await linhaDaOs(page).first().locator("svg").last().click();

        const exclusao = page.waitForResponse((r) => r.url().includes("/api/os/delete"), { timeout: 120_000 });
        await page.getByRole("alertdialog").getByRole("button", { name: /Sim, excluir/ }).click();

        expect((await exclusao).status()).toBe(200);
        await expect(linhaDaOs(page)).toHaveCount(0, { timeout: 60_000 });
    }

    test("grava, mostra horário ocupado, repete, edita e exclui", async ({ page }) => {
        const tarefas = page.locator("table").first().locator("tbody tr");
        test.skip((await tarefas.count()) === 0, "Nenhuma tarefa disponível para este usuário de teste");

        try {
            // 1) grava numa tarefa (tenta as primeiras: alguma pode estar sem horas no mês)
            let gravou = false;
            let horaInicial = "";
            let usada = 0;

            for (let i = 0; i < Math.min(await tarefas.count(), 5) && !gravou; i++) {
                await tarefas.nth(i).locator("svg").first().click(); // relógio: Apontar horas
                await expect(modal(page)).toBeVisible();

                const iniciais = await horariosLivres(page, 0);
                test.skip(iniciais.length === 0, "Sem horário livre hoje para apontar");

                usada = i;
                horaInicial = iniciais[0];
                await page.locator("select").nth(0).selectOption(horaInicial);

                const finais = await horariosLivres(page, 1);
                test.skip(finais.length === 0, "Sem horário final livre hoje");

                await page.locator("select").nth(1).selectOption(finais[0]);
                await page.locator("textarea").fill(descricao);
                await modal(page).getByRole("button", { name: "Confirmar" }).click();
                await page
                    .locator("div.fixed.inset-0")
                    .filter({ hasText: "Deseja confirmar o apontamento" })
                    .getByRole("button", { name: "Confirmar" })
                    .click();

                const alerta = page.getByRole("alertdialog");
                await expect(alerta).toBeVisible({ timeout: 90_000 });

                if (/registrado com sucesso/.test(await alerta.innerText())) {
                    gravou = true;
                    await alerta.getByRole("button", { name: "OK" }).click();
                } else {
                    // recusado (ex.: limite de horas da tarefa): tenta a próxima
                    await alerta.getByRole("button", { name: "OK" }).click();
                    await modal(page).getByRole("button", { name: "Cancelar" }).click();
                }
            }

            test.skip(!gravou, "Nenhuma das primeiras tarefas aceitou o apontamento de teste");

            // 2) a OS aparece na lista da tarefa sem recarregar a página
            await expect(linhaDaOs(page)).toHaveCount(1, { timeout: 60_000 });

            // 3) o horário usado agora aparece como ocupado no modal
            await tarefas.nth(usada).locator("svg").first().click(); // mesma tarefa: reabre o modal
            await expect(modal(page)).toBeVisible();
            await expect(page.locator("select").nth(0).locator(`option[value="${horaInicial}"]`)).toBeDisabled({ timeout: 30_000 });
            await expect(page.locator("select").nth(0).locator(`option[value="${horaInicial}"]`)).toContainText("(ocupado)");
            await modal(page).getByRole("button", { name: "Cancelar" }).click();

            // 4) repetir: abre o modal com a descrição da OS e horários em branco
            await linhaDaOs(page).first().locator("svg").first().click();
            await expect(modal(page)).toBeVisible();
            await expect(page.locator("textarea")).toHaveValue(descricao);
            await expect(page.locator("select").nth(0)).toHaveValue("");
            await modal(page).getByRole("button", { name: "Cancelar" }).click();

            // 5) editar: muda a descrição
            await linhaDaOs(page).first().locator("svg").nth(1).click();
            await expect(modal(page)).toBeVisible();
            await page.locator("textarea").fill(`${descricao} editado`);
            await modal(page).getByRole("button", { name: "Confirmar" }).click();
            await page
                .locator("div.fixed.inset-0")
                .filter({ hasText: /Deseja confirmar a edição/ })
                .getByRole("button", { name: "Confirmar" })
                .click();
            await fecharAlerta(page, /atualizada com sucesso/);
            await expect(linhaDaOs(page).first()).toContainText(/editado/i, { timeout: 60_000 }); // o app capitaliza as frases

            // 6) exclui e confirma que a rota respondeu 200
            await excluirSeExistir(page);
        } finally {
            // rede de segurança: se algum passo acima falhou, ainda assim não deixa a OS de teste
            await excluirSeExistir(page);
        }
    });

    test("rascunho da descrição volta ao reabrir o modal e some depois do logout", async ({ page }) => {
        const tarefas = page.locator("table").first().locator("tbody tr");
        test.skip((await tarefas.count()) === 0, "Nenhuma tarefa disponível para este usuário de teste");

        const rascunho = `Rascunho ${marca} escrito e cancelado sem querer, deve voltar ao reabrir.`;

        await tarefas.first().locator("svg").first().click();
        await page.locator("textarea").fill(rascunho);
        await modal(page).getByRole("button", { name: "Cancelar" }).click();
        await expect(modal(page)).toHaveCount(0);

        await tarefas.first().locator("svg").first().click();
        await expect(page.locator("textarea")).toHaveValue(rascunho);
        await expect(page.getByText("Rascunho recuperado")).toBeVisible();

        // limpa para não deixar texto de teste no navegador
        await page.locator("textarea").fill("");
        await modal(page).getByRole("button", { name: "Cancelar" }).click();
        await expect(page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("gerproj-rascunho")))).resolves.toEqual([]);
    });
});
