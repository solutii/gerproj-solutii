import { Firebird, options } from "../../../services/firebird";
import { NextResponse, type NextRequest } from 'next/server'
import { respostaErroInterno } from '@/services/erro-interno'

async function handler(request: NextRequest) {

  const {
    CNPJ,
    OPCAO,
  } = await request.json();


  try {
    const request = await new Promise((resolve, reject) => {
            Firebird.attach(options, async (err: any, db: any) => {
                if (err) return reject(err);

                db.query(
                    `
                    SELECT *
                    FROM APIBRADESCO

                    WHERE
                    CNPJ_APIBRADESCO=?
                    AND OPCAO_APIBRADESCO=?
                    `,
                    [CNPJ, OPCAO],
                    async (err: any, result: any) => {
                        if (err) {
                            db.detach();
                            return reject(err);
                        }

                        if (!result.length) {
                            db.detach();
                            return resolve([]);
                        }

                        try {

                            db.detach();
                            resolve(result[0]);
                        } catch (e) {
                            db.detach();
                            reject(e);
                        }
                    }
                );
            });
        });




    return NextResponse.json(request)
  } catch(error) {


    return respostaErroInterno(error, 'apibradesco')
  }



}

export { handler as POST };
