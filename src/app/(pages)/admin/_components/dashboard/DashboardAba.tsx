"use client";

import { useState } from "react";
import SeletorMes from "@/app/(pages)/home/_components/painel/SeletorMes";
import type { useDashboardAdmin } from "@/hooks/queries/admin";
import { mensagemDoErro } from "@/lib/api";
import type { TarefaAdmin } from "@/types/admin";
import EditarTarefaModal from "../EditarTarefaModal";
import { botaoSecundario } from "../estilos";
import ChamadosBloco from "./ChamadosBloco";
import ComparativoConsultores from "./ComparativoConsultores";
import DetalheDoConsultor from "./DetalheDoConsultor";
import ExportarDashboard from "./ExportarDashboard";
import QualidadeBloco from "./QualidadeBloco";
import TarefasBloco from "./TarefasBloco";
import VisaoGeral from "./VisaoGeral";

function Esqueleto() {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2" aria-busy="true" aria-label="Carregando o dashboard">
      {[2, 2, 1, 1, 1, 1].map((span, i) => (
        <div key={i} className={`h-52 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800 ${span === 2 ? "xl:col-span-2" : ""}`} />
      ))}
    </div>
  );
}

type Props = {
  mes: string;
  onMudarMes: (mes: string) => void;
  // consulta do dashboard: vive na página, porque o badge de "atualizado há..." fica no cabeçalho dela
  dashboard: ReturnType<typeof useDashboardAdmin>;
};

// Números de todos os consultores, só para consulta. Tudo é calculado no servidor
// (e guardado por 2 minutos); aqui só se escolhe o mês e se abre o detalhe.
export default function DashboardAba({ mes, onMudarMes, dashboard }: Props) {
  const [consultor, setConsultor] = useState<{ codigo: number; nome: string } | null>(null);
  const [editando, setEditando] = useState<TarefaAdmin | null>(null);
  const { consulta, atualizar } = dashboard;
  const dados = consulta.data;

  if (consultor) {
    return <DetalheDoConsultor key={consultor.codigo} codigo={consultor.codigo} nome={consultor.nome} mesInicial={mes} onVoltar={() => setConsultor(null)} />;
  }

  const abrirConsultor = (codigo: number, nome: string) => setConsultor({ codigo, nome });
  const buscandoAgora = consulta.isFetching || atualizar.isPending;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SeletorMes mes={mes} onChange={onMudarMes} carregando={buscandoAgora && !!dados} />
        {dados && <ExportarDashboard dados={dados} />}
      </div>

      {(consulta.isError || atualizar.isError) && (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/40">
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">
            {mensagemDoErro(atualizar.isError ? atualizar.error : consulta.error, "Não foi possível carregar o dashboard.")}
          </p>
          <button type="button" className={botaoSecundario} onClick={() => void consulta.refetch()}>
            Tentar novamente
          </button>
        </div>
      )}

      {!dados && !consulta.isError && <Esqueleto />}

      {dados && (
        <div className={`grid grid-cols-1 gap-5 transition-opacity xl:grid-cols-2 ${consulta.isPlaceholderData || atualizar.isPending ? "opacity-60" : ""}`}>
          <div className="xl:col-span-2">
            <VisaoGeral visao={dados.visao} nomeMes={dados.nomeMes} ehMesAtual={dados.ehMesAtual} />
          </div>

          <div className="xl:col-span-2">
            <ComparativoConsultores consultores={dados.consultores} ehMesAtual={dados.ehMesAtual} onAbrirConsultor={abrirConsultor} />
          </div>

          <TarefasBloco
            emRisco={dados.tarefas.emRisco}
            comEstouroLiberado={dados.tarefas.comEstouroLiberado}
            totalEmRisco={dados.visao.tarefasEmRisco}
            totalComEstouroLiberado={dados.visao.tarefasComEstouroLiberado}
            nomeMes={dados.nomeMes}
            onEditar={setEditando}
          />

          <ChamadosBloco chamados={dados.chamados} />

          <QualidadeBloco qualidade={dados.qualidade} onAbrirConsultor={abrirConsultor} />
        </div>
      )}

      {editando && <EditarTarefaModal key={editando.codigo} tarefa={editando} onFechar={() => setEditando(null)} />}
    </div>
  );
}
