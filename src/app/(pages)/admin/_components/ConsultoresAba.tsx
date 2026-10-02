"use client";

import { useState } from "react";
import { TbEdit } from "react-icons/tb";
import Tooltip from "@/components/tooltip";
import { useConsultoresAdmin } from "@/hooks/queries/admin";
import { useDebounce } from "@/hooks/useDebounce";
import type { ConsultorAdmin } from "@/types/admin";
import EditarConsultorModal from "./EditarConsultorModal";
import EstadoDaLista from "./EstadoDaLista";
import { cabecalhoDaTabela, campoBusca, cartao, celula, selo } from "./estilos";

const dataBR = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");

export default function ConsultoresAba() {
  const [busca, setBusca] = useState("");
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [editando, setEditando] = useState<ConsultorAdmin | null>(null);

  const termo = useDebounce(busca.trim());
  const consulta = useConsultoresAdmin(termo, !mostrarInativos);
  const consultores = consulta.data ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <input
          type="search"
          aria-label="Buscar consultor por nome ou código"
          placeholder="Buscar por nome ou código..."
          className={campoBusca}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          <input type="checkbox" className="h-4 w-4 cursor-pointer" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} />
          Mostrar inativos
        </label>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400" aria-live="polite">
          {consulta.data ? `${consultores.length} consultor(es)` : ""}
        </p>
      </div>

      <section className={cartao}>
        <EstadoDaLista
          carregando={consulta.isPending}
          erro={consulta.isError && !consulta.data ? consulta.error : null}
          vazio={consultores.length === 0}
          textoVazio="Nenhum consultor encontrado."
          onTentarDeNovo={() => void consulta.refetch()}
        >
          <div className="overflow-auto">
            <table className="w-full min-w-[720px] border-collapse text-xs text-slate-800 dark:text-slate-100 sm:text-sm">
              <thead>
                <tr className={cabecalhoDaTabela}>
                  <th className="px-3 text-left">Consultor</th>
                  <th>Código</th>
                  <th>Jornada diária</th>
                  <th>Apontar no passado</th>
                  <th>Data-limite</th>
                  <th>Situação</th>
                  <th className="w-20">Ações</th>
                </tr>
              </thead>
              <tbody>
                {consultores.map((c) => (
                  <tr key={c.codigo} className="border-b border-slate-200 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-700/50">
                    <td className="p-2 px-3 font-semibold">{c.nome}</td>
                    <td className={celula}>{c.codigo}</td>
                    <td className={`${celula} tabular-nums`}>{c.jornada}</td>
                    <td className={celula}>
                      <span className={c.permiteApontarNoPassado ? selo.sim : selo.nao}>{c.permiteApontarNoPassado ? "Sim" : "Não"}</span>
                    </td>
                    <td className={`${celula} tabular-nums ${c.permiteApontarNoPassado ? "" : "text-slate-400 dark:text-slate-500"}`}>
                      {dataBR(c.dataLimite)}
                    </td>
                    <td className={celula}>
                      <span className={c.ativo ? selo.sim : selo.nao}>{c.ativo ? "Ativo" : "Inativo"}</span>
                    </td>
                    <td className={celula}>
                      <Tooltip content={`Editar ${c.nome}`}>
                        <button
                          type="button"
                          aria-label={`Editar ${c.nome}`}
                          onClick={() => setEditando(c)}
                          className="cursor-pointer rounded-full p-1 text-blue-600 transition hover:scale-125 hover:bg-blue-50 hover:text-blue-400 depth-icon focus-visible:ring-2 focus-visible:ring-[#0f3d63]"
                        >
                          <TbEdit size={26} />
                        </button>
                      </Tooltip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </EstadoDaLista>
      </section>

      {editando && <EditarConsultorModal key={editando.codigo} consultor={editando} onFechar={() => setEditando(null)} />}
    </div>
  );
}
