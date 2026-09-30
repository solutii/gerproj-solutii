"use client";

import Modal from "@/components/modal";
import { useHomeStore } from "@/stores/home-store";

type Props = {
    action: () => void;
};

export default function ClassificacaoModal({ action }: Props) {
    const { modalClassificacao, setModalClassificacao, classificacao, setSelectedClassificacao } =
        useHomeStore();

    if (!modalClassificacao) return null;

    return (
        <Modal
            isOpen={modalClassificacao}
            setOpenModal={setModalClassificacao}
            title="Selecione a Classificação do chamado!"
            action={action}
        >
            <select
                aria-label="Classificação"
                name="classificacao"
                id="classificacao"
                onChange={(event) => setSelectedClassificacao(event.target.value)}
                className="w-full p-2.5 border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg outline-none focus:border-[#0f3d63] focus:ring-2 focus:ring-[#0f3d63]/20"
            >
                <option value="">Selecione uma Classificação</option>
                {classificacao.map((cls: any, index) => (
                    <option key={index} value={cls.COD_CLASSIFICACAO}>
                        {cls.NOME_CLASSIFICACAO}
                    </option>
                ))}
            </select>
        </Modal>
    );
}
