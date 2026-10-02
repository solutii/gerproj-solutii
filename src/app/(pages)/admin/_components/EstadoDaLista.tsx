import type { ReactNode } from "react";
import Loading from "@/components/loading";
import { mensagemDoErro } from "@/lib/api";
import { botaoSecundario } from "./estilos";

type Props = {
  carregando: boolean;
  erro: unknown;
  vazio: boolean;
  textoVazio: string;
  onTentarDeNovo: () => void;
  children: ReactNode;
};

// Carregando / erro (com "Tentar novamente") / lista vazia / conteúdo.
export default function EstadoDaLista({ carregando, erro, vazio, textoVazio, onTentarDeNovo, children }: Props) {
  if (carregando) return <Loading />;

  if (erro) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 p-5">
        <p className="text-sm font-semibold text-red-700 dark:text-red-300">{mensagemDoErro(erro, "Não foi possível carregar a lista.")}</p>
        <button type="button" className={botaoSecundario} onClick={onTentarDeNovo}>
          Tentar novamente
        </button>
      </div>
    );
  }

  if (vazio) return <p className="p-6 text-center text-sm font-medium text-slate-500 dark:text-slate-400">{textoVazio}</p>;

  return <>{children}</>;
}
