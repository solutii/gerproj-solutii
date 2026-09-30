// Decodifica texto de BLOB do Firebird detectando o encoding automaticamente.
//
// Diferente das colunas VARCHAR/CHAR (corrigidas na raiz via patch no driver,
// ver patches/node-firebird.patch), BLOBs SUB_TYPE TEXT não têm um encoding
// único e confiável neste banco: descrições criadas pelo sistema legado
// Delphi ficam em WIN1252 (1 byte por caractere acentuado), mas descrições
// criadas por apps modernos (ex: gerproj-dashboard-cliente-local) ficam em
// UTF-8 (2 bytes por caractere acentuado) -- não dá pra assumir um só pros
// dois casos sem quebrar o outro.
//
// Estratégia: tenta decodificar como UTF-8 primeiro; se dessa decodificação
// sobrar o caractere de substituição (significa que os bytes não formam uma
// sequência UTF-8 válida -- ou seja, são WIN1252/latin1 de fato), cai para
// latin1. WIN1252 e latin1 são idênticos na faixa 0xA0-0xFF onde ficam os
// acentos, então essa segunda tentativa decodifica certo o caso legado.
export function decodeBlobText(buffer: Buffer): string {
    if (buffer.length === 0) return '';

    const utf8Text = buffer.toString('utf8');
    if (!utf8Text.includes('�')) {
        return utf8Text;
    }

    return buffer.toString('latin1');
}
