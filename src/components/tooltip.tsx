"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
    content: string;
    children: React.ReactNode;
    // Classes do gatilho (padrão: inline-flex). Útil pra texto truncado em célula.
    className?: string;
};

type Position = {
    top: number;
    left: number;
    placement: "top" | "bottom";
};

// Tooltip customizado -- usado no lugar do `title` nativo do navegador (que
// não permite estilização e demora pra aparecer) nos ícones de ação da
// tabela de chamados, explicando o significado de cada status.
//
// Renderizado via portal em document.body, com posição calculada a partir do
// gatilho (getBoundingClientRect) -- assim ele nunca fica cortado pelo
// overflow-auto/altura da tabela, nem escondido atrás do cabeçalho, não
// importa se a linha está perto do topo ou se a tabela tem poucas linhas.
export default function Tooltip({ content, children, className }: Props) {
    const triggerRef = useRef<HTMLSpanElement>(null);
    const [position, setPosition] = useState<Position | null>(null);

    function show() {
        const rect = triggerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const spaceBelow = window.innerHeight - rect.bottom;
        const placement: Position["placement"] = spaceBelow < 70 ? "top" : "bottom";

        setPosition({
            top: placement === "bottom" ? rect.bottom + 8 : rect.top - 8,
            left: rect.left + rect.width / 2,
            placement,
        });
    }

    function hide() {
        setPosition(null);
    }

    return (
        <span
            ref={triggerRef}
            className={className ?? "relative inline-flex"}
            onMouseEnter={show}
            onMouseLeave={hide}
        >
            {children}
            {position &&
                createPortal(
                    <span
                        role="tooltip"
                        style={{
                            top: position.top,
                            left: position.left,
                            transform:
                                position.placement === "bottom"
                                    ? "translate(-50%, 0)"
                                    : "translate(-50%, -100%)",
                        }}
                        className="fixed w-52 rounded-lg bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-800 text-xs font-normal normal-case px-3 py-2 shadow-lg z-[9999] pointer-events-none text-center leading-snug break-words"
                    >
                        <span
                            className={
                                "absolute left-1/2 -translate-x-1/2 border-4 border-transparent " +
                                (position.placement === "bottom"
                                    ? "bottom-full border-b-slate-800 dark:border-b-slate-100"
                                    : "top-full border-t-slate-800 dark:border-t-slate-100")
                            }
                        />
                        {content}
                    </span>,
                    document.body,
                )}
        </span>
    );
}
