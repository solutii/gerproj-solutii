"use client";

import { useState } from "react";
import { TbClipboardList } from "react-icons/tb";
import ApontamentoModalLayout from "@/app/(pages)/home/_components/modals/ApontamentoModalLayout";
import { useAtualizarTarefaAdmin } from "@/hooks/queries/admin";
import { mensagemDoErro } from "@/lib/api";
import { useAlertStore } from "@/stores/alert-store";
import type { TarefaAdmin } from "@/types/admin";
import { alteracaoDaTarefa, descreverAlteracaoTarefa, formDaTarefa, situacaoDaTarefa } from "@/utils/admin-form";
import { formatarNumero } from "@/utils/painel/horas";
import { ajuda, campo, rotulo } from "./estilos";

type Props = { tarefa: TarefaAdmin; onFechar: () => void };

// Edita as três regras de limite de horas da tarefa. Só vai para o servidor o que
// realmente mudou; o servidor valida tudo de novo e registra a alteração.
export default function EditarTarefaModal({ tarefa, onFechar }: Props) {
  const showAlert = useAlertStore((s) => s.showAlert);
  const salvar = useAtualizarTarefaAdmin();
  const [form, setForm] = useState(() => formDaTarefa(tarefa));

  const alteracao = alteracaoDaTarefa(tarefa, form);
  const situacao = situacaoDaTarefa(alteracao);

  async function confirmar() {
    try {
      const r = await salvar.mutateAsync({ codigo: tarefa.codigo, alteracao });

      showAlert(r.alterou ? "Alterações salvas e registradas no histórico." : "Nada mudou: os valores já eram esses.", "success");
      onFechar();
    } catch (erro) {
      showAlert(mensagemDoErro(erro, "Não foi possível salvar as alterações."), "warning");
    }
  }

  return (
    <ApontamentoModalLayout
      title="Editar tarefa"
      subtitle={`${tarefa.nome} · #${formatarNumero(tarefa.codigo)} · ${tarefa.cliente}`}
      icon={TbClipboardList}
      onClose={onFechar}
      action={confirmar}
      isActionDisabled={!situacao.alterou || situacao.erro !== null || salvar.isPending}
      confirmMessage={`Confirmar as alterações na tarefa #${formatarNumero(tarefa.codigo)}? ${descreverAlteracaoTarefa(tarefa, alteracao)}`}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="admin-perimp" className={rotulo}>
            Liberar estouro do limite
          </label>
          <select
            id="admin-perimp"
            className={`${campo} cursor-pointer`}
            value={form.permiteExceder ? "SIM" : "NAO"}
            onChange={(e) => setForm({ ...form, permiteExceder: e.target.value === "SIM" })}
          >
            <option value="NAO">Não: o apontamento é recusado acima do limite</option>
            <option value="SIM">Sim: aceita apontar mesmo acima do limite</option>
          </select>
          <p className={ajuda}>Vale para os dois limites abaixo (StandBy do chamado e apontamento direto na tarefa).</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="admin-limmes" className={rotulo}>
            Limite mensal (horas)
          </label>
          <input
            id="admin-limmes"
            inputMode="numeric"
            className={campo}
            placeholder="Vazio = sem limite"
            value={form.limiteMensal}
            onChange={(e) => setForm({ ...form, limiteMensal: e.target.value })}
          />
          <p className={ajuda}>Horas por mês no StandBy do chamado ligado a esta tarefa. Vazio ou 0 = sem limite.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="admin-hrreal" className={rotulo}>
            Horas contratadas
          </label>
          <input
            id="admin-hrreal"
            inputMode="decimal"
            className={campo}
            placeholder="Ex.: 40 ou 12,5"
            value={form.horasContratadas}
            onChange={(e) => setForm({ ...form, horasContratadas: e.target.value })}
          />
          <p className={ajuda}>É o limite do apontamento direto na tarefa (aba Tarefas). Aceita até 2 casas decimais.</p>
        </div>

        {situacao.erro && (
          <p role="alert" className="text-sm font-medium text-red-500">
            {situacao.erro}
          </p>
        )}
        {!situacao.alterou && <p className={ajuda}>Altere algum campo para poder confirmar.</p>}
      </div>
    </ApontamentoModalLayout>
  );
}
