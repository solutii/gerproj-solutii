import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHomeStore } from "@/stores/home-store";
import { ChamadosType } from "@/types/chamados";
import { TaskType } from "@/types/tarefa";
import {
    changeSelectedCall,
    changeSelectedCallTrf,
    closeAccessModal,
    closeApontamentoModal,
    closeEditOsModal,
    closeStandbyModal,
    handleEdit,
    openAccess,
    openDescriptions,
    validCurrentDate,
} from "./homeActions";

const INITIAL_STATE = useHomeStore.getState();

beforeEach(() => {
    useHomeStore.setState(INITIAL_STATE, true);
});

function makeChamado(overrides: Partial<ChamadosType> = {}): ChamadosType {
    return {
        COD_CHAMADO: 15102,
        DATA_CHAMADO: "",
        HORA_CHAMADO: "",
        SOLICITACAO_CHAMADO: "",
        CONCLUSAO_CHAMADO: "",
        STATUS_CHAMADO: "ATRIBUIDO",
        DTENVIO_CHAMADO: "",
        COD_RECURSO: 1,
        CLIENTE_CHAMADO: "",
        CODTRF_CHAMADO: 0,
        COD_CLIENTE: 1,
        SOLICITACAO2_CHAMADO: "",
        ASSUNTO_CHAMADO: "Teste",
        EMAIL_CHAMADO: "teste@solutii.com.br",
        PRIOR_CHAMADO: 1,
        COD_CLASSIFICACAO: 1,
        NOME_CLIENTE: "Cliente Teste",
        ...overrides,
    };
}

function makeTask(overrides: Partial<TaskType> = {}): TaskType {
    return {
        COD_OS: "1",
        COD_TAREFA: "1099",
        NOME_TAREFA: "HORAS INTERNAS",
        CODPRO_TAREFA: "",
        DTSOL_TAREFA: "",
        DTAPROV_TAREFA: "",
        DTPREVENT_TAREFA: "",
        HREST_TAREFA: "",
        STATUS_TAREFA: 1,
        OBS_TAREFA: "",
        RESPCLI_PROJETO: "",
        ...overrides,
    };
}

describe("changeSelectedCall", () => {
    it("seleciona um chamado e limpa a tarefa/data selecionadas", () => {
        const chamado = makeChamado();
        useHomeStore.getState().setSelectedProj(makeTask());
        useHomeStore.getState().setSelectedDate("2026-09-01");

        changeSelectedCall(chamado);

        expect(useHomeStore.getState().selectedCall).toEqual(chamado);
        expect(useHomeStore.getState().selectedProj).toBeNull();
        expect(useHomeStore.getState().selectedDate).toBe("");
    });

    it("desmarca (toggle off) ao clicar de novo no mesmo chamado já selecionado", () => {
        const chamado = makeChamado();
        changeSelectedCall(chamado);

        useHomeStore.getState().setListOs([{ COD_OS: 1 }]);
        changeSelectedCall(chamado);

        expect(useHomeStore.getState().selectedCall).toBeNull();
        expect(useHomeStore.getState().listOs).toEqual([]);
    });

    it("troca de um chamado para outro normalmente (sem toggle off)", () => {
        const chamadoA = makeChamado({ COD_CHAMADO: 1 });
        const chamadoB = makeChamado({ COD_CHAMADO: 2 });

        changeSelectedCall(chamadoA);
        changeSelectedCall(chamadoB);

        expect(useHomeStore.getState().selectedCall?.COD_CHAMADO).toBe(2);
    });
});

describe("changeSelectedCallTrf", () => {
    it("seleciona uma tarefa e limpa o chamado selecionado", () => {
        const task = makeTask();
        useHomeStore.getState().setSelectedCall(makeChamado());

        changeSelectedCallTrf(task);

        expect(useHomeStore.getState().selectedProj).toEqual(task);
        expect(useHomeStore.getState().selectedCall).toBeNull();
    });

    it("desmarca (toggle off) ao clicar de novo na mesma tarefa já selecionada", () => {
        const task = makeTask();
        changeSelectedCallTrf(task);

        useHomeStore.getState().setListOs([{ COD_OS: 1 }]);
        changeSelectedCallTrf(task);

        expect(useHomeStore.getState().selectedProj).toBeNull();
        expect(useHomeStore.getState().listOs).toEqual([]);
    });
});

describe("openDescriptions", () => {
    it("remove tags HTML e blocos <style> do texto da solicitação, e abre o modal", () => {
        const chamado = makeChamado({
            SOLICITACAO_CHAMADO:
                "<style>.shape{behavior:url(#default#VML);}</style><p>Olá <b>mundo</b>!</p>",
        });

        openDescriptions(chamado);

        expect(useHomeStore.getState().descriptionText).toBe("Olá mundo !");
        expect(useHomeStore.getState().selectedCall).toEqual(chamado);
        expect(useHomeStore.getState().isOpenModal).toBe(true);
    });
});

describe("openAccess", () => {
    it("preenche o texto de acesso já cadastrado e abre o modal", () => {
        const chamado = makeChamado({ ACESSO_CLIENTE: "usuario / senha123" });

        openAccess(chamado);

        expect(useHomeStore.getState().accessText).toBe("usuario / senha123");
        expect(useHomeStore.getState().accessCliente).toBe(chamado.COD_CLIENTE);
        expect(useHomeStore.getState().selectedCall).toEqual(chamado);
        expect(useHomeStore.getState().isOpenModal2).toBe(true);
    });

    it("usa uma mensagem padrão quando não há acesso cadastrado", () => {
        const chamado = makeChamado({ ACESSO_CLIENTE: undefined });

        openAccess(chamado);

        expect(useHomeStore.getState().accessText).toBe("Acesso não informado!");
    });
});

describe("handleEdit", () => {
    it("preenche os campos de apontamento a partir da OS e abre o modal de edição", () => {
        const os = {
            COD_OS: 1,
            HRINI_OS: "0800",
            HRFIM_OS: "1200",
            OBS: "Atendimento remoto",
            DTINI_OS: "2026-09-10T00:00:00.000Z",
        };

        handleEdit(os);

        const state = useHomeStore.getState();
        expect(state.hours).toEqual({ initial: "08:00", final: "12:00" });
        expect(state.description).toBe("Atendimento remoto");
        expect(state.date).toBe("2026-09-10");
        expect(state.selectedOs).toEqual(os);
        expect(state.modalEditOS).toBe(true);
    });
});

describe("fechar modais de apontamento sem confirmar limpa os campos", () => {
    beforeEach(() => {
        useHomeStore.setState({
            description: "rascunho",
            hours: { initial: "08:00", final: "12:00" },
        });
    });

    it("closeStandbyModal limpa os campos ao fechar", () => {
        closeStandbyModal(false);

        const state = useHomeStore.getState();
        expect(state.description).toBe("");
        expect(state.hours).toEqual({ initial: "", final: "" });
        expect(state.modalStandby).toBe(false);
    });

    it("closeApontamentoModal limpa os campos ao fechar", () => {
        closeApontamentoModal(false);

        expect(useHomeStore.getState().description).toBe("");
        expect(useHomeStore.getState().modalApontamento).toBe(false);
    });

    it("closeEditOsModal limpa os campos ao fechar", () => {
        closeEditOsModal(false);

        expect(useHomeStore.getState().description).toBe("");
        expect(useHomeStore.getState().modalEditOS).toBe(false);
    });

    it("não limpa os campos quando o modal é aberto (open=true)", () => {
        closeStandbyModal(true);

        expect(useHomeStore.getState().description).toBe("rascunho");
        expect(useHomeStore.getState().modalStandby).toBe(true);
    });
});

describe("closeAccessModal", () => {
    it("limpa o texto de acesso ao fechar sem salvar", () => {
        useHomeStore.setState({ accessText: "rascunho de acesso" });

        closeAccessModal(false);

        expect(useHomeStore.getState().accessText).toBe("");
        expect(useHomeStore.getState().isOpenModal2).toBe(false);
    });
});

describe("validCurrentDate", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-09-10T12:00:00"));
        useHomeStore.getState().setLimitDate(new Date("2026-09-01T00:00:00"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("aceita uma data dentro do período vigente", () => {
        expect(validCurrentDate("2026-09-05")).toBe(true);
    });

    it("rejeita uma data anterior ao limite", () => {
        expect(validCurrentDate("2026-08-31")).toBe(false);
    });

    it("rejeita uma data futura (depois de amanhã)", () => {
        expect(validCurrentDate("2026-09-12")).toBe(false);
    });

    it("aceita a data de hoje", () => {
        expect(validCurrentDate("2026-09-10")).toBe(true);
    });
});
