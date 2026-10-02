import { gravarEmSerie } from "../transacao";
import iconv from "iconv-lite"
import { ErroDeRegra } from "../erro-regra"
import { conferirConflitoNaTransacao, validarApontamento, validarPosseOs } from "./regras-apontamento"
import ValidHoursChamado from "../call/valid-hours"
import ValidHoursTarefa from "../tarefa/valid-hours"
import {
    estourouLimiteHoras,
    mensagemLimiteMensalChamado,
    mensagemLimiteMensalTarefa,
} from "@/utils/limite-horas"
import { duracaoEmMinutos } from "@/utils/intervalo-horas"
import { formatarHoraBanco } from "@/utils/regras-apontamento"

export default async function UpdateOsService(
    codOs: any,
    description: string,
    date: string,
    startTime: string,
    endTime: string,
    recurso: number,
    ): Promise<boolean> {


    return new Promise(async (resolve, reject) => {

        try {

            // A OS precisa ser do consultor logado (e estar no período vigente) e os
            // novos dados passam pelas regras do apontamento. `recurso` vem da sessão.
            const osAtual = await validarPosseOs(recurso, codOs)
            await validarApontamento({ recurso, date, startTime, endTime, description, ignorarCodOs: codOs })

            // Limite mensal de horas: só confere quando a edição AUMENTA a duração da OS
            // (senão editar só a descrição de uma OS de mês já estourado ficaria
            // bloqueado). A própria OS fica fora da soma do mês.
            const duracaoAntiga = duracaoEmMinutos(formatarHoraBanco(osAtual.HRINI_OS), formatarHoraBanco(osAtual.HRFIM_OS))

            if (duracaoEmMinutos(startTime, endTime) > duracaoAntiga) {
                const codChamadoOs = String(osAtual.CHAMADO_OS ?? '').trim()
                let horasValidas: any[] = []

                try {
                    horasValidas = codChamadoOs
                        ? await ValidHoursChamado(codChamadoOs, date, startTime, endTime, codOs)
                        : await ValidHoursTarefa(osAtual.CODTRF_OS, date, startTime, endTime, codOs)
                } catch (e) {
                    // OS antiga sem tarefa ligada: sem limite pra conferir, não trava a edição.
                    console.log('Limite de horas não conferido na edição da OS', codOs, e)
                }

                if (estourouLimiteHoras(horasValidas, { ignorarLimiteZero: !!codChamadoOs })) {
                    return reject(new ErroDeRegra(
                        codChamadoOs
                            ? mensagemLimiteMensalChamado(horasValidas[1])
                            : mensagemLimiteMensalTarefa(horasValidas[0])
                    ))
                }
            }

            // Dentro da transação, logo antes do UPDATE: ninguém ocupou o horário
            // nesse meio-tempo (a própria OS fica de fora).
            await gravarEmSerie(async (tx) => {
                await conferirConflitoNaTransacao(tx, { recurso, date, startTime, endTime, ignorarCodOs: codOs })

                await tx.executar(
                    `UPDATE OS  SET DTINI_OS= ?, HRINI_OS= ?, HRFIM_OS= ?, OBS= ? WHERE COD_OS = ?`,
                    [
                        new Date(`${date} 00:00`).toLocaleString('pt-br', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replaceAll('/', '.').replaceAll(',', ''),
                        startTime.replace(":", ""),
                        endTime.replace(":", ""),
                        iconv.encode( description, 'WIN1252'),
                        codOs
                    ])
            })

            // só chega aqui com o commit terminado
            resolve(true)

        } catch (err) {
            console.log(err)
            return reject(err)
        }
    })
}