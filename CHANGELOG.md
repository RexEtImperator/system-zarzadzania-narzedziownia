# Changelog

Wszystkie istotne zmiany w projekcie będą dokumentowane w tym pliku.

## [Unreleased]

[Unreleased]: https://github.com/RexEtImperator/system-zarzadzania-narzedziownia/compare/1.8.0...HEAD

## [1.8.0] - 2025-11-04

### Dodane / Zmienione
- Kody narzędzi: wsparcie „Prefiksów per kategoria” (`toolCategoryPrefixes`) w konfiguracji ogólnej.
  - UI: sekcja „Kody qr/kreskowe” umożliwia przypisanie prefiksów dla każdej kategorii.
  - Zastosowanie: `ToolsScreen` i `LabelsManager` generują kody z priorytetem kategorii, następnie `toolsCodePrefix`.
- Powiadomienia: ujednolicenie wzorca toastr na ekranie „Konfiguracja aplikacji”.
  - Globalnie: `ToastContainer` z `autoClose=2500ms`, ukrytym paskiem postępu, motywem `colored` i spójnym stylem.
  - Lokalnie: helpery `notifySuccess`/`notifyError` w `AppConfigScreen.jsx` dla backupu, logo i kategorii.
- UI: poprawki w podglądzie konfiguracji, usunięto stary panel inline sukcesu po zapisie — teraz toast.
 - Narzędzia: sortowanie tabeli po numerze ewidencyjnym rosnąco; puste wartości na końcu.
 - Elektronarzędzia: endpoint sugestii `GET /api/tools/suggestions?category=Elektronarzędzia` (unikalne producent/model/rok).
 - ToolsScreen: podpowiedzi producenta/modelu/roku zasilane z backendu; fallback do danych z frontu, jeśli API niedostępne.
 - Szczegóły narzędzia: dodane pola „Producent”, „Model”, „Rok produkcji” dla kategorii „Elektronarzędzia”.
 - Eksporty PDF/XLSX: lista narzędzi i eksport szczegółów zawierają pola Producent/Model/Rok produkcji.
 - README: doprecyzowanie uruchamiania dev (proxy, alternatywny port) i dokumentacja endpointu sugestii.

### Usunięte
- Legacy pola konfiguracji: `codePrefix` (ogólny prefiks) oraz `defaultItemName`.
  - Frontend: usunięte z `AppConfigScreen` i przestano je odczytywać/zapisywać.
  - Backend: endpointy `GET/PUT /api/config/general` nie zwracają ani nie przyjmują tych pól.
  - Skrypty: `scripts/normalize_tools_codes.js` używa wyłącznie `tools_code_prefix` (bez fallbacku do `code_prefix`).

### Naprawione
- Narzędzia: `ReferenceError: toolCategoryPrefixes is not defined` — przeniesiono `getCategoryPrefix` do wnętrza komponentu, aby korzystał z jego stanu.

### Techniczne
- Wydajność: sortowanie numerów ewidencyjnych przy użyciu `Intl.Collator('pl', { numeric: true })` dla naturalnego porządku liczb w stringach.

[1.8.0]: https://github.com/RexEtImperator/system-zarzadzania-narzedziownia/releases/tag/1.8.0

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

## [1.5.0] - 2025-10-16

### Dodane / Zmienione
- Administrator: nowy ekran „Podgląd bazy danych” (DbViewer) z listą tabel po lewej i podglądem rekordów po prawej, w tym paginacja (`limit`, `offset`).
- Uprawnienia: dodano `VIEW_DATABASE` do dostępnych uprawnień i domyślnie dla roli `administrator`.
- TopBar: nowa pozycja w menu użytkownika „Podgląd bazy danych” (widoczna dla administratora).
- Ustawienia → Dane systemowe: rozdzielono na sekcje „Narzędzia” i „Sprzęt BHP”, dodano przyciski „Usuń historię wydań” i „Usuń historię zwrotów” dla obu sekcji; wprowadzono potwierdzenia akcji.

### Backend
- API: `GET /api/db/tables` oraz `GET /api/db/table/:name?limit=&offset=` — podgląd bazy z walidacją nazwy tabeli względem `sqlite_master` oraz paginacją.
- API: `DELETE /api/tools/history/issues`, `DELETE /api/tools/history/returns`, `DELETE /api/bhp/history/issues`, `DELETE /api/bhp/history/returns` — usuwanie historii, transakcje i wpisy audytowe.

### Techniczne
- Bezpieczeństwo: wymóg uprawnienia `VIEW_DATABASE` do korzystania z API podglądu bazy; walidacja nazw tabel.

[1.5.0]: https://github.com/RexEtImperator/system-zarzadzania-narzedziownia/releases/tag/1.5.0

## [1.6.0] - 2025-10-21

### Dodane / Zmienione
- ConfirmationModal: pełne wsparcie trybu ciemnego (dark mode) dla wszystkich elementów modala.
- Dziennik audytu: dodano modal potwierdzenia dla akcji usuwania logów (zastępuje `window.confirm`).
- UI: spójne kolory i zachowanie modali w trybie jasnym i ciemnym.

### Backend
- Audyt: ujednolicenie endpointu usuwania logów — korzystanie z `DELETE /api/audit`.

[1.6.0]: https://github.com/RexEtImperator/system-zarzadzania-narzedziownia/releases/tag/1.6.0

## [1.7.0] - 2025-10-22

### Dodane / Zmienione
- Stan magazynowy (Inventory): widok mobilny — ukryto kolumny `SKU`, `Min`, `Max`; przeniesiono szczegóły do podglądu w komórce `Nazwa`.
- Dziennik audytu (Audit Log): widok mobilny — ukryto `Użytkownik`, `Data i czas`, `IP` oraz `Akcja`; dodano chip „Akcja” w podglądzie komórki `Szczegóły` wraz z Użytkownikiem, IP i Szczegółami.
- UI: poprawiona responsywność tabel na telefonach, spójne style elementów mobilnego podglądu.

[1.7.0]: https://github.com/RexEtImperator/system-zarzadzania-narzedziownia/releases/tag/1.7.0