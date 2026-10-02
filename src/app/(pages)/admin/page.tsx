"use client";

import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { TbSettings } from "react-icons/tb";
import SessionGuard from "@/components/session-guard";
import UserComponent from "@/components/user";
import Loading from "@/components/loading";
import { useDashboardAdmin } from "@/hooks/queries/admin";
import { ehAdministrador, PAGINA_CONSULTOR } from "@/utils/perfil";
import { mesAtual } from "@/utils/painel/periodo";
import ConsultoresAba from "./_components/ConsultoresAba";
import BadgeAtualizacao from "./_components/dashboard/BadgeAtualizacao";
import DashboardAba from "./_components/dashboard/DashboardAba";
import HistoricoAba from "./_components/HistoricoAba";
import TarefasAba from "./_components/TarefasAba";

type Aba = "dashboard" | "consultores" | "tarefas" | "historico";

const ABAS: { id: Aba; texto: string }[] = [
  { id: "dashboard", texto: "Dashboard" },
  { id: "consultores", texto: "Consultores" },
  { id: "tarefas", texto: "Tarefas" },
  { id: "historico", texto: "Histórico" },
];

// Painel de controle do administrador: é a ÚNICA página que o usuário ADM enxerga.
// (O middleware já leva o ADM para cá e o consultor para fora; esta conferência na
// tela só evita mostrar o painel por um instante a quem não deveria.)
export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("dashboard");
  const admin = status === "authenticated" && ehAdministrador(session?.user?.tipo);
  // o dashboard vive aqui para o badge de atualização ficar no cabeçalho; só busca com a aba aberta
  const [mesDoDashboard, setMesDoDashboard] = useState(() => mesAtual());
  const dashboard = useDashboardAdmin(mesDoDashboard, admin && aba === "dashboard");

  useEffect(() => {
    if (status === "authenticated" && !admin) router.replace(PAGINA_CONSULTOR);
  }, [status, admin, router]);

  if (!admin) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Loading />
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen w-full flex-col items-center overflow-hidden bg-slate-50 dark:bg-slate-900">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(15,61,99,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,61,99,0.035)_1px,transparent_1px)] bg-[size:40px_40px] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)]"
      />
      <TbSettings
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 select-none text-[#0f3d63]/[0.03] dark:text-white/[0.03]"
        size={480}
      />

      <SessionGuard />

      <div className="relative z-10 w-full">
        <UserComponent signOut={signOut} semAreas />
      </div>

      <div className="relative z-10 flex w-full flex-col gap-6 px-4 pb-[60px] pt-6 sm:px-10 lg:px-[80px]">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            <div className="flex flex-col gap-2">
              <h1 className="bg-gradient-to-r from-[#0f3d63] via-cyan-500 to-[#0f3d63] bg-clip-text text-3xl font-black tracking-tight text-transparent drop-shadow-sm dark:from-cyan-300 dark:via-white dark:to-cyan-300 sm:text-4xl">
                Painel de Controle
              </h1>
              <span className="block h-1.5 w-20 rounded-full bg-gradient-to-r from-[#0f3d63] to-cyan-400" />
            </div>
            {aba === "dashboard" && (
              <BadgeAtualizacao
                geradoEm={dashboard.consulta.data?.geradoEm}
                ultimaBuscaEm={dashboard.ultimaBuscaEm}
                atualizando={dashboard.consulta.isFetching || dashboard.atualizar.isPending}
                falhou={(dashboard.consulta.isError || dashboard.atualizar.isError) && !!dashboard.consulta.data}
                onAtualizar={() => dashboard.atualizar.mutate()}
              />
            )}
          </div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Números de todos os consultores e as permissões que só o administrador altera. Toda mudança de permissão é registrada no histórico (quem, quando, valor antes e depois).
          </p>
        </div>

        <div role="tablist" aria-label="Seções do painel" className="mx-auto flex w-full max-w-2xl flex-row rounded-full bg-slate-300 p-1 dark:bg-slate-700">
          {ABAS.map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={aba === a.id}
              onClick={() => setAba(a.id)}
              className={
                aba === a.id
                  ? "flex-1 cursor-pointer rounded-full bg-[#0f3d63] py-2 text-sm font-semibold text-white transition depth-btn dark:bg-[#081c2e]"
                  : "flex-1 cursor-pointer rounded-full py-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              }
            >
              {a.texto}
            </button>
          ))}
        </div>

        <div role="tabpanel">
          {aba === "dashboard" && <DashboardAba mes={mesDoDashboard} onMudarMes={setMesDoDashboard} dashboard={dashboard} />}
          {aba === "consultores" && <ConsultoresAba />}
          {aba === "tarefas" && <TarefasAba />}
          {aba === "historico" && <HistoricoAba />}
        </div>
      </div>
    </main>
  );
}
