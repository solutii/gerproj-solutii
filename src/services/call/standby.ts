import { STATUS_CHAMADO, STATUS_CHAMADO_COD } from "@/types/chamados";
import { sendEmail } from "../email/email";
import iconv from "iconv-lite"
import { ErroDeRegra } from "../erro-regra"
import ValidHoursService from "./valid-hours"
import { estourouLimiteHoras } from "@/utils/limite-horas"
import { conferirConflitoNaTransacao, validarApontamento, validarPosseChamado } from "./../os/regras-apontamento"
import { gravarEmSerie, proximoCodigo, proximoNumeroOs } from "../transacao"

// StandBy do chamado: muda o status, registra no histórico e cria a OS com as
// horas -- tudo numa transação só (ver services/transacao.ts). Os números novos
// (histórico e OS) são lidos dentro dela; se dois consultores disputarem o mesmo
// número, a gravação é refeita.
export default async function UpdateCallService(
    chamado: any,
    description: string,
    date: string,
    startTime: string,
    endTime: string,
    state: any,
    task: any,
    recurso: number): Promise<boolean> {

    // O chamado precisa ser do consultor logado e o apontamento passa pelas
    // regras (descrição mínima, intervalo, horário no futuro, período vigente
    // e conflito de horário). `recurso` vem da sessão, não da tela.
    await validarPosseChamado(recurso, chamado.COD_CHAMADO)
    await validarApontamento({ recurso, date, startTime, endTime, description })
    chamado = { ...chamado, COD_RECURSO: recurso }

    // Limite mensal de horas da tarefa: a tela já bloqueia, mas a regra também
    // vale aqui pra não ser contornada chamando a API direto.
    const horasValidas = await ValidHoursService(chamado.COD_CHAMADO, date, startTime, endTime)

    if (estourouLimiteHoras(horasValidas, { ignorarLimiteZero: true })) {
        throw new ErroDeRegra(`Horas para esta tarefa já ultrapassaram o limite do mês, total final após apontamento: ${horasValidas[1] / 60}h. ENTRE EM CONTATO COM A SOLUTII!`)
    }

    // Uma gravação por vez no sistema e confirmação depois do commit (ver o ACHADO
    // sobre o driver no cabeçalho de services/transacao.ts).
    await gravarEmSerie(async (tx) => {

        // Chamado FINALIZADO não pode ser reaberto por aqui (nem receber OS nova):
        // as demais trocas de status já têm essa proteção no UPDATE.
        const [atual] = await tx.consultar(`SELECT STATUS_CHAMADO FROM CHAMADO WHERE COD_CHAMADO = ?`, [chamado.COD_CHAMADO])
        const statusAtual: string | null = atual?.STATUS_CHAMADO ?? null

        if (typeof statusAtual === 'string' && statusAtual.trim().toUpperCase() === 'FINALIZADO') {
            throw new ErroDeRegra('Chamado já finalizado: não é possível alterar o status.')
        }

        // Leituras ANTES de qualquer UPDATE da transação (um SELECT que faz JOIN
        // em CHAMADO depois do UPDATE esperaria a própria linha travada).
        const newID = await proximoCodigo(tx, "HISTCHAMADO", "COD_HISTCHAMADO")

        // A OS herda o NUM_OS das anteriores do mesmo consultor no mesmo
        // chamado/tarefa; se for a primeira, pega o próximo número livre.
        const [NUM_OS_MATER] = await tx.consultar(
            `SELECT Max(OS.num_os) as num_os FROM
                OS
                    INNER JOIN
                CHAMADO on CHAMADO.cod_chamado = CAST(OS.chamado_os as integer )
                    INNER JOIN
                TAREFA  on TAREFA.cod_tarefa = OS.codtrf_os

             WHERE
                CHAMADO.cod_chamado = ?
                and TAREFA.cod_tarefa = ?
                and OS.codrec_os = ?`,
            [chamado.COD_CHAMADO, chamado.CODTRF_CHAMADO ?? task[0].COD_TAREFA, chamado.COD_RECURSO])

        const COD_OS = await proximoCodigo(tx, "OS", "COD_OS")
        const NUM_OS = NUM_OS_MATER?.NUM_OS ? NUM_OS_MATER.NUM_OS : await proximoNumeroOs(tx)

        // Conferência final de conflito de horário, dentro da transação e antes de
        // qualquer escrita: o que outra gravação acabou de confirmar já aparece aqui.
        await conferirConflitoNaTransacao(tx, { recurso, date, startTime, endTime })

        await tx.executar(`
                UPDATE CHAMADO SET STATUS_CHAMADO = ? WHERE COD_CHAMADO = ? AND STATUS_CHAMADO <> 'FINALIZADO'`,
            [state, chamado.COD_CHAMADO])

        await tx.executar(`INSERT INTO HISTCHAMADO (COD_HISTCHAMADO, COD_CHAMADO, DATA_HISTCHAMADO, HORA_HISTCHAMADO, DESC_HISTCHAMADO) VALUES (?, ?, ?, ?, ?)`,
            [
                newID,
                chamado.COD_CHAMADO,
                new Date().toLocaleString('pt-br', { year: 'numeric', month: '2-digit', day: '2-digit'}).replaceAll('/', '.').replaceAll(',', ''),
                new Date().toLocaleString('pt-br', { hour: '2-digit', minute: '2-digit' }).replaceAll(':', ''),
                state
            ])

        await tx.executar(
            `insert into OS (
                COD_OS,
                CODTRF_OS,
                DTINI_OS,
                HRINI_OS,
                HRFIM_OS,
                OBS_OS,
                STATUS_OS,
                PRODUTIVO_OS,
                CODREC_OS,
                PRODUTIVO2_OS,
                RESPCLI_OS,
                OBS,
                REMDES_OS,
                ABONO_OS,
                DTINC_OS,
                FATURADO_OS,
                PERC_OS,
                VALID_OS,
                NUM_OS,
                CHAMADO_OS,
                VRHR_OS,
                COMP_OS
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                COD_OS,
                chamado.CODTRF_CHAMADO ?? task[0].COD_TAREFA,
                new Date(`${date} 00:00`).toLocaleString('pt-br', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replaceAll('/', '.').replaceAll(',', ''),
                startTime.replace(":", ""),
                endTime.replace(":", ""),
                chamado.ASSUNTO_CHAMADO,
                STATUS_CHAMADO_COD['STANDBY'],
                'SIM',  //PRODUTIVO_OS
                chamado.COD_RECURSO,
                'SIM',  //PRODUTIVO2_OS
                task[0].RESPCLI_PROJETO, //RESPCLI_OS
                iconv.encode( description, 'WIN1252'),
                'NAO',
                'NAO',
                new Date().toLocaleString('pt-br', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replaceAll('/', '.').replaceAll(',', ''),
                'SIM',  //FATURADO_OS
                100, //PERC_OS
                'SIM', //VALID_OS
                NUM_OS,
                chamado.COD_CHAMADO,
                0,
                new Date().toLocaleString('pt-br', { year: 'numeric', month: '2-digit'})
            ])

        return { codOs: COD_OS, codHist: newID }
    }, {
        confirmar: async ({ codOs, codHist }, consultar) => {
            const [os] = await consultar(`SELECT COUNT(*) AS N FROM OS WHERE COD_OS = ? AND CODREC_OS = ?`, [codOs, recurso])
            const [hist] = await consultar(`SELECT COUNT(*) AS N FROM HISTCHAMADO WHERE COD_HISTCHAMADO = ? AND COD_CHAMADO = ?`, [codHist, chamado.COD_CHAMADO])

            return Number(os?.N) === 1 && Number(hist?.N) === 1
        },
    })

    // Gravou e confirmou: agora sim avisa o cliente.
    if (state === STATUS_CHAMADO["AGUARDANDO VALIDACAO"]) {
        sendEmail(chamado.EMAIL_CHAMADO, 'Validação de Atendimento | Solutii', {
            numero: chamado.COD_CHAMADO
        } as any).catch((emailErr) => {
            console.error(`[UpdateCallService] Falha ao enviar e-mail de validação (chamado ${chamado.COD_CHAMADO}):`, emailErr)
        })
    }

    return true
}
