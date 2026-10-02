import iconv from "iconv-lite"
import { gravar } from "../transacao"

// Dados de acesso do cliente. Só responde depois do commit terminar (ver
// services/transacao.ts).
export default async function UpdateAcesso(
    descricao: string,
    cliente: any): Promise<boolean> {

    await gravar((tx) => tx.executar(
        `UPDATE CLIENTE
            SET
            ACESSO_CLIENTE=?
            WHERE
            COD_CLIENTE=?
        `,
        [
            iconv.encode( descricao, 'WIN1252'),
            cliente,
        ]))

    return true
}
