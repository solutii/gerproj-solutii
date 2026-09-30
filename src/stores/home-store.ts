import { create } from "zustand";
import { agoraNoFuso } from "@/utils/horario-futuro";
import { ChamadosType } from "@/types/chamados";
import { TaskType } from "@/types/tarefa";

// Estado da tela /home, antes espalhado em ~31 useState dentro do
// componente. Migrado 1:1 (mesmos nomes, mesmo formato de setter) para uma
// store única -- é o primeiro passo antes de quebrar a tela em componentes
// menores; a store permite que os componentes futuros assinem só o pedaço
// de estado que usam, em vez de tudo re-renderizar junto como hoje.
//
// setHours, setSelectedCall e setSelectedProj aceitam tanto um valor direto
// quanto uma função atualizadora (o mesmo formato duplo do setState do
// React), porque o código original usa as duas formas em pontos diferentes.

type Updater<T> = T | ((prev: T) => T);

function resolveUpdater<T>(updater: Updater<T>, prev: T): T {
    return typeof updater === "function" ? (updater as (prev: T) => T)(prev) : updater;
}

type Hours = { initial: string; final: string };

interface HomeState {
    calls: ChamadosType[];
    setCalls: (calls: ChamadosType[]) => void;

    tab: "chamado" | "os";
    setTab: (tab: "chamado" | "os") => void;

    projes: TaskType[];
    setProjes: (projes: TaskType[]) => void;

    isOpenModal: boolean;
    setOpenModal: (open: boolean) => void;

    isOpenModal2: boolean;
    setOpenModal2: (open: boolean) => void;

    description: string;
    setDescription: (description: string) => void;

    selectedCall: ChamadosType | null;
    setSelectedCall: (updater: Updater<ChamadosType | null>) => void;

    selectedOs: any | null;
    setSelectedOs: (os: any | null) => void;

    selectedProj: TaskType | null;
    setSelectedProj: (updater: Updater<TaskType | null>) => void;

    modalStandby: boolean;
    setModalStandby: (open: boolean) => void;

    modalApontamento: boolean;
    setModalApontamento: (open: boolean) => void;

    modalClassificacao: boolean;
    setModalClassificacao: (open: boolean) => void;

    modalTarefa: boolean;
    setModalTarefa: (open: boolean) => void;

    modalEditOS: boolean;
    setModalEditOS: (open: boolean) => void;

    isUploading: boolean;
    setIsUploading: (uploading: boolean) => void;

    isChangeAccess: boolean;
    setIsChangeAccess: (changing: boolean) => void;

    isProcessing: boolean;
    setIsProcessing: (processing: boolean) => void;

    loadingOs: boolean;
    setLoadingOs: (loading: boolean) => void;

    loadingTables: boolean;
    setLoadingTables: (loading: boolean) => void;

    listOs: any[];
    setListOs: (list: any[]) => void;

    hours: Hours;
    setHours: (updater: Updater<Hours>) => void;

    selectedTask: any;
    setSelectedTask: (task: any) => void;

    selectedClassificacao: any;
    setSelectedClassificacao: (classificacao: any) => void;

    tasks: any[];
    setTasks: (tasks: any[]) => void;

    classificacao: any[];
    setClassificacao: (classificacao: any[]) => void;

    descriptionText: string;
    setDescriptionText: (text: string) => void;

    accessText: string;
    setAccessText: (text: string) => void;

    // Cliente do chamado sendo editado no AcessoModal -- separado de
    // `selectedCall` pra abrir o modal (ícone "Dados de acesso") não marcar
    // a linha do chamado como selecionada na tabela.
    accessCliente: number | null;
    setAccessCliente: (cliente: number | null) => void;

    date: string;
    setDate: (date: string) => void;

    directionOrder: "asc" | "desc";
    setDirectionOrder: (direction: "asc" | "desc") => void;

    selectedDate: string;
    setSelectedDate: (date: string) => void;

    limitDate: Date | undefined;
    setLimitDate: (date: Date | undefined) => void;

    tomorrow: Date | undefined;
    setTomorrow: (date: Date | undefined) => void;
}

export const useHomeStore = create<HomeState>((set) => ({
    calls: [],
    setCalls: (calls) => set({ calls }),

    tab: "chamado",
    setTab: (tab) => set({ tab }),

    projes: [],
    setProjes: (projes) => set({ projes }),

    isOpenModal: false,
    setOpenModal: (isOpenModal) => set({ isOpenModal }),

    isOpenModal2: false,
    setOpenModal2: (isOpenModal2) => set({ isOpenModal2 }),

    description: "",
    setDescription: (description) => set({ description }),

    selectedCall: null,
    setSelectedCall: (updater) =>
        set((state) => ({ selectedCall: resolveUpdater(updater, state.selectedCall) })),

    selectedOs: null,
    setSelectedOs: (selectedOs) => set({ selectedOs }),

    selectedProj: null,
    setSelectedProj: (updater) =>
        set((state) => ({ selectedProj: resolveUpdater(updater, state.selectedProj) })),

    modalStandby: false,
    setModalStandby: (modalStandby) => set({ modalStandby }),

    modalApontamento: false,
    setModalApontamento: (modalApontamento) => set({ modalApontamento }),

    modalClassificacao: false,
    setModalClassificacao: (modalClassificacao) => set({ modalClassificacao }),

    modalTarefa: false,
    setModalTarefa: (modalTarefa) => set({ modalTarefa }),

    modalEditOS: false,
    setModalEditOS: (modalEditOS) => set({ modalEditOS }),

    isUploading: false,
    setIsUploading: (isUploading) => set({ isUploading }),

    isChangeAccess: false,
    setIsChangeAccess: (isChangeAccess) => set({ isChangeAccess }),

    isProcessing: false,
    setIsProcessing: (isProcessing) => set({ isProcessing }),

    loadingOs: false,
    setLoadingOs: (loadingOs) => set({ loadingOs }),

    loadingTables: true,
    setLoadingTables: (loadingTables) => set({ loadingTables }),

    listOs: [],
    setListOs: (listOs) => set({ listOs }),

    hours: { initial: "", final: "" },
    setHours: (updater) => set((state) => ({ hours: resolveUpdater(updater, state.hours) })),

    selectedTask: null,
    setSelectedTask: (selectedTask) => set({ selectedTask }),

    selectedClassificacao: null,
    setSelectedClassificacao: (selectedClassificacao) => set({ selectedClassificacao }),

    tasks: [],
    setTasks: (tasks) => set({ tasks }),

    classificacao: [],
    setClassificacao: (classificacao) => set({ classificacao }),

    descriptionText: "",
    setDescriptionText: (descriptionText) => set({ descriptionText }),

    accessText: "",
    setAccessText: (accessText) => set({ accessText }),

    accessCliente: null,
    setAccessCliente: (accessCliente) => set({ accessCliente }),

    date: agoraNoFuso().data,
    setDate: (date) => set({ date }),

    directionOrder: "desc",
    setDirectionOrder: (directionOrder) => set({ directionOrder }),

    selectedDate: "",
    setSelectedDate: (selectedDate) => set({ selectedDate }),

    limitDate: undefined,
    setLimitDate: (limitDate) => set({ limitDate }),

    tomorrow: undefined,
    setTomorrow: (tomorrow) => set({ tomorrow }),
}));
