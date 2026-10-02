import { STATUS_CHAMADO_COD } from "@/types/chamados";
import iconv from "iconv-lite"
import { ErroDeRegra } from "../erro-regra"
import ValidHoursService from "../tarefa/valid-hours"
import { estourouLimiteHoras } from "@/utils/limite-horas"
import { conferirConflitoNaTransacao, validarApontamento } from "./regras-apontamento"
import { gravarEmSerie, proximoCodigo, proximoNumeroOs } from "../transacao"

// Apontamento de horas numa TAREFA (cria uma OS). Toda a gravação roda numa
// única transação (ver services/transacao.ts): o número da OS é lido dentro
// dela e, se dois consultores disputarem o mesmo número, a gravação é refeita.
export default async function ApointService(
    os: any,
    description: string,
    date: string,
    startTime: string,
    endTime: string,
    recurso: string,
    task: any): Promise<boolean> {

    // Regras do apontamento (descrição mínima, intervalo, horário no futuro,
    // período vigente e conflito de horário). `recurso` vem da sessão.
    await validarApontamento({ recurso: Number(recurso), date, startTime, endTime, description })

    // Limite mensal de horas da tarefa: a tela já bloqueia, mas a regra também
    // vale aqui pra não ser contornada chamando a API direto.
    const horasValidas = await ValidHoursService(os.COD_TAREFA, date, startTime, endTime)

    if (estourouLimiteHoras(horasValidas)) {
        throw new ErroDeRegra(`Horas para esta tarefa já ultrapassaram o limite mensal (${horasValidas[0] / 60}h), impossível realizar o apontamento.`)
    }

    // Uma gravação por vez no sistema (clique duplo, dois consultores no mesmo instante)
    // e, depois do commit, confere que a OS realmente está no banco -- ver o ACHADO
    // sobre o driver no cabeçalho de services/transacao.ts.
    await gravarEmSerie(async (tx) => {

        // A OS herda o NUM_OS das anteriores do mesmo consultor na mesma tarefa;
        // se for a primeira, pega o próximo número livre.
        const [NUM_OS_MATER] = await tx.consultar(
            `SELECT Max(OS.num_os) as num_os FROM
                OS
                    INNER JOIN
                TAREFA  on TAREFA.cod_tarefa = OS.codtrf_os
             WHERE
                TAREFA.cod_tarefa = ?
                and OS.codrec_os = ?`,
            [os.COD_TAREFA, recurso])

        const COD_OS = await proximoCodigo(tx, "OS", "COD_OS")
        const NUM_OS = NUM_OS_MATER?.NUM_OS ? NUM_OS_MATER.NUM_OS : await proximoNumeroOs(tx)

        // Conferência final, dentro da transação e colada ao INSERT: o que outra
        // gravação acabou de confirmar já aparece aqui.
        await conferirConflitoNaTransacao(tx, { recurso: Number(recurso), date, startTime, endTime })

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
                VRHR_OS,
                COMP_OS
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                COD_OS,
                os.COD_TAREFA,
                new Date(`${date} 00:00`).toLocaleString('pt-br', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replaceAll('/', '.').replaceAll(',', ''),
                startTime.replace(":", ""),
                endTime.replace(":", ""),
                os.NOME_TAREFA,
                STATUS_CHAMADO_COD['STANDBY'],
                'SIM',  //PRODUTIVO_OS
                recurso,
                'SIM',  //PRODUTIVO2_OS
                os.RESPCLI_PROJETO, //RESPCLI_OS
                iconv.encode( description, 'WIN1252'),
                'NAO',
                'NAO',
                new Date().toLocaleString('pt-br', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replaceAll('/', '.').replaceAll(',', ''),
                os.FATURA_TAREFA,  //FATURADO_OS
                100, //PERC_OS
                'SIM', //VALID_OS
                NUM_OS,
                0,
                new Date().toLocaleString('pt-br', { year: 'numeric', month: '2-digit'})
            ])
        /**
         * COD_OS, CODTRF_OS, DTINI_OS, HRINI_OS, HRFIM_OS, STATUS (1 - LEVANTAMENTO, 2 - DESENVOLVIMENTO, 3 - TESTE, 4 - CONCLUIDO), ?, PRODUTIVO_OS ('SIM'), CODREC_OS, PRODUTIVO2_OS ('SIM'), RESPCLI_OS, REMDES_OS ('NAO'), ABONO_OS ('NAO'), DESLOC_OS (0000), OBS (BLOB), DTINC_OS (DATA DE INCLUSAO), FATURADO_OS, PERC_OS (100), COMP_OS (MES VIGENTE), VALID_OS, VRHR_OS, NUM_OS, CHAMADO_OS
         */

        return COD_OS
    }, {
        confirmar: async (codOs, consultar) => {
            const [r] = await consultar(`SELECT COUNT(*) AS N FROM OS WHERE COD_OS = ? AND CODREC_OS = ?`, [codOs, recurso])

            return Number(r?.N) === 1
        },
    })

    return true
}
