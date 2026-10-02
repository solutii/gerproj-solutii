"use client";

import { TbClockPlus } from "react-icons/tb";
import { useHomeStore } from "@/stores/home-store";
import { useHorariosOcupados } from "@/hooks/queries/leituras";
import { descricaoInvalida } from "@/utils/descricao-apontamento";
import { chaveRascunhoTarefa } from "@/utils/rascunho";
import { mensagemConfirmacaoApontamento } from "@/utils/intervalo-horas";
import ApontamentoModalLayout from "./ApontamentoModalLayout";
import CamposApontamento from "./CamposApontamento";
import { closeApontamentoModal } from "../homeActions";

type Props = {
  action: () => void;
};

export default function ApontamentoModal({ action }: Props) {
  const { modalApontamento, description, hours, date, selectedProj } = useHomeStore();

  // Conflito com outra OS do dia: trava o botão (o servidor também recusa).
  const { conflito } = useHorariosOcupados(modalApontamento);

  if (!modalApontamento) return null;

  const isFormValid =
    !descricaoInvalida(description) &&
    hours.initial !== "" &&
    hours.final !== "" &&
    date !== "" &&
    !conflito;

  return (
    <ApontamentoModalLayout
      title="Apontamento"
      subtitle={`Tarefa #${selectedProj ? Number(selectedProj.COD_TAREFA).toLocaleString("pt-br") : ""}`}
      icon={TbClockPlus}
      onClose={() => closeApontamentoModal(false)}
      action={action}
      isActionDisabled={!isFormValid}
      confirmMessage={mensagemConfirmacaoApontamento(
        "Deseja confirmar o apontamento das horas?",
        hours.initial,
        hours.final,
      )}
    >
      <CamposApontamento
        limitarData
        rascunhoChave={selectedProj ? chaveRascunhoTarefa(selectedProj.COD_TAREFA) : undefined}
      />
    </ApontamentoModalLayout>
  );
}
