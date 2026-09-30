import Link from "next/link";
import { TbHome, TbSearch } from "react-icons/tb";

export default function NotFound() {
    return (
        <main className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#0a2540] via-[#0f3d63] to-[#155a8a] p-4">
            {/* blobs decorativos */}
            <div className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-cyan-400/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 -right-16 w-[28rem] h-[28rem] rounded-full bg-blue-500/20 blur-3xl" />
            <div className="pointer-events-none absolute top-1/3 right-1/4 w-40 h-40 rounded-full bg-white/5 blur-2xl" />

            <div className="relative w-full max-w-lg text-center flex flex-col items-center gap-6">
                <div className="relative">
                    <h1 className="text-[9rem] sm:text-[11rem] leading-none font-extrabold tracking-tight bg-gradient-to-b from-white to-cyan-300 bg-clip-text text-transparent select-none">
                        404
                    </h1>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center justify-center w-14 h-14 rounded-full bg-white shadow-lg shadow-black/30">
                        <TbSearch size={26} className="text-[#0f3d63] depth-icon" />
                    </div>
                </div>

                <div className="flex flex-col gap-2 mt-4">
                    <h2 className="text-2xl font-bold text-white tracking-tight">
                        Página não encontrada
                    </h2>
                    <p className="text-sm text-cyan-100/70 max-w-sm mx-auto">
                        O endereço que você tentou acessar não existe, foi movido ou nunca existiu por aqui.
                    </p>
                </div>

                <Link
                    href="/home"
                    className="inline-flex items-center gap-2 bg-white text-[#0f3d63] font-semibold text-sm px-6 py-3 rounded-lg depth-btn-soft transition-all hover:bg-cyan-50 active:scale-95"
                >
                    <TbHome size={18} className="depth-icon" />
                    Voltar para o início
                </Link>

                <p className="text-xs text-cyan-100/40 mt-2">
                    &copy; {new Date().getFullYear()} Solutii Sistemas
                </p>
            </div>
        </main>
    );
}
