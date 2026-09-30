import { StatusChamadoType } from "@/types/chamados";

const STYLES: Record<StatusChamadoType, string> = {
    "EM ATENDIMENTO": "bg-blue-500 text-white border-blue-600",
    "ATRIBUIDO": "bg-slate-500 text-white border-slate-600",
    "STANDBY": "bg-yellow-500 text-white border-yellow-600",
    "AGUARDANDO VALIDACAO": "bg-orange-500 text-white border-orange-600",
    "FINALIZADO": "bg-green-600 text-white border-green-700",
};

type Props = {
    status: StatusChamadoType;
};

export default function StatusBadge({ status }: Props) {
    const style = STYLES[status] ?? "bg-slate-100 text-slate-700 border-slate-200";

    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold whitespace-nowrap ${style}`}>
            {status}
        </span>
    );
}
