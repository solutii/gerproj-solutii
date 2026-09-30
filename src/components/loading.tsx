// Skeleton animado usado no lugar da tabela enquanto ela carrega (Chamados,
// Projetos e OS's) -- imita linhas da tabela em vez de um spinner genérico,
// pra dar uma ideia melhor do que está prestes a aparecer.
export default function Loading() {
    return (
        <div className="w-full p-3 flex flex-col gap-2" role="status" aria-label="Carregando">
            {Array.from({ length: 6 }).map((_, row) => (
                <div key={row} className="flex items-center gap-3 animate-pulse" style={{ animationDelay: `${row * 75}ms` }}>
                    <div className="h-3.5 rounded bg-slate-200 dark:bg-slate-700 w-[10%]" />
                    <div className="h-3.5 rounded bg-slate-200 dark:bg-slate-700 w-[30%]" />
                    <div className="h-3.5 rounded bg-slate-200 dark:bg-slate-700 w-[20%]" />
                    <div className="h-3.5 rounded bg-slate-200 dark:bg-slate-700 w-[15%]" />
                    <div className="h-3.5 rounded bg-slate-200 dark:bg-slate-700 w-[15%] ml-auto" />
                </div>
            ))}
        </div>
    );
}
