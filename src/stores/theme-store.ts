import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "light" | "dark";

type ThemeStore = {
    theme: Theme;
    // true depois que o ThemeInitializer corrige o tema (se precisar) na
    // primeira carga. Enquanto false, componentes com transição (o toggle)
    // devem desligar a animação -- senão essa correção inicial anima como
    // se fosse uma troca de tema de verdade, dando a impressão de "piscar".
    hasHydrated: boolean;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
    setHasHydrated: () => void;
};

// O valor inicial tem que ser igual no servidor e no cliente (senão dá erro
// de hydration mismatch) -- por isso sempre "light" aqui. A correção pro
// tema real (persistido) acontece via useLayoutEffect no ThemeInitializer,
// antes do navegador pintar a tela, então não há flash visível.
export const useThemeStore = create<ThemeStore>()(
    persist(
        (set) => ({
            theme: "light",
            hasHydrated: false,
            toggleTheme: () => set((state) => ({ theme: state.theme === "light" ? "dark" : "light" })),
            setTheme: (theme) => set({ theme }),
            setHasHydrated: () => set({ hasHydrated: true }),
        }),
        { name: "gerproj-theme", partialize: (state) => ({ theme: state.theme }) }
    )
);
