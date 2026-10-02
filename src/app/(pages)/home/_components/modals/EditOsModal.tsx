"use client";

import { TbEdit } from "react-icons/tb";
import { useHomeStore } from "@/stores/home-store";
import { useHorariosOcupados } from "@/hooks/queries/leituras";
import { descricaoInvalida } from "@/utils/descricao-apontamento";
import { mensagemConfirmacaoApontamento } from "@/utils/intervalo-horas";
import ApontamentoModalLayout from "./ApontamentoModalLayout";
import CamposApontamento from "./CamposApontamento";
import { closeEditOsModal } from "../homeActions";

type Props = {
  action: () => void;
};

export default function EditOsModal({ action }: Props) {
  const { modalEditOS, description, hours, date, selectedOs } = useHomeStore();

  // Conflito com outra OS do dia: trava o botão (o servidor também recusa).
  const { conflito } = useHorariosOcupados(modalEditOS);

  if (!modalEditOS) return null;

  const isFormValid =
    !descricaoInvalida(description) &&
    hours.initial !== "" &&
    hours.final !== "" &&
    date !== "" &&
    !conflito;

  return (
    <ApontamentoModalLayout
      title="Editar Apontamento"
      subtitle={`OS #${Number(selectedOs?.COD_OS).toLocaleString("pt-br")}`}
      icon={TbEdit}
      onClose={() => closeEditOsModal(false)}
      action={action}
      isActionDisabled={!isFormValid}
      confirmMessage={mensagemConfirmacaoApontamento(
        "Deseja confirmar a edição desse apontamento de horas?",
        hours.initial,
        hours.final,
      )}
    >
      <CamposApontamento />
    </ApontamentoModalLayout>
  );
}
