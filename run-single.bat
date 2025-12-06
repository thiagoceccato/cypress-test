@echo off
REM run-single.bat
REM Executa um único cenário de auditoria
REM Uso: run-single.bat [nome-do-cenario]
REM Exemplo: run-single.bat home

if "%1"=="" (
    echo.
    echo Uso: run-single.bat [nome-do-cenario]
    echo.
    echo Cenarios disponiveis:
    echo   - home
    echo   - seja-associado
    echo   - cartoes
    echo   - consorcio
    echo   - investimentos
    echo   - seguros
    echo   - credito
    echo   - pix
    echo   - maquina-cartoes
    echo   - previdencia
    echo   - outros
    echo.
    exit /b 1
)

echo.
echo ========================================
echo   Auditoria GA4 - Cenario: %1
echo ========================================
echo.

npx cypress run --spec "cypress/e2e/cenarios/%1.cy.js" --browser chrome

echo.
echo Arquivos gerados em: cypress\downloads\
dir /b cypress\downloads\auditoria_%1_*.xlsx 2>nul
echo.

