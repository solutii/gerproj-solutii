import { ChamadosType, STATUS_CHAMADO, STATUS_CHAMADO_COD } from "@/types/chamados";
import { Firebird, getConnection } from "../firebird";

export default async function ValidHoursService(
    chamado: any,
    date: string,
    startTime: string,
    endTime: string,
    // Na edição de uma OS, ela mesma não entra na soma do mês (senão contaria
    // duas vezes: a versão antiga e a nova).
    ignorarCodOs?: number | string
): Promise<any[]> {


    return new Promise(async (resolve, reject) => {

        let db: any = null

        try {

            db = await new Promise((resolve, reject) => {
                getConnection( (err: any, db: any) => {
                    if (err) {
                        return reject(err)
                    }
                    return resolve(db)
                })
            })

            let [codTarefa, limmesTarefa, perimpTarefa]: [codTarefa: string, limmesTarefa: string, perimpTarefa: string] = await new Promise((resolve, reject) => {

                db.query(`SELECT COD_TAREFA, HRREAL_TAREFA, PERIMP_TAREFA FROM TAREFA WHERE COD_TAREFA = ?`,
                    [chamado], async function (err: any, res: any) {
                        if (err) {
                            db?.detach()
                            return reject(err);
                        }
                        return resolve([res[0]['COD_TAREFA'], res[0]['HRREAL_TAREFA'], res[0]['PERIMP_TAREFA']])
                    })
            })

            


            const firstDayOfMonth = `${date.slice(0, 8)}01`;
            const lastDayOfMonth = new Date(
                parseInt(date.slice(0, 4)),
                parseInt(date.slice(5, 7)),
                0
            ).toISOString().slice(0, 10);

            let responseHrsTotais: [] = await new Promise((resolve, reject) => {

                db.query(`select HRINI_OS, HRFIM_OS from OS where CODTRF_OS =  ?  and dtini_os >= ? and dtini_os <= ?${ignorarCodOs !== undefined ? ' and COD_OS <> ?' : ''}`,
                    ignorarCodOs !== undefined ? [codTarefa, firstDayOfMonth, lastDayOfMonth, ignorarCodOs] : [codTarefa, firstDayOfMonth, lastDayOfMonth], async function (err: any, res: any) {
                        if (err) {
                            db?.detach()
                            return reject(err);
                        }
                        return resolve(res)
                    })
            })

            if (!responseHrsTotais) {
                return resolve([])
            }


            const getTimeToMinutes = (hrIni: string, hrFim: string): any => {

                let minutesIni = parseInt(hrIni.slice(2, 4))
                minutesIni += parseInt(hrIni.slice(0, 2)) * 60

                let minutesFim = parseInt(hrFim.slice(2, 4))
                minutesFim += parseInt(hrFim.slice(0, 2)) * 60

                return minutesFim - minutesIni

            }

            let minTotais: number = 0

            minTotais = responseHrsTotais.reduce((acum, response) => {
                return (acum + getTimeToMinutes(response['HRINI_OS'], response['HRFIM_OS']))

            }, getTimeToMinutes(startTime.replaceAll(':', ''), endTime.replaceAll(':', '')))

            // HRREAL_TAREFA pode ter casas decimais (ex: 4.8h) -- parseInt truncaria pra 4h.
            let limmesTarefaMin = Math.round(Number(limmesTarefa) * 60)

            return resolve([limmesTarefaMin, minTotais, perimpTarefa])

        } catch (err) {
            db?.detach();

            console.log("+================================================+")
            console.log("Código da tarefa", chamado)
            console.log("error:", err)
            console.log("+================================================+")
            return reject(err)
        }
    })
}