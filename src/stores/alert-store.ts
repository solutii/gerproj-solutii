import { create } from "zustand";

export type AlertType = "warning" | "error" | "success" | "info";

type ConfirmOptions = {
    type?: AlertType;
    confirmText?: string;
    cancelText?: string;
    title?: string;
};

export type ChoiceOption = {
    id: string;
    label: string;
};

type ChoiceOptions = {
    type?: AlertType;
    confirmText?: string;
    cancelText?: string;
    message?: string;
};

type AlertStore = {
    isOpen: boolean;
    mode: "alert" | "confirm" | "choice";
    title: string | null;
    message: string;
    type: AlertType;
    confirmText: string;
    cancelText: string;
    options: ChoiceOption[];
    selectedOptionId: string | null;
    resolveConfirm: ((value: boolean) => void) | null;
    resolveChoice: ((value: string | null) => void) | null;
    showAlert: (message: string, type?: AlertType, title?: string) => void;
    showConfirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
    showChoice: (title: string, options: ChoiceOption[], config?: ChoiceOptions) => Promise<string | null>;
    selectOption: (id: string) => void;
    closeAlert: () => void;
    confirm: (value: boolean) => void;
    confirmChoice: () => void;
};

// Substitui os `alert()`/`confirm()` nativos (e o SweetAlert2) por um diálogo
// customizado, consistente com o resto da UI (cores, dark mode, etc).
// `showAlert` é só aviso (botão OK); `showConfirm` retorna uma Promise<boolean>
// (true = confirmou, false = cancelou/fechou); `showChoice` apresenta uma
// lista de opções (seleção única, tipo radio) e retorna o id escolhido, ou
// null se cancelou/fechou sem escolher. Todos podem ser chamados tanto de
// dentro de componentes quanto de funções soltas (ex: homeActions.ts) via
// `useAlertStore.getState().showAlert(...)`.
export const useAlertStore = create<AlertStore>((set, get) => ({
    isOpen: false,
    mode: "alert",
    title: null,
    message: "",
    type: "warning",
    confirmText: "Confirmar",
    cancelText: "Cancelar",
    options: [],
    selectedOptionId: null,
    resolveConfirm: null,
    resolveChoice: null,

    showAlert: (message, type = "warning", title) =>
        set({
            isOpen: true,
            mode: "alert",
            message,
            type,
            title: title ?? null,
            resolveConfirm: null,
            resolveChoice: null,
        }),

    showConfirm: (message, options) =>
        new Promise<boolean>((resolve) => {
            set({
                isOpen: true,
                mode: "confirm",
                message,
                type: options?.type ?? "warning",
                title: options?.title ?? null,
                confirmText: options?.confirmText ?? "Confirmar",
                cancelText: options?.cancelText ?? "Cancelar",
                resolveConfirm: resolve,
                resolveChoice: null,
            });
        }),

    showChoice: (title, options, config) =>
        new Promise<string | null>((resolve) => {
            set({
                isOpen: true,
                mode: "choice",
                title,
                message: config?.message ?? "",
                type: config?.type ?? "info",
                confirmText: config?.confirmText ?? "Confirmar",
                cancelText: config?.cancelText ?? "Cancelar",
                options,
                selectedOptionId: null,
                resolveChoice: resolve,
                resolveConfirm: null,
            });
        }),

    selectOption: (id) => set({ selectedOptionId: id }),

    confirm: (value) => {
        get().resolveConfirm?.(value);
        set({ isOpen: false, resolveConfirm: null });
    },

    confirmChoice: () => {
        get().resolveChoice?.(get().selectedOptionId);
        set({ isOpen: false, resolveChoice: null, selectedOptionId: null });
    },

    closeAlert: () => {
        get().resolveChoice?.(null);
        set({ isOpen: false, resolveChoice: null, selectedOptionId: null });
    },
}));
