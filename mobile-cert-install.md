# Instalacja certyfikatu SSL na telefonie

## 📱 Instrukcje dla Android

### Krok 1: Pobierz certyfikat
1. Otwórz przeglądarkę na telefonie
2. Przejdź do: `https://192.168.10.195:3001/localhost.crt`
3. Certyfikat zostanie automatycznie pobrany

### Krok 2: Zainstaluj certyfikat
1. Otwórz **Ustawienia** → **Bezpieczeństwo** → **Szyfrowanie i dane uwierzytelniające**
2. Wybierz **Zainstaluj z pamięci urządzenia** (lub **Zainstaluj certyfikat**)
3. Znajdź pobrany plik `localhost.crt`
4. Nadaj certyfikatowi nazwę: `localhost`
5. Wybierz **Użycie certyfikatu**: **VPN i aplikacje**
6. Potwierdź instalację

### Krok 3: Sprawdź instalację
1. Przejdź do **Ustawienia** → **Bezpieczeństwo** → **Zaufane dane uwierzytelniające**
2. Zakładka **Użytkownik** → znajdź certyfikat `localhost`

---

## 🍎 Instrukcje dla iOS

### Krok 1: Pobierz certyfikat
1. Otwórz Safari na iPhone/iPad
2. Przejdź do: `https://192.168.10.195:3001/localhost.crt`
3. Pojawi się okno dialogowe - wybierz **Zezwól**
4. Certyfikat zostanie pobrany do **Ustawienia**

### Krok 2: Zainstaluj profil
1. Otwórz **Ustawienia** → **Ogólne** → **VPN i zarządzanie urządzeniem**
2. W sekcji **Profile konfiguracyjne** znajdź `localhost`
3. Dotknij profilu i wybierz **Zainstaluj**
4. Wprowadź kod dostępu urządzenia
5. Potwierdź instalację wybierając **Zainstaluj** (2 razy)

### Krok 3: Włącz zaufanie dla certyfikatu
1. Przejdź do **Ustawienia** → **Ogólne** → **Informacje** → **Ustawienia zaufania certyfikatów**
2. W sekcji **Włącz pełne zaufanie dla głównych certyfikatów** znajdź `localhost`
3. Włącz przełącznik obok certyfikatu
4. Potwierdź wybierając **Kontynuuj**

---

## 🌐 Testowanie połączenia

Po zainstalowaniu certyfikatu:

1. **Otwórz przeglądarkę na telefonie**
2. **Przejdź do**: `https://192.168.10.195:3001`
3. **Sprawdź czy**:
   - ✅ Brak ostrzeżeń o certyfikacie
   - ✅ Ikona kłódki w pasku adresu
   - ✅ Aplikacja ładuje się poprawnie

---

## 🔧 Rozwiązywanie problemów

### Problem: "Nie można pobrać certyfikatu"
- Upewnij się, że telefon jest w tej samej sieci Wi-Fi co komputer
- Sprawdź czy serwer React działa na `https://192.168.10.195:3001`

### Problem: "Certyfikat nie jest zaufany"
- **Android**: Sprawdź czy certyfikat jest w zakładce **Użytkownik** w zaufanych certyfikatach
- **iOS**: Upewnij się, że włączyłeś pełne zaufanie w ustawieniach

### Problem: "Strona nie ładuje się"
- Sprawdź połączenie Wi-Fi
- Upewnij się, że używasz adresu IP: `192.168.10.195:3001` (nie `localhost`)
- Zrestartuj przeglądarkę na telefonie

---

## 📋 Podsumowanie

**Adres IP serwera**: `192.168.10.195:3001`  
**Link do certyfikatu**: `https://192.168.10.195:3001/localhost.crt`  
**Aplikacja**: `https://192.168.10.195:3001`

Po poprawnej instalacji certyfikatu będziesz mógł bezpiecznie korzystać z aplikacji na telefonie przez HTTPS bez ostrzeżeń o bezpieczeństwie.