"use client";

import { useEffect, useState } from "react";

// Valor que só "assenta" depois de `ms` sem mudar (campo de busca: não consulta o
// servidor a cada tecla digitada).
export function useDebounce<T>(valor: T, ms = 350): T {
  const [assentado, setAssentado] = useState(valor);

  useEffect(() => {
    const espera = setTimeout(() => setAssentado(valor), ms);

    return () => clearTimeout(espera);
  }, [valor, ms]);

  return assentado;
}
