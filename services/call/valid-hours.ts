import { ChamadosType, STATUS_CHAMADO, STATUS_CHAMADO_COD } from "@/models/chamados";
import { Firebird, options } from "../firebird";

export default async function ValidHoursService(
    chamado: any,
    date: string,
    startTime: string,
    endTime: string
): Promise<any[]> {


    return new Promise(async (resolve, reject) => {

        let db: any = null

        try {

            db = await new Promise((resolve, reject) => {
                Firebird.attach(options, (err: any, db: any) => {
                    if (err) {
                        return reject(err)
                    }
                    return resolve(db)
                })
            })

            let [codTarefa, limmesTarefa, perimpTarefa]: [codTarefa: string, limmesTarefa: string, perimpTarefa: string] = await new Promise((resolve, reject) => {

                db.query(`SELECT COD_TAREFA, LIMMES_TAREFA, PERIMP_TAREFA FROM TAREFA WHERE COD_TAREFA IN (SELECT CODTRF_CHAMADO FROM CHAMADO where COD_CHAMADO = ?)`,
                    [chamado], async function (err: any, res: any) {
                        if (err) {
                            db.detach()
                            return reject(err);
                        }
                        return resolve([res[0]['COD_TAREFA'], res[0]['LIMMES_TAREFA'], res[0]['PERIMP_TAREFA']])
                    })
            })


            const firstDayOfMonth = `${date.slice(0, 8)}01`;
            const lastDayOfMonth = new Date(
                parseInt(date.slice(0, 4)),
                parseInt(date.slice(5, 7)),
                0
            ).toISOString().slice(0, 10);

             
            console.log(`select HRINI_OS, HRFIM_OS from OS where CODTRF_OS =  ${codTarefa}  and dtini_os >= ${firstDayOfMonth} and dtini_os <= ${lastDayOfMonth}`)

            let responseHrsTotais: [] = await new Promise((resolve, reject) => {

                db.query(`select HRINI_OS, HRFIM_OS from OS where CODTRF_OS =  ?  and dtini_os >= ? and dtini_os <= ?`,
                    [codTarefa, firstDayOfMonth, lastDayOfMonth], async function (err: any, res: any) {
                        if (err) {
                            db.detach()
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

            let limmesTarefaMin = parseInt(limmesTarefa) * 60

            return resolve([limmesTarefaMin, minTotais, perimpTarefa])

        } catch (err) {
            db.detach();
            return reject(err)
        }
    })
}