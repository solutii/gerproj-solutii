// Política de conteúdo (CSP): o navegador só carrega script, estilo, imagem,
// fonte e conexão do próprio sistema -- se alguém conseguisse injetar HTML numa
// tela, ele não poderia carregar código de outro site nem enviar dados para fora.
//  - 'unsafe-inline' em script: o Next injeta scripts inline na hidratação e o
//    layout tem o script do tema escuro; tirar isso exigiria nonce por requisição
//    (o que desliga a renderização estática das páginas). Fica como melhoria futura.
//  - 'unsafe-eval' só em desenvolvimento (recarga automática do Next).
//  - Sem upgrade-insecure-requests/HSTS de propósito: o sistema ainda roda em
//    HTTP (HTTPS fica para depois).
const emDesenvolvimento = process.env.NODE_ENV !== "production";
const politicaDeConteudo = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${emDesenvolvimento ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${emDesenvolvimento ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
    // Não anuncia "X-Powered-By: Next.js" nas respostas.
    poweredByHeader: false,
    // Cabeçalhos de segurança em todas as rotas.
    async headers() {
        return [
            {
                source: "/(.*)",
                headers: [
                    { key: "Content-Security-Policy", value: politicaDeConteudo },
                    // Impede o site de ser embutido em iframe de outro domínio (clickjacking).
                    { key: "X-Frame-Options", value: "SAMEORIGIN" },
                    // O navegador não "adivinha" o tipo do arquivo.
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    // Não manda a URL completa para outros sites.
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                    // O sistema não usa câmera, microfone nem localização.
                    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
                ],
            },
        ];
    },
    experimental: {
        // (instrumentationHook não é mais necessário: no Next 15 o src/instrumentation.ts
        // -- warm-up do pool do Firebird no boot -- funciona sem flag.)
        // Tree-shaking melhor pra libs de import "barrel" -- reduz módulos
        // processados por página em dev.
        optimizePackageImports: ['react-icons'],
    },
};

export default nextConfig;
