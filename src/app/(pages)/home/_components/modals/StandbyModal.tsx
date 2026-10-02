"use client";

import { TbPlayerPause } from "react-icons/tb";
import { useHomeStore } from "@/stores/home-store";
import { useHorariosOcupados } from "@/hooks/queries/leituras";
import { descricaoInvalida } from "@/utils/descricao-apontamento";
import { chaveRascunhoChamado } from "@/utils/rascunho";
import { mensagemConfirmacaoApontamento } from "@/utils/intervalo-horas";
import ApontamentoModalLayout from "./ApontamentoModalLayout";
import CamposApontamento from "./CamposApontamento";
import { closeStandbyModal } from "../homeActions";

type Props = {
  action: () => void;
};

export default function StandbyModal({ action }: Props) {
  const { modalStandby, description, hours, date, selectedCall } = useHomeStore();

  // Conflito com outra OS do dia: trava o botão (o servidor também recusa).
  const { conflito } = useHorariosOcupados(modalStandby);

  if (!modalStandby) return null;

  const isFormValid =
    !descricaoInvalida(description) &&
    hours.initial !== "" &&
    hours.final !== "" &&
    date !== "" &&
    !conflito;

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
      <CamposApontamento
        limitarData
        rascunhoChave={selectedCall ? chaveRascunhoChamado(selectedCall.COD_CHAMADO) : undefined}
      />
    </ApontamentoModalLayout>
  );
}
