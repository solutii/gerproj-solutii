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
        // Necessário no Next 14 pra ativar o hook de src/instrumentation.ts
        // (warm-up do pool do Firebird no boot) -- estável sem flag a partir
        // do Next 15.
        instrumentationHook: true,
        // Tree-shaking melhor pra libs de import "barrel" -- reduz módulos
        // processados por página em dev.
        optimizePackageImports: ['react-icons'],
    },
};

export default nextConfig;
