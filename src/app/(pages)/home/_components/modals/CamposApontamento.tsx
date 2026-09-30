"use client";

import DateInput from "@/components/date-input";
import { useHomeStore } from "@/stores/home-store";
import { formatSentenceCase } from "@/utils/formatters";
import { agoraNoFuso } from "@/utils/horario-futuro";
import { DESCRICAO_MINIMA } from "@/utils/descricao-apontamento";

// Horários disponíveis nos selects -- de meia em meia hora (00:00 a 23:30).
const HORARIOS = Array.from({ length: 48 }, (_, i) => {
  const hours = `${Math.floor(i / 2)}`.padStart(2, "0");
  return `${hours}:${i % 2 === 0 ? "00" : "30"}`;
});

// Se o valor atual não está na lista (ex: OS antiga gravada fora da meia hora),
// ele entra como opção extra pra não aparecer em branco no Editar OS.
function opcoesHorario(
  atual: string,
  { max, depoisDe }: { max?: string; depoisDe?: string } = {},
) {
  // `max`: hoje só dá pra apontar até o horário atual.
  // `depoisDe`: a hora final precisa ser maior que a inicial.
  const base = HORARIOS.filter(
    (hr) => (!max || hr <= max) && (!depoisDe || hr > depoisDe),
  );

  return atual && !base.includes(atual) ? [...base, atual].sort() : base;
}

type Props = {
  // Editar OS não trava a data por período vigente (comportamento original);
  // Standby e Apontamento sim.
  limitarData?: boolean;
};

// Campos compartilhados pelos modais de Standby, Editar apontamento e
// Apontamento: descrição, horas (início/fim) e data. Lê e escreve direto na
// store -- os 3 modais reaproveitam os mesmos campos (description/hours/date)
// no componente original, então mantemos esse mesmo compartilhamento aqui.
export default function CamposApontamento({ limitarData }: Props) {
  const {
    description,
    setDescription,
    hours,
    setHours,
    date,
    setDate,
    limitDate,
  } = useHomeStore();

  // Hoje só dá pra apontar até o horário atual (Brasília); outros dias, livre.
  const agora = agoraNoFuso();
  const limiteHora = date === agora.data ? agora.hora : undefined;

  function changeDate(novaData: string) {
    setDate(novaData);

    // Ao escolher hoje, limpa horários que ainda não aconteceram.
    const { data, hora } = agoraNoFuso();
    if (novaData === data) {
      setHours((h) => ({
        initial: h.initial > hora ? "" : h.initial,
        final: h.final > hora ? "" : h.final,
      }));
    }
  }

  const labelClass =
    "text-sm font-medium tracking-wider text-slate-800 dark:text-white select-none";
  const inputClass =
    "text-sm border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 font-medium text-slate-900 dark:text-white dark:[color-scheme:dark] placeholder:text-slate-500 placeholder:font-medium outline-none rounded-lg p-2.5 w-full shadow-[inset_0_1.5px_0_rgba(255,255,255,0.9),inset_0_-2px_3px_rgba(0,0,0,0.06),0_1px_1px_rgba(0,0,0,0.08),0_10px_24px_-8px_rgba(0,0,0,0.35)] dark:shadow-[0_8px_18px_-8px_rgba(0,0,0,0.8)] transition focus:border-[#0f3d63] focus:ring-2 focus:ring-[#0f3d63]/30";

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[10px] font-medium text-slate-400 dark:text-white text-right">
        <span className="text-red-500">*</span> Campo obrigatório
      </p>

      <div className="flex flex-col gap-1.5">
        <label className={labelClass}>
          Descrição <span className="text-red-500">*</span>
        </label>
        <textarea
          aria-label="Descrição"
          rows={5}
          placeholder="Descreva o que foi realizado..."
          autoFocus
          className={`${inputClass} resize-none`}
          value={description}
          onChange={(event) =>
            setDescription(formatSentenceCase(event.target.value))
          }
        />
        <p
          className={`text-sm font-medium text-right ${
            description.trim().length >= DESCRICAO_MINIMA
              ? "text-green-600 dark:text-green-400"
              : "text-red-500"
          }`}
        >
          {description.trim().length}/{DESCRICAO_MINIMA} caracteres (mínimo)
        </p>
      </div>

      <div className="flex flex-row gap-4 flex-wrap">
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <label htmlFor="hora-inicial" className={labelClass}>
            Hora Inicial <span className="text-red-500">*</span>
          </label>
          <select
            id="hora-inicial"
            className={`${inputClass} cursor-pointer`}
            value={hours.initial}
            onChange={(event) =>
              setHours((hours) => ({
                initial: event.target.value,
                // Hora final precisa ser maior que a inicial: limpa se ficou inválida.
                final:
                  hours.final && hours.final <= event.target.value
                    ? ""
                    : hours.final,
              }))
            }
          >
            <option value="">Selecione</option>
            {opcoesHorario(hours.initial, { max: limiteHora }).map((hr) => (
              <option key={hr} value={hr}>
                {hr}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <label htmlFor="hora-final" className={labelClass}>
            Hora Final <span className="text-red-500">*</span>
          </label>
          <select
            id="hora-final"
            className={`${inputClass} cursor-pointer`}
            value={hours.final}
            onChange={(event) =>
              setHours((hours) => ({ ...hours, final: event.target.value }))
            }
          >
            <option value="">Selecione</option>
            {opcoesHorario(hours.final, {
              max: limiteHora,
              depoisDe: hours.initial,
            }).map((hr) => (
              <option key={hr} value={hr}>
                {hr}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <label htmlFor="data-apontamento" className={labelClass}>
            Data <span className="text-red-500">*</span>
          </label>
          <DateInput
            id="data-apontamento"
            className={`${inputClass} cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
            onChange={(event) => changeDate(event.target.value)}
            value={date}
            min={
              limitarData ? limitDate?.toISOString()?.split("T")[0] : undefined
            }
            max={
              limitarData ? agora.data : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}
