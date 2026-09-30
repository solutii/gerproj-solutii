"use client";

import Modal from "@/components/modal";
import { useHomeStore } from "@/stores/home-store";

type Props = {
    action: () => void;
};

export default function TarefaModal({ action }: Props) {
    const { modalTarefa, setModalTarefa, tasks, setSelectedTask } = useHomeStore();

    if (!modalTarefa) return null;

    return (
        <Modal
            isOpen={modalTarefa}
            setOpenModal={setModalTarefa}
            title="Selecione a Tarefa do chamado!"
            action={action}
        >
            <select
                aria-label="Tarefa"
                name="tarefa"
                id="tarefa"
                onChange={(event) => setSelectedTask(event.target.value)}
                className="w-full p-2.5 border border-slate-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg outline-none focus:border-[#0f3d63] focus:ring-2 focus:ring-[#0f3d63]/20"
            >
                <option value="">Selecione uma Tarefa</option>
                {tasks.map((task: any, index) => (
                    <option key={index} value={task.COD_TAREFA}>
                        {task.NOME_TAREFA}
                    </option>
                ))}
            </select>
        </Modal>
    );
}
