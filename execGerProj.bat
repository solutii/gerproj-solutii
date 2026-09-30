@echo off
title GERPROJ - web-app

rem Caminho absoluto da aplicacao (ajuste se estiver em outro lugar)
set "APP_DIR=C:\GERPROJ\web-app-2"

cd /d "%APP_DIR%" || (
    echo [ERRO] Pasta nao encontrada: %APP_DIR%
    pause
    exit /b 1
)

where pnpm >nul 2>&1 || (
    echo [ERRO] pnpm nao encontrado no PATH. Instale com: npm install -g pnpm
    pause
    exit /b 1
)

rem Modo producao: precisa da pasta .next gerada por "pnpm build" (copiada da
rem maquina de desenvolvimento). O node_modules NAO deve ser copiado -- rode
rem "pnpm install --frozen-lockfile --prod" aqui no servidor.
if not exist "%APP_DIR%\.next\BUILD_ID" (
    echo [ERRO] Build nao encontrado em %APP_DIR%\.next
    echo Gere com "pnpm build" na maquina de desenvolvimento e copie a pasta .next para ca.
    pause
    exit /b 1
)

call pnpm start

echo.
echo [AVISO] O servidor parou (codigo %errorlevel%). Veja a mensagem acima.
pause
