import { useThemeStore } from "@/stores/theme-store";

// Cores dos gráficos (canvas não lê as classes do Tailwind, então o tema claro/
// escuro é passado explicitamente). Semântica: verde = bom, âmbar = atenção,
// vermelho = problema; azul/ciano = série neutra.
export type TemaGrafico = {
  foreground: string;
  muted: string;
  grid: string;
  azul: string;
  ciano: string;
  verde: string;
  ambar: string;
  vermelho: string;
};

const CLARO: TemaGrafico = {
  foreground: "#1e293b",
  muted: "#64748b",
  grid: "#e2e8f0",
  azul: "#0f3d63",
  ciano: "#0891b2",
  verde: "#16a34a",
  ambar: "#d97706",
  vermelho: "#dc2626",
};

const ESCURO: TemaGrafico = {
  foreground: "#f1f5f9",
  muted: "#94a3b8",
  grid: "#334155",
  azul: "#38bdf8",
  ciano: "#22d3ee",
  verde: "#4ade80",
  ambar: "#fbbf24",
  vermelho: "#f87171",
};

export function useTemaGrafico(): TemaGrafico {
  const tema = useThemeStore((s) => s.theme);

  return tema === "dark" ? ESCURO : CLARO;
}

// Tema no formato do `defineChart` (fundo transparente: o cartão já tem o fundo).
export function temaDoChart(c: TemaGrafico) {
  return {
    foreground: c.foreground,
    muted: c.muted,
    grid: c.grid,
    background: "transparent",
    palette: [c.azul, c.ciano, c.verde, c.ambar, c.vermelho],
  };
}
