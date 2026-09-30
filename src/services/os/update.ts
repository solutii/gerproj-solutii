import { ChamadosType, STATUS_CHAMADO, STATUS_CHAMADO_COD } from "@/types/chamados";
import { Firebird, getConnection } from "../firebird";
import iconv from "iconv-lite"
import { ErroDeRegra } from "../erro-regra"
import { validarApontamento, validarPosseOs } from "./regras-apontamento"
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

        let db: any = null

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

            db = await new Promise((resolve, reject) => {
                getConnection( (err: any, db: any) => {
                    if (err) {
                        return reject(err)
                    }
                    return resolve(db)
                })
            })

            
   
            const transaction: any = await new Promise((resolve, reject) => {
                db.transaction(Firebird.ISOLATION_READ_COMMITTED, (err: any, transaction: any) => {
                    if (err) {
                        db?.detach()
                        return reject(err)
                    }
                    return resolve(transaction)
                })
            })
            
            let success = await new Promise((resolve, reject) => {
                transaction.query(
                `UPDATE OS  SET DTINI_OS= ?, HRINI_OS= ?, HRFIM_OS= ?, OBS= ? WHERE COD_OS = ?`,
                    [
                        new Date(`${date} 00:00`).toLocaleString('pt-br', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replaceAll('/', '.').replaceAll(',', ''),
                        startTime.replace(":", ""),
                        endTime.replace(":", ""),
                        iconv.encode( description, 'WIN1252'),
                        codOs
                    ], async function (err: any, result: any) {

                        if (err) {
                            
                            transaction.rollback();
                            db?.detach()
                            return reject(err)
                        }

                        return resolve(true)

                        
                    });
            })

            success = await transaction.commit((err: Error) => {
                if (err) {
                    console.log(err)
                    transaction.rollback();
                    return reject(err)
                }
                else {
                    db?.detach();
                    return resolve(true)
                }

            });

            db?.detach()
            resolve(true)


        } catch (err) {
            console.log(err)
            db?.detach();
            return reject(err)
        }
    })
}