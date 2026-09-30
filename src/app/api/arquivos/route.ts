import StandbyCallService from '@/services/call/standby'
import { NextResponse, type NextRequest } from 'next/server'
import { respostaErroInterno } from '@/services/erro-interno'
import AdmZip  from 'adm-zip'
import fs from 'fs';
import path from 'path';
import { getAnexosBasePath } from '@/services/anexos';
import { exigirChamadoDoConsultor } from '@/services/permissao';

async function handler(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const codChamado = searchParams.get('codChamado')

  // Só dígitos (evita caminho tipo "../") e o chamado precisa ser do consultor.
  const permissao = await exigirChamadoDoConsultor(request, codChamado)
  if (!permissao.ok) return permissao.resposta


  try {

    const folderPath = path.resolve(path.join(getAnexosBasePath(), 'CALLTECH', String(codChamado)));

    if (!fs.existsSync(folderPath)) {
        return NextResponse.json({ message: 'Chamado sem anexo!' });
    }

    const zip = new AdmZip();

    // Lê todos os arquivos da pasta
    const files = fs.readdirSync(folderPath);

    // Adiciona cada arquivo ao ZIP
    files.forEach((file) => {
        const filePath = path.join(folderPath, file);
        zip.addLocalFile(filePath);
    });
    
     // Gera o buffer do arquivo ZIP
    const zipBuffer = zip.toBuffer();

    // Define os cabeçalhos para download
    const headers = new Headers({
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename=files.zip',
    });

  // Retorna o ZIP como uma resposta NextResponse com os cabeçalhos
  return new NextResponse(new Uint8Array(zipBuffer), {
    headers,
  });

    
  } catch(error) {


    return respostaErroInterno(error, 'arquivos')
  }
  
  

  
}

export { handler as GET, handler as POST };