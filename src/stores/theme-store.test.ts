import { beforeEach, describe, expect, it } from "vitest";
import { useThemeStore } from "./theme-store";

beforeEach(() => {
    localStorage.clear();
    useThemeStore.setState({ theme: "light" });
});

describe("toggleTheme", () => {
    it("alterna de light para dark", () => {
        useThemeStore.getState().toggleTheme();
        expect(useThemeStore.getState().theme).toBe("dark");
    });

    it("alterna de volta de dark para light", () => {
        useThemeStore.setState({ theme: "dark" });
        useThemeStore.getState().toggleTheme();
        expect(useThemeStore.getState().theme).toBe("light");
    });
});

describe("setTheme", () => {
    it("define o tema diretamente", () => {
        useThemeStore.getState().setTheme("dark");
        expect(useThemeStore.getState().theme).toBe("dark");
    });
});

describe("persistência no localStorage", () => {
    it("persiste o tema escolhido sob a chave 'gerproj-theme'", () => {
        useThemeStore.getState().setTheme("dark");

        const raw = localStorage.getItem("gerproj-theme");
        expect(raw).not.toBeNull();
        expect(JSON.parse(raw as string).state.theme).toBe("dark");
    });
});
