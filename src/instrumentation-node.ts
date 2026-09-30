// src/instrumentation-node.ts
//
// Separado de instrumentation.ts de propósito: o Next.js compila
// instrumentation.ts também para o runtime Edge, e node-firebird (via
// srp.js) usa `require('crypto')`, indisponível lá — mesmo com o guard
// `NEXT_RUNTIME` dentro de register(), o bundler ainda tentava resolver
// esse import estaticamente e quebrava a build de QUALQUER rota que também
// importasse node-firebird (ex.: /api/auth/[...nextauth], via UserService).
// Isolar em arquivo próprio, importado só dentro do branch 'nodejs', evita
// que esse módulo entre no grafo da compilação Edge.
import { getConnection } from './services/firebird';

export function aquecerPoolFirebird() {
    try {
        getConnection((err: any, db: any) => {
            if (err) {
                console.error('[FIREBIRD] Falha ao aquecer o pool no boot:', err);
                return;
            }
            db.detach();
            console.log('[FIREBIRD] Pool de conexões aquecido no boot.');
        });
    } catch (erro) {
        // Ex.: variável FIREBIRD_* ausente no .env. O servidor sobe mesmo assim e
        // cada acesso ao banco falha com a mesma mensagem, que fica registrada aqui.
        console.error('[FIREBIRD] Não foi possível iniciar o pool:', erro instanceof Error ? erro.message : erro);
    }
}
