@echo off
echo Usuwanie starego certyfikatu localhost...
certutil -delstore -f "ROOT" "localhost" >nul 2>&1

echo Instalowanie nowego certyfikatu SSL dla localhost...
certutil -addstore -f "ROOT" "%~dp0ssl\localhost.crt"

if %errorlevel% equ 0 (
    echo.
    echo ✅ Certyfikat został pomyślnie zainstalowany!
    echo 🔄 Uruchom ponownie przeglądarkę aby zastosować zmiany.
    echo.
    echo Certyfikat zawiera Subject Alternative Names dla:
    echo - DNS: localhost
    echo - IP: 127.0.0.1
    echo - IP: ::1
) else (
    echo.
    echo ❌ Błąd podczas instalacji certyfikatu.
    echo Upewnij się, że uruchamiasz skrypt jako administrator.
)

pause