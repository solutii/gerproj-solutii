"use client";

import Modal from "@/components/modal";
import { useHomeStore } from "@/stores/home-store";
import { closeAccessModal } from "../homeActions";

type Props = {
    action: () => void;
};

export default function AcessoModal({ action }: Props) {
    const { isOpenModal2, accessText, setAccessText } = useHomeStore();

    if (!isOpenModal2) return null;

    return (
        <Modal
            isOpen={isOpenModal2}
            setOpenModal={closeAccessModal}
            title="Dados de Acesso"
            action={action}
            actionText="Salvar"
        >
            <textarea
                onChange={(event) => setAccessText(event.target.value)}
                style={{
                    width: "100%",
                    resize: "none",
                    minHeight: "300px",
                    padding: "10px",
                }}
                className="border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg outline-none focus:border-[#0f3d63] focus:ring-2 focus:ring-[#0f3d63]/20"
                name="acesso"
                id="acesso"
                value={accessText}
            />
        </Modal>
    );
}
