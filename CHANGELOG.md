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