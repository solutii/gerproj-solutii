import { Firebird, getConnection } from "../../../services/firebird";
import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const codRecurso = body?.COD_RECURSO ?? body?.cod_recurso ?? body?.codRecurso;
    if (codRecurso == null) {
      return NextResponse.json({ error: "COD_RECURSO is required" }, { status: 400 });
    }

    const areasResult = await new Promise((resolve, reject) => {
      getConnection( (attachErr: any, db: any) => {
        if (attachErr) return reject(attachErr);

        const sql = `
          SELECT A.COD_AREA, A.NOME_AREA, A.ATIVO_AREA, A.CHAMADO_AREA,
                 R.OBS_RECAREA,
                 CASE WHEN R.COD_AREA IS NOT NULL THEN '1' ELSE '0' END AS SELECTED
          FROM AREA A
          LEFT JOIN RECAREA R ON (R.COD_AREA = A.COD_AREA AND R.COD_RECURSO = ?)
          WHERE A.ATIVO_AREA = 'SIM' AND A.CHAMADO_AREA = 'SIM'
        `;

        db.query(sql, [codRecurso], (queryErr: any, rows: any) => {
          db?.detach();
          if (queryErr) return reject(queryErr);

          resolve((rows || []).map((r: any) => {
            const out: any = {};
            for (const k of Object.keys(r)) out[k] = CorrigirTextoCorrompido(r[k]);
            out.SELECTED = out.SELECTED.trim()
            return out;
          }));
        });
      });
    });

    return NextResponse.json(areasResult);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

const CorrigirTextoCorrompido = function (
  texto: string | null | undefined,
): string {
  if (!texto) return '';

  // Se o texto não tiver caracteres suspeitos, retorna como está
  const suspeitos = /[ÃãÂâÊêÔôÛûÇç©§�ýÝ]/;
  if (!suspeitos.test(texto)) return texto;

  try {
    // Primeira tentativa — corrigir encoding UTF-8 lido como Latin1

    // Se após correção ainda tiver caracteres estranhos, faz substituições manuais
    if (/�|ý/.test(texto) || /Ã|Â|Ê|Ô|Û/.test(texto)) {
      return corrigirManual(texto);
    }

    return texto;
  } catch {
    // Fallback em caso de erro
    return corrigirManual(texto);
  }
}

/**
 * Substitui manualmente caracteres corrompidos comuns.
 * Útil quando o decodeURIComponent falha parcialmente.
 */
const corrigirManual = (texto: string): string => {
  const mapa: Record<string, string> = {
    // Acentos minúsculos
    'Ã¡': 'á',
    'Ã ': 'à',
    'Ã¢': 'â',
    'Ã£': 'ã',
    'Ãª': 'ê',
    'Ã©': 'é',
    'Ã¨': 'è',
    'Ã§': 'ç',
    'Ã³': 'ó',
    'Ã´': 'ô',
    'Ãº': 'ú',
    'Ã¼': 'ü',
    'Ã­': 'í',
    
    // Acentos maiúsculos
    'Ã"': 'Ó',
    'Ã‰': 'É',
    'Ã€': 'À',
    'ÃŠ': 'Ê',
    'Ã‡': 'Ç',
    'Ã': 'Á',
    
    // Pontuação
    'â€"': '–',
    'â€œ': '"',
    'â€�': '"',
    'â€˜': "'",
    'â€™': "'",
    'â€¢': '•',
    'â€¦': '…',
    
    // Símbolos
    'Âº': 'º',
    'Âª': 'ª',
    'Â°': '°',
    'Â': '',
    
    // Casos específicos
    '�O': 'ÃO',
    '�A': 'ÇA',
    '�NIO': 'ÔNIO',
    'Tý': 'TÔ',
    'ýý': 'ÇÃ',  // ✅ EVOLUÇÃO
    'Dý': 'DÃ', 
    'ý': 'Ç',
    '�ÃO': 'ÇÃO',
    '�ncia': 'ência',
    'AN�LISE': 'ANÁLISE',
    'NEG�CIOS': 'NEGÓCIOS',
  };

  let corrigido = texto;
  
  // Aplica as substituições do mapa (ordem importa!)
  for (const [errado, certo] of Object.entries(mapa)) {
    corrigido = corrigido.replaceAll(errado, certo);
  }

  return corrigido;
}