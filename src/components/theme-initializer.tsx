"use client";

import { useLayoutEffect } from "react";
import { useThemeStore } from "@/stores/theme-store";

// A store sempre nasce com theme "light" (precisa ser igual no servidor e no
// cliente pra não dar hydration mismatch). Aqui corrigimos pro valor real
// assim que possível: useLayoutEffect roda de forma síncrona, antes do
// navegador pintar a tela, lendo a classe "dark" que o script inline do
// <head> já aplicou na <html> -- então o toggle nunca chega a mostrar o
// estado errado (nem o valor "light" do primeiro render).
export default function ThemeInitializer() {
    const theme = useThemeStore((state) => state.theme);
    const setTheme = useThemeStore((state) => state.setTheme);
    const setHasHydrated = useThemeStore((state) => state.setHasHydrated);

    useLayoutEffect(() => {
        const isDark = document.documentElement.classList.contains("dark");
        if (isDark && theme !== "dark") {
            setTheme("dark");
        }
        setHasHydrated();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useLayoutEffect(() => {
        document.documentElement.classList.toggle("dark", theme === "dark");
    }, [theme]);

    return null;
}
