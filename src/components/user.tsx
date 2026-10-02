// (arquivo completo /c:/Users/Solutii/OneDrive/Documentos/Projetos/gerproj-solutii/components/user.tsx)
import React, { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { useThemeStore } from "@/stores/theme-store";
import { TbMoon, TbSun, TbX, TbDoorExit } from "react-icons/tb";
import Tooltip from "@/components/tooltip";
import { useAreas } from "@/hooks/queries/leituras";
import { useSalvarAreas } from "@/hooks/queries/mutacoes";
import { mensagemDoErro } from "@/lib/api";
import type { Area } from "@/lib/api-home";
import { limparCacheDoUsuario } from "@/lib/query-client";
import { limparTodosRascunhos } from "@/utils/rascunho";

type UserProps = {
  signOut: () => void;
  onSave?: (areas: string[]) => void;
  // Painel do administrador: sem o botão "Área Atuação" (é do consultor e usa rotas dele)
  semAreas?: boolean;
};

/**
 * Hook to manage OBS_RECAREA state per area (max 250 chars).
 * Returns:
 *  - obsMap: Record<COD_AREA, OBS_RECAREA>
 *  - setObs: (codArea, text) => void
 *  - ensureFromAreas: initialize map from Area[] (keeps existing keys)
 */

export function useObsMap(initialAreas: Area[] = []) {
  const [obsMap, setObsMap] = useState<Record<number, string>>(() => {
    const m: Record<number, string> = {};
    initialAreas.forEach((a) => {
      if (a.OBS_RECAREA) m[a.COD_AREA] = a.OBS_RECAREA.slice(0, 250);
    });
    return m;
  });

  const setObs = useCallback((codArea: number, text: string) => {
    setObsMap((prev) => {
      const next = { ...prev, [codArea]: text.slice(0, 250) };
      return next;
    });
  }, []);

  const ensureFromAreas = useCallback((areas: Area[]) => {
    setObsMap((prev) => {
      const next = { ...prev };
      areas.forEach((a) => {
        if (a.OBS_RECAREA && !(a.COD_AREA in next)) {
          next[a.COD_AREA] = a.OBS_RECAREA.slice(0, 250);
        }
      });
      return next;
    });
  }, []);

  return { obsMap, setObs, ensureFromAreas };
}

export default function UserComponent({ signOut, onSave, semAreas = false }: UserProps) {
  const [openSettings, setOpenSettings] = useState(false);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  function handleSignOut() {
    setIsLoggingOut(true);
    limparCacheDoUsuario(); // nada do usuário atual pode sobrar no cache
    limparTodosRascunhos();
    signOut();
  }

  const { data: session } = useSession();
  const { theme, toggleTheme, hasHydrated } = useThemeStore();

  // obs map hook
  const { obsMap, setObs, ensureFromAreas } = useObsMap();

  // novo: estado de salvamento / feedback
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Áreas disponíveis (Query): buscadas ao abrir as configurações e mantidas em
  // cache; só mudam depois de salvar. O formulário edita uma cópia local.
  const areasQuery = useAreas(openSettings);
  const availableAreas: Area[] = areasQuery.data ?? [];
  const loadingAreas = areasQuery.isLoading;
  const salvarAreasMutation = useSalvarAreas();

  // Ao abrir (ou quando as áreas chegam/são salvas), a cópia local volta ao
  // que está cadastrado -- marcações não salvas de uma abertura anterior são descartadas.
  useEffect(() => {
    if (!openSettings || !areasQuery.data) return;

    const areas = areasQuery.data;
    setSelectedAreas(areas.filter((a) => a.SELECTED === "1").map((a) => a.NOME_AREA));
    // populate obsMap from fetched areas' OBS_RECAREA
    ensureFromAreas(areas);
  }, [openSettings, areasQuery.data, ensureFromAreas]);

  const toggleArea = (name: string) => {
    setSelectedAreas((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name],
    );
  };

  // Modificada: agora envia para /api/recarea os COD_AREA selecionados com suas observações
  const save = async () => {
    if (saving) return; // evita duplo envio
    // montar payload a partir das áreas disponíveis e nomes selecionados
    const items = availableAreas
      .filter((a) => selectedAreas.includes(a.NOME_AREA))
      .map((a) => ({
        COD_AREA: a.COD_AREA,
        OBS_RECAREA: obsMap[a.COD_AREA] ?? "",
      }));

    try {
      setSaving(true);
      setSaveMessage("Enviando...");
      await salvarAreasMutation.mutateAsync(
        items.map((it) => ({
          COD_RECURSO: session?.user?.recurso ?? "",
          COD_AREA: it.COD_AREA,
          OBS_RECAREA: (it.OBS_RECAREA ?? "").slice(0, 250),
        })),
      );

      setSaveMessage("Áreas de atuação salvas com sucesso!");
      onSave?.(selectedAreas);
      // fecha modal após breve delay para usuário ver a mensagem
      setTimeout(() => {
        setOpenSettings(false);
        setSaving(false);
        setSaveMessage(null);
      }, 700);
    } catch (err) {
      console.error("Erro ao salvar as áreas de atuação:", err);
      // mantém botão habilitado para tentar novamente
      setSaveMessage(
        mensagemDoErro(err, "Não foi possível salvar as áreas de atuação. Tente novamente."),
      );
      setSaving(false);
    }
  };

  return (
    <header className="flex flex-col w-full bg-[#0f3d63] shadow-md">
      <div className="flex items-center justify-between w-full px-6 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-white whitespace-nowrap">
            Solutii <span className="font-light text-cyan-300">Sistemas</span>
          </h1>
          <span className="hidden sm:inline text-cyan-100/30">|</span>
          <p className="hidden sm:block text-cyan-100 text-sm font-medium truncate">
            {session?.user?.name ?? "Usuário"}
          </p>
        </div>
        <div className="flex gap-8 shrink-0">
          <Tooltip content={theme === "dark" ? "Modo claro" : "Modo escuro"}>
            <button
              type="button"
              role="switch"
              aria-checked={theme === "dark"}
              className={
                "group relative w-[72px] h-[34px] shrink-0 rounded-full transition-all shadow-[inset_0_2px_6px_rgba(0,0,0,0.45)] ring-1 ring-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f3d63] " +
                (hasHydrated ? "duration-500 " : "duration-0 ") +
                (theme === "dark"
                  ? "bg-gradient-to-b from-[#0b1330] via-[#111a3d] to-[#0b1330]"
                  : "bg-gradient-to-b from-sky-300 via-sky-400 to-cyan-400")
              }
              onClick={toggleTheme}
              aria-label={
                theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"
              }
            >
              {/* estrelinhas piscando -- só visíveis no escuro */}
              <span
                className={
                  "absolute w-[3px] h-[3px] rounded-full bg-white top-[7px] left-[10px] transition-opacity " +
                  (hasHydrated ? "duration-500 " : "duration-0 ") +
                  (theme === "dark" ? "opacity-90 animate-pulse" : "opacity-0")
                }
              />
              <span
                className={
                  "absolute w-[2px] h-[2px] rounded-full bg-white top-[22px] left-[16px] transition-opacity " +
                  (hasHydrated ? "duration-500 delay-100 " : "duration-0 ") +
                  (theme === "dark" ? "opacity-70 animate-pulse" : "opacity-0")
                }
              />
              <span
                className={
                  "absolute w-[2px] h-[2px] rounded-full bg-cyan-100 top-[13px] left-[22px] transition-opacity " +
                  (hasHydrated ? "duration-500 delay-200 " : "duration-0 ") +
                  (theme === "dark" ? "opacity-80 animate-pulse" : "opacity-0")
                }
              />

              {/* nuvenzinhas -- só visíveis no claro */}
              <span
                className={
                  "absolute w-3 h-1.5 rounded-full bg-white/70 top-[8px] left-[9px] blur-[1px] transition-opacity " +
                  (hasHydrated ? "duration-500 " : "duration-0 ") +
                  (theme === "dark" ? "opacity-0" : "opacity-90")
                }
              />
              <span
                className={
                  "absolute w-2 h-1 rounded-full bg-white/60 top-[21px] left-[13px] blur-[1px] transition-opacity " +
                  (hasHydrated ? "duration-500 delay-100 " : "duration-0 ") +
                  (theme === "dark" ? "opacity-0" : "opacity-80")
                }
              />

              {/* sol/lua -- desliza com um leve "bounce" e brilha (glow) */}
              <span
                className={
                  "absolute top-1/2 -translate-y-1/2 left-1 z-10 flex items-center justify-center w-[26px] h-[26px] rounded-full transition-all ease-[cubic-bezier(0.34,1.56,0.64,1)] " +
                  (hasHydrated ? "duration-500 " : "duration-0 ") +
                  (theme === "dark"
                    ? "translate-x-[38px] bg-gradient-to-br from-slate-200 to-slate-400 shadow-[0_0_10px_2px_rgba(165,180,252,0.55)]"
                    : "translate-x-0 bg-gradient-to-br from-yellow-200 to-amber-400 shadow-[0_0_14px_4px_rgba(251,191,36,0.65)]")
                }
              >
                {theme === "dark" ? (
                  <TbMoon size={14} className="text-slate-600 depth-icon" />
                ) : (
                  <TbSun size={14} className="text-amber-600 depth-icon" />
                )}
              </span>
            </button>
          </Tooltip>
          {!semAreas && (
            <button
              className="px-3 py-1.5 text-sm font-medium text-white bg-white/10 border border-white/10 rounded-lg depth-btn transition-all duration-150 hover:bg-white/20 hover:border-white/30 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f3d63]"
              onClick={() => setOpenSettings(true)}
              aria-label="Área Atuação"
            >
              Área Atuação
            </button>
          )}
          <button
            className="px-3 py-1.5 text-sm font-medium text-white bg-red-500 rounded-lg depth-btn transition-all duration-150 hover:bg-red-700 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f3d63]"
            onClick={handleSignOut}
            aria-label="Logout"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Portal no body: o header vive num wrapper `relative z-10`, que prende o z-50 do
                modal dentro de um contexto de empilhamento e deixa o conteúdo da página (também
                z-10, mais adiante no DOM) por cima dele. */}
      {openSettings &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              onClick={() => setOpenSettings(false)}
            >
              <div
                className="relative w-full max-w-xl rounded-2xl shadow-xl bg-white dark:bg-slate-800 max-h-[80vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    Áreas de atuação
                  </h3>
                  <button
                    type="button"
                    onClick={() => setOpenSettings(false)}
                    aria-label="Fechar"
                    className="p-1.5 rounded-full text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors outline-none focus:outline-none"
                  >
                    <TbX size={20} className="depth-icon" />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto">
                  {/* feedback aria-live */}
                  <div
                    className="mb-3 text-sm min-h-[1.25rem]"
                    aria-live="polite"
                  >
                    {saveMessage && (
                      <span className="text-slate-600 dark:text-slate-300">
                        {saveMessage}
                      </span>
                    )}
                  </div>

                  {loadingAreas ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Carregando áreas...
                    </p>
                  ) : (
                    <div>
                      {availableAreas.length === 0 && (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Nenhuma área disponível
                        </p>
                      )}
                      <ul className="flex flex-col gap-3">
                        {availableAreas
                          .sort(
                            (a, b) =>
                              parseInt(b.SELECTED ?? "0") -
                              parseInt(a.SELECTED ?? "0"),
                          )
                          .map((area) => {
                            const name = area.NOME_AREA;
                            const checked = selectedAreas.includes(name);
                            return (
                              <li
                                key={area.COD_AREA}
                                className="flex flex-col gap-2"
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    id={`area-${area.COD_AREA}`}
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleArea(name)}
                                    className="w-4 h-4 accent-[#0f3d63]"
                                  />
                                  <label
                                    htmlFor={`area-${area.COD_AREA}`}
                                    className="text-sm text-slate-700 dark:text-slate-200"
                                  >
                                    {name}
                                  </label>
                                </div>

                                {/* show OBS_RECAREA textarea when selected */}
                                {checked && (
                                  <textarea
                                    value={obsMap[area.COD_AREA] ?? ""}
                                    onChange={(e) => {
                                      const sanitized = e.target.value
                                        .normalize("NFD")
                                        .replace(/[\u0300-\u036f]/g, "")
                                        .replace(
                                          /[^a-zA-Z0-9\s.,;:!?\-()]/g,
                                          "",
                                        );
                                      setObs(area.COD_AREA, sanitized);
                                    }}
                                    maxLength={250}
                                    placeholder="Observação (máx 250 caracteres)"
                                    className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg p-2 text-sm resize-y outline-none focus:border-[#0f3d63] focus:ring-2 focus:ring-[#0f3d63]/20"
                                    rows={3}
                                  />
                                )}
                              </li>
                            );
                          })}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200 dark:border-slate-700">
                  <button
                    className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-200 rounded-md border border-slate-400 dark:border-slate-600 bg-gradient-to-br from-white to-slate-100 dark:from-slate-700 dark:to-slate-800 depth-btn-soft transition-all hover:-translate-y-0.5 active:scale-95 outline-none focus:outline-none disabled:opacity-60"
                    onClick={() => setOpenSettings(false)}
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                  <button
                    className="bg-[#0f3d63] text-white font-semibold text-sm px-5 py-2 rounded-lg depth-btn transition-all hover:bg-[#0c3252] hover:-translate-y-0.5 active:scale-95 outline-none focus:outline-none flex items-center gap-2 disabled:opacity-60"
                    onClick={save}
                    disabled={saving}
                    aria-busy={saving}
                  >
                    {saving ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </div>
            </div>
            <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm" />
          </>,
          document.body,
        )}

      {/* Portal no body pelo mesmo motivo do modal de Áreas de atuação acima:
                sem isso, o overlay herda o contexto de empilhamento do header e
                fica atrás do conteúdo da página. */}
      {isLoggingOut &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gradient-to-br from-[#0a2540] via-[#0f3d63] to-[#155a8a]">
            <div className="flex flex-col items-center gap-5">
              <div className="relative flex items-center justify-center w-20 h-20">
                <span className="absolute inset-0 rounded-full bg-cyan-300/20 animate-ping" />
                <span className="relative flex items-center justify-center w-16 h-16 rounded-full bg-white/10 border border-white/20">
                  <TbDoorExit size={30} className="text-cyan-200 depth-icon" />
                </span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <p className="text-white font-semibold text-lg">Saindo...</p>
                <p className="text-cyan-100/70 text-sm">Até logo!</p>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </header>
  );
}
