"use client";

import { useState } from "react";
import { TbUserCog } from "react-icons/tb";
import ApontamentoModalLayout from "@/app/(pages)/home/_components/modals/ApontamentoModalLayout";
import DateInput from "@/components/date-input";
import { useAtualizarConsultorAdmin } from "@/hooks/queries/admin";
import { mensagemDoErro } from "@/lib/api";
import { useAlertStore } from "@/stores/alert-store";
import type { ConsultorAdmin } from "@/types/admin";
import { agoraNoFuso } from "@/utils/horario-futuro";
import { alteracaoDoConsultor, descreverAlteracaoConsultor, formDoConsultor, situacaoDoConsultor } from "@/utils/admin-form";
import { ajuda, campo, rotulo } from "./estilos";

type Props = { consultor: ConsultorAdmin; onFechar: () => void };

// Edita as três permissões do consultor que só o administrador muda. Só vai para o
// servidor o que realmente mudou; o servidor valida tudo de novo e registra a
// alteração no histórico.
export default function EditarConsultorModal({ consultor, onFechar }: Props) {
  const showAlert = useAlertStore((s) => s.showAlert);
  const salvar = useAtualizarConsultorAdmin();
  const [form, setForm] = useState(() => formDoConsultor(consultor));
  const hoje = agoraNoFuso().data;

  const alteracao = alteracaoDoConsultor(consultor, form);
  const situacao = situacaoDoConsultor(alteracao, hoje);

  async function confirmar() {
    try {
      const r = await salvar.mutateAsync({ codigo: consultor.codigo, alteracao });

      showAlert(r.alterou ? "Alterações salvas e registradas no histórico." : "Nada mudou: os valores já eram esses.", "success");
      onFechar();
    } catch (erro) {
      showAlert(mensagemDoErro(erro, "Não foi possível salvar as alterações."), "warning");
    }
  }

  return (
    <ApontamentoModalLayout
      title="Editar consultor"
      subtitle={`${consultor.nome} · #${consultor.codigo}`}
      icon={TbUserCog}
      onClose={onFechar}
      action={confirmar}
      isActionDisabled={!situacao.alterou || situacao.erro !== null || salvar.isPending}
      confirmMessage={`Confirmar as alterações em ${consultor.nome}? ${descreverAlteracaoConsultor(consultor, alteracao)}`}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="admin-permapo" className={rotulo}>
            Apontar no passado
          </label>
          <select
            id="admin-permapo"
            className={`${campo} cursor-pointer`}
            value={form.permiteApontarNoPassado ? "SIM" : "NAO"}
            onChange={(e) => setForm({ ...form, permiteApontarNoPassado: e.target.value === "SIM" })}
          >
            <option value="NAO">Não: só de ontem em diante</option>
            <option value="SIM">Sim: a partir da data-limite</option>
          </select>
          <p className={ajuda}>Sem permissão, o consultor só consegue apontar de ontem em diante. Com permissão, pode apontar desde a data-limite abaixo.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="admin-dtlimite" className={rotulo}>
            Data-limite
          </label>
          <DateInput
            id="admin-dtlimite"
            className={`${campo} cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
            value={form.dataLimite}
            max={hoje}
            onChange={(e) => setForm({ ...form, dataLimite: e.target.value })}
          />
          <p className={ajuda}>Primeiro dia em que o consultor pode apontar. Só vale com &quot;Apontar no passado&quot; = Sim.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="admin-jornada" className={rotulo}>
            Jornada diária
          </label>
          <input
            id="admin-jornada"
            type="time"
            className={campo}
            value={form.jornada}
            min="01:00"
            max="12:00"
            onChange={(e) => setForm({ ...form, jornada: e.target.value })}
          />
          <p className={ajuda}>Horas por dia útil (de 01:00 a 12:00). É a base da meta mensal no Meu Painel do consultor.</p>
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
