"use client";

import Modal from "@/components/modal";
import { useHomeStore } from "@/stores/home-store";

export default function DescricaoModal() {
    const { isOpenModal, setOpenModal, descriptionText } = useHomeStore();

    if (!isOpenModal) return null;

    return (
        <Modal isOpen={isOpenModal} setOpenModal={setOpenModal} title="Descrição">
            <p className="my-4 text-blueGray-500 text-lg leading-relaxed">{descriptionText}</p>
        </Modal>
    );
}
