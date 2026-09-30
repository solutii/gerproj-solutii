"use client";

import { TbPlayerPause } from "react-icons/tb";
import { useHomeStore } from "@/stores/home-store";
import { descricaoInvalida } from "@/utils/descricao-apontamento";
import { mensagemConfirmacaoApontamento } from "@/utils/intervalo-horas";
import ApontamentoModalLayout from "./ApontamentoModalLayout";
import CamposApontamento from "./CamposApontamento";
import { closeStandbyModal } from "../homeActions";

type Props = {
  action: () => void;
};

export default function StandbyModal({ action }: Props) {
  const { modalStandby, description, hours, date, selectedCall } = useHomeStore();

  if (!modalStandby) return null;

  const isFormValid =
    !descricaoInvalida(description) &&
    hours.initial !== "" &&
    hours.final !== "" &&
    date !== "";

  return (
    <ApontamentoModalLayout
      title="StandBy"
      subtitle={
        selectedCall
          ? `Chamado #${Number(selectedCall.COD_CHAMADO).toLocaleString("pt-br")}`
          : undefined
      }
      icon={TbPlayerPause}
      onClose={() => closeStandbyModal(false)}
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
