import { STATUS_CHAMADO } from "@/types/chamados";
import { ErroDeRegra } from "../erro-regra";
import { sendEmail } from "../email/email";
import { gravarEmSerie, proximoCodigo } from "../transacao";

// Troca de status do chamado + histórico, numa transação só (ver
// services/transacao.ts). O e-mail de validação sai DEPOIS do commit.
export default async function ChangeStatusService(codChamado: string, status: string, email = ""): Promise<boolean> {

    await gravarEmSerie(async (tx) => {

        // Regras de negócio de transição de status -- validadas aqui
        // também (não só no front-end) pra não depender só da UI pra
        // manter a integridade do fluxo:
        //   - só vai pra "Aguardando Validação" a partir de "Standby";
        //   - só vai pra "Finalizado" a partir de "Aguardando Validação".
        if (
            status === STATUS_CHAMADO["AGUARDANDO VALIDACAO"] ||
            status === STATUS_CHAMADO.FINALIZADO
        ) {
            const [chamadoAtual] = await tx.consultar(`SELECT STATUS_CHAMADO FROM CHAMADO WHERE COD_CHAMADO = ?`, [codChamado])

            const statusExigido =
                status === STATUS_CHAMADO["AGUARDANDO VALIDACAO"]
                    ? STATUS_CHAMADO.STANDBY
                    : STATUS_CHAMADO["AGUARDANDO VALIDACAO"]

            if (chamadoAtual?.STATUS_CHAMADO !== statusExigido) {
                throw new ErroDeRegra(`Chamado #${codChamado} precisa estar com o status "${statusExigido}" para ser alterado para "${status}".`)
            }
        }

        const newID = await proximoCodigo(tx, "HISTCHAMADO", "COD_HISTCHAMADO")

        const [ultimaOs] = await tx.consultar(`SELECT MAX(DTINI_OS) AS DATA, MAX(HRFIM_OS) AS HORA FROM OS WHERE CHAMADO_OS = ?`, [codChamado])
        let { DATA, HORA }: any = ultimaOs ?? {}

        if (DATA && HORA) {
            DATA = new Date(DATA).toLocaleString('pt-br', { year: 'numeric', month: '2-digit', day: '2-digit' }).replaceAll('/', '-').replaceAll(',', '')
            HORA = HORA.substring(0, 2) + ':' + HORA.substring(2, 4)
        } else {
            DATA = new Date().toLocaleString('pt-br', { year: 'numeric', month: '2-digit', day: '2-digit' }).replaceAll('/', '-').replaceAll(',', '')
            HORA = new Date().toLocaleString('pt-br', { hour: '2-digit', minute: '2-digit' })
        }

        let conclusaoChamado = new Date(DATA + ' ' + HORA).toLocaleString('pt-br', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replaceAll('/', '.').replace('T', '')

        await tx.executar(`
                UPDATE CHAMADO SET STATUS_CHAMADO = ?, CONCLUSAO_CHAMADO = ? WHERE COD_CHAMADO = ? AND STATUS_CHAMADO <> ?`,
            [status, conclusaoChamado, codChamado, STATUS_CHAMADO.FINALIZADO])

        await tx.executar(`INSERT INTO HISTCHAMADO (COD_HISTCHAMADO, COD_CHAMADO, DATA_HISTCHAMADO, HORA_HISTCHAMADO, DESC_HISTCHAMADO) VALUES (?, ?, ?, ?, ?)`,
            [
                newID,
                codChamado,
                new Date().toLocaleString('pt-br', { year: 'numeric', month: '2-digit', day: '2-digit' }).replaceAll('/', '.').replaceAll(',', ''),
                new Date().toLocaleString('pt-br', { hour: '2-digit', minute: '2-digit' }).replaceAll(':', ''),
                status
            ])

        return newID
    }, {
        confirmar: async (codHist, consultar) => {
            const [r] = await consultar(`SELECT COUNT(*) AS N FROM HISTCHAMADO WHERE COD_HISTCHAMADO = ? AND COD_CHAMADO = ?`, [codHist, codChamado])

            return Number(r?.N) === 1
        },
    })

    // Gravou e confirmou: agora sim avisa o cliente (não atrasa nem derruba a resposta).
    if (status === STATUS_CHAMADO["AGUARDANDO VALIDACAO"]) {
        sendEmail(email, 'Validação de Atendimento | Solutii', {
            numero: codChamado
        } as any).catch((emailErr) => {
            console.error(`[ChangeStatusService] Falha ao enviar e-mail de validação (chamado ${codChamado}):`, emailErr)
        })
    }

    return true
}
