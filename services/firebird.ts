var Firebird = require('node-firebird');

// ─── Conexão ────────────────────────────────────────────────────────────────
//
// Configurada via .env (FIREBIRD_HOST/PORT/DATABASE/USER/PASSWORD). O .env do
// projeto traz um bloco "SERVIDOR" (produção) e um bloco "LOCAL" comentado --
// para trocar de ambiente, comente o bloco ativo e descomente o outro (mesma
// convenção usada no gerproj-dashboard-cliente-local). Os defaults abaixo
// replicam os valores de produção que estavam hardcoded aqui antes, então a
// aplicação continua funcionando mesmo se o .env não definir essas variáveis.
//
// Encoding: node-firebird decodifica/codifica colunas VARCHAR/CHAR sempre
// como UTF8 (ignorando o encoding real do banco, que é WIN1252 -- legado
// Delphi/Windows), corrompendo acentos na leitura e na escrita. A correção
// está em patches/node-firebird.patch (aplicado via pnpm em todo `pnpm
// install`, ver patchedDependencies em pnpm-workspace.yaml) -- um monkeypatch
// em runtime aqui não resolve, porque o Next.js empacota (bundla) o código
// do driver dentro de cada rota compilada; a cópia usada em runtime pelas
// rotas fica isolada de qualquer patch aplicado depois que o processo sobe.
var options = {
    host: process.env.FIREBIRD_HOST || 'solutii.ddns.net',
    port: Number(process.env.FIREBIRD_PORT) || 3050,
    database: process.env.FIREBIRD_DATABASE || 'C:\\GERPROJ\\Dropbox\\GERPROJ_SOLUTII.GDB',
    user: process.env.FIREBIRD_USER || 'SYSDBA',
    password: process.env.FIREBIRD_PASSWORD || 'masterkey',
    pageSize: 4096,
/*     charset: 'WIN1252' */
};

// ─── Pool de conexões ───────────────────────────────────────────────────────
//
// Antes, todo service abria sua própria conexão via Firebird.attach() e
// fechava com db.detach() -- funciona, mas cada chamada paga o custo de abrir
// uma conexão TCP + handshake do zero, e sob uso simultâneo de vários
// técnicos a aplicação podia abrir dezenas de conexões físicas ao mesmo
// tempo sem necessidade. Um pool compartilhado (Firebird.pool) reaproveita um
// número fixo de conexões já abertas.
//
// Guardado em globalThis para sobreviver ao hot-reload do Next.js em dev
// (senão cada reload criaria um pool novo, vazando o antigo).
const globalForFbPool = globalThis as unknown as { fbPool?: any };

function getPool() {
    if (!globalForFbPool.fbPool) {
        const size = Number(process.env.FIREBIRD_POOL_SIZE) || 10;
        globalForFbPool.fbPool = Firebird.pool(size, options);
    }
    return globalForFbPool.fbPool;
}

// Risco real de um pool compartilhado: se ALGUM código pegar uma conexão
// emprestada (pool.get) e nunca chamar db.detach() -- por um bug, uma
// exceção não tratada, ou uma query que trava e nunca chama seu callback --
// essa conexão fica presa "emprestada" pra sempre. Com um pool de tamanho
// fixo, algumas travas ao longo do tempo esgotam todas as conexões e TODA
// query nova (de qualquer usuário) passa a ficar pendurada esperando uma
// conexão que nunca sobra -- ou seja, a aplicação inteira trava, não só
// quem causou o problema. (O gerproj-dashboard-cliente-local já passou por
// isso em produção -- ver o comentário no firebird.ts de lá.)
//
// getConnection() é um substituto direto de Firebird.attach(options, cb):
// mesma assinatura de callback (err, db), mesmos métodos em db (.query,
// .transaction, .detach) -- só que por baixo pega emprestado do pool, e
// garante que a conexão SEMPRE volta (mesmo que o código chamador trave e
// nunca chame db.detach() por conta própria), forçando a devolução depois de
// QUERY_TIMEOUT_MS.
const QUERY_TIMEOUT_MS = 30_000;

function getConnection(callback: (err: any, db: any) => void) {
    getPool().get((err: any, db: any) => {
        if (err || !db) {
            callback(err, db);
            return;
        }

        let settled = false;
        const originalDetach = db.detach.bind(db);

        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            console.error(
                `[FIREBIRD] Conexão presa por mais de ${QUERY_TIMEOUT_MS}ms -- devolvendo ao pool à força.`
            );
            try {
                originalDetach();
            } catch {
                // conexão pode já estar inválida -- ignora
            }
        }, QUERY_TIMEOUT_MS);

        // Intercepta detach() só nesta conexão (não no protótipo -- não tem
        // o problema de duplicação por bundling que tivemos com o encoding,
        // já que aqui é uma instância que a gente mesmo acabou de receber,
        // no mesmo contexto de execução de quem vai usá-la).
        db.detach = (...args: any[]) => {
            if (!settled) {
                settled = true;
                clearTimeout(timer);
            }
            return originalDetach(...args);
        };

        callback(err, db);
    });
}

export { Firebird, options, getConnection }
