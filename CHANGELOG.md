# Changelog

Wszystkie istotne zmiany w projekcie będą dokumentowane w tym pliku.

## [1.1.0] - 2025-10-03

### Dodane / Zmienione
- Konfiguracja aplikacji: przebudowa układu zakładek na pionowy (lewy panel nawigacyjny, prawa część z treścią).
- Sticky lewy panel na większych ekranach, poprawiona użyteczność.
- Dynamiczny nagłówek sekcji po prawej: wyświetla ikonę i nazwę aktywnej zakładki.
- Dark mode: poprawki w `EmployeeModal` i spójne style w modalach.
- README: link do licencji MIT, dodany badge wersji i statusu builda.
- Licencja: dodany plik `license.md` (MIT).
- Wersja: podbicie wersji w `package.json` (root i backend) na `1.1.0`.
- Repozytorium: przygotowanie do zmiany nazwy na `system-zarzadzania-narzedziownia`.

### Techniczne
- Ujednolicone style i placeholdery w modalach.
- Minimalne porządki w strukturze komponentów konfiguracyjnych.

[1.1.0]: https://github.com/RexEtImperator/system-zarzadzania-narzedziownia/releases/tag/1.1.0

## [1.1.1] - 2025-10-03

### Zmienione
- BHP: poprawna odmiana w przypomnieniach przeglądu ("Przegląd za 1 dzień" zamiast "1 dni").
- API BHP: endpoint `PUT /api/bhp/:id` zwraca zaktualizowany rekord w odpowiedzi (`{ message, item }`).
- API BHP: zabezpieczenie aktualizacji przed nadpisywaniem istniejących danych `NULL` lub pustym stringiem (użycie `COALESCE/NULLIF`).

### Techniczne
- Drobne porządki w komponentach UI, nowe logotypy w `public/logos/`.

[1.1.1]: https://github.com/RexEtImperator/system-zarzadzania-narzedziownia/releases/tag/1.1.1

## [1.2.0] - 2025-10-03

### Dodane / Zmienione
- Narzędzia: komunikat potwierdzenia po edycji (toast) — „Pomyślnie zaktualizowano dane narzędzia”.
- BHP: poprawione sortowanie listy przeglądów dla „Najbliższy” i „Najdalszy”.
- API Narzędzia: poprawione endpointy w UI (`PUT/DELETE /api/tools/:id`).
- Konfiguracja: zakładka „Backup” — wyświetlanie ostatniej kopii, listy plików oraz przycisk „Wykonaj kopię”.
- Dokumentacja: zaktualizowana sekcja „Struktura projektu” w README.

### Techniczne
- Fix: obsługa odpowiedzi `POST /api/tools` bez użycia `.data` (klient zwraca obiekt bez wrappera).
- Guard: defensywny `filter(Boolean)` przy filtrowaniu listy narzędzi, aby uniknąć błędów na pustych wpisach.

[1.2.0]: https://github.com/RexEtImperator/system-zarzadzania-narzedziownia/releases/tag/1.2.0

## [1.4.0] - 2025-10-06

### Dodane / Zmienione
- Uprawnienia: dodano `MANAGE_EMPLOYEES` do listy dostępnych uprawnień oraz do domyślnych ról (`administrator`, `manager`).
- API Pracownicy: wymagane uprawnienie `MANAGE_EMPLOYEES` dla endpointów `POST/PUT/DELETE /api/employees`.
- UI: warunkowe wyświetlanie kafelka „Dodaj pracownika” na Dashboardzie i przycisku w ekranie Pracownicy w zależności od uprawnienia.
- Wersja: podbicie wersji frontendu (`package.json`) do `1.4.0`.
 - Porty dev: stała konfiguracja — backend na `http://localhost:3000`, frontend na `https://localhost:3001` (proxy do backendu).
 - Dashboard: zmieniono kafelek „Stanowiska” na „Pracownicy” i wyświetlanie łącznej liczby pracowników.
 - Analityka: usunięto kafelki statystyk na górze sekcji.
 - Nawigacja: usunięto zakładkę „Etykiety” z menu i tras aplikacji.

### Techniczne
- Spójność polityki uprawnień między backendem a frontendem (wspólne stałe i walidacja).

[1.4.0]: https://github.com/RexEtImperator/system-zarzadzania-narzedziownia/releases/tag/1.4.0