"use client";

import { useRef, type InputHTMLAttributes } from "react";

// Largura (em px, a partir da borda direita) da área do ícone de calendário.
const AREA_ICONE_PX = 40;

// <input type="date"> que fecha o calendário quando o ícone é clicado de novo.
// No nativo, o clique com o calendário aberto fecha o popup (clique "fora") e
// em seguida o próprio clique no ícone reabre -- parece que o botão não fecha.
// Aqui lembramos se o popup estava aberto no mousedown e, nesse caso,
// cancelamos a ação padrão do click (que reabriria o calendário).
export default function DateInput({
  onMouseDown,
  onClick,
  onChange,
  onBlur,
  onKeyDown,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const pickerAberto = useRef(false);
  const estavaAbertoNoMouseDown = useRef(false);

  function noIcone(el: HTMLInputElement, clientX: number) {
    return clientX > el.getBoundingClientRect().right - AREA_ICONE_PX;
  }

  return (
    <input
      {...props}
      type="date"
      onMouseDown={(event) => {
        estavaAbertoNoMouseDown.current = pickerAberto.current;
        // Clique fora do ícone fecha o popup sem reabrir.
        if (!noIcone(event.currentTarget, event.clientX)) {
          pickerAberto.current = false;
        }
        onMouseDown?.(event);
      }}
      onClick={(event) => {
        if (noIcone(event.currentTarget, event.clientX)) {
          if (estavaAbertoNoMouseDown.current) {
            // preventDefault impede o navegador de reabrir o calendário.
            pickerAberto.current = false;
            event.preventDefault();
            event.currentTarget.blur();
          } else {
            pickerAberto.current = true;
          }
        }
        onClick?.(event);
      }}
      onChange={(event) => {
        pickerAberto.current = false;
        onChange?.(event);
      }}
      onBlur={(event) => {
        pickerAberto.current = false;
        onBlur?.(event);
      }}
      onKeyDown={(event) => {
        pickerAberto.current = false;
        onKeyDown?.(event);
      }}
    />
  );
}
