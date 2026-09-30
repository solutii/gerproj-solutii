"use client";

import { TbClockPlus } from "react-icons/tb";
import { useHomeStore } from "@/stores/home-store";
import { descricaoInvalida } from "@/utils/descricao-apontamento";
import { mensagemConfirmacaoApontamento } from "@/utils/intervalo-horas";
import ApontamentoModalLayout from "./ApontamentoModalLayout";
import CamposApontamento from "./CamposApontamento";
import { closeApontamentoModal } from "../homeActions";

type Props = {
  action: () => void;
};

export default function ApontamentoModal({ action }: Props) {
  const { modalApontamento, description, hours, date, selectedProj } = useHomeStore();

  if (!modalApontamento) return null;

  const isFormValid =
    !descricaoInvalida(description) &&
    hours.initial !== "" &&
    hours.final !== "" &&
    date !== "";

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
      <CamposApontamento limitarData />
    </ApontamentoModalLayout>
  );
}
