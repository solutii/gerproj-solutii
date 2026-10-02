import { STATUS_CHAMADO } from "@/types/chamados";
import { ErroDeRegra } from "../erro-regra";
import { gravarEmSerie, proximoCodigo } from "../transacao";

// Iniciar o chamado: status "Em atendimento" + registro no histórico. Tudo numa
// transação só; o número do histórico é lido dentro dela (ver services/transacao.ts).
export default async function StartCallService(codChamado: string): Promise<boolean> {

    await gravarEmSerie(async (tx) => {

        const newID = await proximoCodigo(tx, "HISTCHAMADO", "COD_HISTCHAMADO")

        const [chamado] = await tx.consultar(`SELECT DTINI_CHAMADO FROM CHAMADO WHERE COD_CHAMADO = ?`, [codChamado])

        if (!chamado) throw new ErroDeRegra("Chamado não encontrado.")

        let dataIniChamado = chamado['DTINI_CHAMADO'] ?? '';
        if (dataIniChamado == '' || dataIniChamado == null) {
            dataIniChamado = new Date().toLocaleString('pt-br', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replaceAll('/', '.').replaceAll(',', '');
        }

        await tx.executar(`
                UPDATE CHAMADO SET STATUS_CHAMADO = ? , DTINI_CHAMADO = ? WHERE COD_CHAMADO = ? AND STATUS_CHAMADO <> ?`,
            [STATUS_CHAMADO["EM ATENDIMENTO"], dataIniChamado, codChamado, STATUS_CHAMADO.FINALIZADO])

        await tx.executar(`INSERT INTO HISTCHAMADO (COD_HISTCHAMADO, COD_CHAMADO, DATA_HISTCHAMADO, HORA_HISTCHAMADO, DESC_HISTCHAMADO) VALUES (?, ?, ?, ?, ?)`,
            [
                newID,
                codChamado,
                new Date().toLocaleString('pt-br', { year: 'numeric', month: '2-digit', day: '2-digit' }).replaceAll('/', '.').replaceAll(',', ''),
                new Date().toLocaleString('pt-br', { hour: '2-digit', minute: '2-digit' }).replaceAll(':', ''),
                STATUS_CHAMADO["EM ATENDIMENTO"]
            ])

        return newID
    }, {
        confirmar: async (codHist, consultar) => {
            const [r] = await consultar(`SELECT COUNT(*) AS N FROM HISTCHAMADO WHERE COD_HISTCHAMADO = ? AND COD_CHAMADO = ?`, [codHist, codChamado])

            return Number(r?.N) === 1
        },
    })

    return true
}
