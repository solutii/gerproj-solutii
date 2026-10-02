import { num } from "./comuns";

// Aparência do badge de situação do card "Chamados abertos". É a MESMA na fileira de badges
// (onde ele é um botão) e no cabeçalho da tabela (onde ele só mostra qual situação está aberta),
// porque o badge "viaja" da fileira para o cabeçalho quando se clica nele.

// Formato, relevo e espaçamento do badge (sem a cor da situação e sem o que é só de botão).
export const CLASSES_DO_BADGE = "flex items-center gap-2.5 depth-badge select-none rounded-full border py-1 pl-1.5 pr-4";

// Número num recorte afundado (relevo para dentro, o inverso do relevo saliente do badge) e o nome.
export function ConteudoDoBadge({ quantidade, rotulo }: { quantidade: number; rotulo: string }) {
  return (
    <>
      <span data-contador className="depth-contador min-w-[2rem] rounded-full px-2.5 py-0.5 text-center text-base font-extrabold tabular-nums">
        {num(quantidade)}
      </span>
      <span className="text-xs font-semibold">{rotulo}</span>
    </>
  );
}
