import { beforeEach, describe, expect, it } from "vitest";
import { useAlertStore } from "./alert-store";

const INITIAL_STATE = useAlertStore.getState();

beforeEach(() => {
    useAlertStore.setState(INITIAL_STATE, true);
});

describe("showAlert", () => {
    it("abre o diálogo no modo alerta com o tipo padrão 'warning'", () => {
        useAlertStore.getState().showAlert("Selecione um chamado!");

        const state = useAlertStore.getState();
        expect(state.isOpen).toBe(true);
        expect(state.mode).toBe("alert");
        expect(state.message).toBe("Selecione um chamado!");
        expect(state.type).toBe("warning");
        expect(state.title).toBeNull();
    });

    it("aceita um tipo e um título customizados", () => {
        useAlertStore.getState().showAlert("Upload realizado!", "success", "Sucesso");

        const state = useAlertStore.getState();
        expect(state.type).toBe("success");
        expect(state.title).toBe("Sucesso");
    });
});

describe("closeAlert", () => {
    it("fecha o diálogo sem resolver nenhuma confirmação pendente", () => {
        useAlertStore.getState().showAlert("aviso qualquer");
        useAlertStore.getState().closeAlert();

        expect(useAlertStore.getState().isOpen).toBe(false);
    });
});

describe("showConfirm", () => {
    it("abre o diálogo no modo confirmação com os textos padrão", () => {
        useAlertStore.getState().showConfirm("Deseja excluir a OS #1?");

        const state = useAlertStore.getState();
        expect(state.isOpen).toBe(true);
        expect(state.mode).toBe("confirm");
        expect(state.confirmText).toBe("Confirmar");
        expect(state.cancelText).toBe("Cancelar");
    });

    it("resolve `true` quando confirm(true) é chamado", async () => {
        const promise = useAlertStore.getState().showConfirm("Confirma?");

        useAlertStore.getState().confirm(true);

        await expect(promise).resolves.toBe(true);
        expect(useAlertStore.getState().isOpen).toBe(false);
    });

    it("resolve `false` quando confirm(false) é chamado (cancelar/fechar)", async () => {
        const promise = useAlertStore.getState().showConfirm("Confirma?");

        useAlertStore.getState().confirm(false);

        await expect(promise).resolves.toBe(false);
    });

    it("aceita textos e tipo customizados para os botões", () => {
        useAlertStore.getState().showConfirm("Esta ação não poderá ser desfeita!", {
            title: "Deseja excluir a OS #1?",
            confirmText: "Sim, excluir!",
            cancelText: "Cancelar",
            type: "error",
        });

        const state = useAlertStore.getState();
        expect(state.title).toBe("Deseja excluir a OS #1?");
        expect(state.confirmText).toBe("Sim, excluir!");
        expect(state.type).toBe("error");
    });
});
