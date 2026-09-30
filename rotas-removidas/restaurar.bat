@echo off
rem Restaura rotas da API (e os servicos que elas usam) removidas do sistema.
rem
rem   restaurar.bat               restaura TODAS (ticket tocfrio cliente consultor save)
rem   restaurar.bat ticket        restaura so a rota /api/ticket (e o servico dela)
rem   restaurar.bat cliente save  restaura mais de uma
rem
rem Depois de restaurar, rode "pnpm build" (e copie o .next para o servidor).
setlocal
cd /d "%~dp0"

if "%~1"=="" (
    set LISTA=ticket tocfrio cliente consultor save
) else (
    set LISTA=%*
)

for %%R in (%LISTA%) do call :restaurar %%R

echo.
echo Pronto. Agora rode "pnpm build" para as rotas voltarem a valer.
endlocal
goto :eof

:restaurar
if not exist "%1\route.ts.removida" goto :naoencontrada
if not exist "..\src\app\api\%1" mkdir "..\src\app\api\%1"
copy /Y "%1\route.ts.removida" "..\src\app\api\%1\route.ts" >nul
echo Restaurada: /api/%1
call :servico %1
goto :eof

:naoencontrada
echo NAO ENCONTRADA: %1
goto :eof

:servico
rem tocfrio usa o mesmo servico do ticket
set SRV=%1
if "%1"=="tocfrio" set SRV=ticket
if not exist "services\%SRV%\index.ts.removida" goto :eof
if not exist "..\src\services\%SRV%" mkdir "..\src\services\%SRV%"
copy /Y "services\%SRV%\index.ts.removida" "..\src\services\%SRV%\index.ts" >nul
echo   + servico restaurado: src\services\%SRV%
goto :eof
