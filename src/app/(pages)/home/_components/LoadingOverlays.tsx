"use client";

import { useHomeStore } from "@/stores/home-store";

type OverlayCardProps = {
  message: string;
};

// Card compartilhado pelos 3 overlays de carregamento de tela cheia -- só a
// mensagem muda entre eles (upload, acesso, processamento genérico).
function OverlayCard({ message }: OverlayCardProps) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200/60 dark:border-slate-700 px-10 py-8 flex flex-col items-center gap-5 min-w-[240px]">
        <div className="relative flex items-center justify-center w-14 h-14">
          <span className="absolute inset-0 rounded-full bg-[#0f3d63]/10 dark:bg-cyan-400/10 animate-ping" />
          <span className="relative w-12 h-12 rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-[#0f3d63] dark:border-t-cyan-400 animate-spin" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-slate-700 dark:text-slate-200 font-semibold text-sm">
            {message}
          </p>
          <p className="text-slate-400 dark:text-slate-500 text-xs">
            Aguarde um momento...
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoadingOverlays() {
  const { isUploading, isChangeAccess, isProcessing } = useHomeStore();

  return (
    <>
      {isUploading && <OverlayCard message="Enviando arquivo..." />}
      {isChangeAccess && <OverlayCard message="Atualizando acesso..." />}
      {isProcessing && <OverlayCard message="Processando..." />}
    </>
  );
}
