import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import mime from 'mime';
import { getAnexosBasePath } from '@/services/anexos';
import { exigirChamadoDoConsultor } from '@/services/permissao';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs'; // allow fs usage in Next.js route

// Limite de tamanho de um anexo (a rota lê o arquivo inteiro na memória).
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const respostaMuitoGrande = () =>
  NextResponse.json(
    { success: false, message: 'Arquivo muito grande. O limite é de 25 MB.' },
    { status: 413 },
  );

function sanitizeName(name: string) {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
}

export async function POST(request: NextRequest) {
  try {
    if (request.method !== 'POST') {
      return NextResponse.json({ message: 'Método não permitido. Use POST.' }, { status: 405 });
    }

    const url = new URL(request.url);
    const codChamado = url.searchParams.get('codChamado');
    if (!codChamado) {
      return NextResponse.json({ message: 'O parâmetro codChamado é obrigatório.' }, { status: 400 });
    }

    // Só dígitos (evita caminho tipo "../") e o chamado precisa ser do consultor.
    const permissao = await exigirChamadoDoConsultor(request, codChamado);
    if (!permissao.ok) return permissao.resposta;

    const safeCod = sanitizeName(codChamado);
    const folderPath = path.resolve(path.join(getAnexosBasePath(), 'CALLTECH', safeCod));

    await fs.promises.mkdir(folderPath, { recursive: true });

    // Recusa antes de ler o corpo quando o tamanho declarado já passa do limite.
    if (Number(request.headers.get('content-length') ?? 0) > MAX_UPLOAD_BYTES) {
      return respostaMuitoGrande();
    }

    const contentType = request.headers.get('content-type') || '';
    let fileName = `uploaded_file`;
    let buffer: Uint8Array;

    if (contentType.includes('multipart/form-data')) {
      // Handle multipart form uploads (field can be named 'file' or any file field)
      const form = await request.formData();
      let file: File | null = null;

      form.forEach((value) => {
        if (value instanceof File) {
          file = value;
        }
      });

      if (!file) {
        return NextResponse.json({ message: 'Nenhum arquivo encontrado no form-data.' }, { status: 400 });
      }

      // In Node runtime the DOM File type may not be fully available to TypeScript here,
      // so assert to any to access name and arrayBuffer safely.
      const f: any = file;
      fileName = (f.name as string) || fileName;
      buffer = new Uint8Array(await f.arrayBuffer());
    } else {
      // Raw body (fetch with file in body and proper content-type)
      const ext = contentType ? mime.getExtension(contentType) || 'bin' : 'bin';
      fileName = `${fileName}.${ext}`;
      const ab = await request.arrayBuffer();
      buffer = new Uint8Array(ab);
    }

    if (buffer.byteLength > MAX_UPLOAD_BYTES) {
      return respostaMuitoGrande();
    }

    // sanitize filename and ensure unique
    const safeFileName = sanitizeName(path.basename(fileName));
    const filePath = path.join(folderPath, safeFileName);

    await fs.promises.writeFile(filePath, buffer);

    // Sem o caminho da pasta no servidor na resposta.
    return NextResponse.json({ success: true, message: 'Upload realizado com sucesso!' });
  } catch (err) {
    // O detalhe (caminho, erro do sistema de arquivos) fica só no log do servidor.
    console.error('[upload]', err);
    return NextResponse.json({ success: false, message: 'Erro ao realizar upload.' }, { status: 500 });
  }
}
