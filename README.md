# System Zarządzania Narzędziownią

[![Wersja](https://img.shields.io/badge/version-1.1.0-blue)](https://github.com/RexEtImperator/system-zarzadzania-narzedziownia/releases/tag/1.1.0)
[![Build](https://github.com/RexEtImperator/system-zarzadzania-narzedziownia/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/RexEtImperator/system-zarzadzania-narzedziownia/actions/workflows/ci.yml)

System zarządzania narzędziami i pracownikami - aplikacja webowa do zarządzania wypożyczaniem narzędzi w firmie.

## Opis projektu

Aplikacja umożliwia:
- Zarządzanie bazą narzędzi
- Zarządzanie pracownikami i ich danymi
- Wypożyczanie i zwracanie narzędzi
- Śledzenie historii wypożyczeń
- Zarządzanie działami i pozycjami
- System uprawnień użytkowników

## Technologie

### Frontend
- React.js
- Tailwind CSS
- React Toastify (powiadomienia)

### Backend
- Node.js
- Express.js
- SQLite (baza danych)

## Instalacja

1. Sklonuj repozytorium:
```bash
git clone https://github.com/[username]/system-zarzadzania-narzedziownia.git
cd system-zarzadzania-narzedziownia
```

2. Zainstaluj zależności:
```bash
npm install
```

3. Uruchom serwer backend:
```bash
npm run server
```

4. Uruchom aplikację frontend (w nowym terminalu):
```bash
npm start
```

## Konfiguracja .env

Zalecane zmienne środowiskowe dla rozwoju lokalnego:

- Backend (`.env` w katalogu głównym):
  - `PORT=3000`
  - `JWT_SECRET=twój_sekretny_klucz` (opcjonalnie; w kodzie jest domyślny klucz)
  - `CORS_ORIGINS=http://localhost:3001,http://localhost:3000` (opcjonalnie)

- Frontend (`.env.development.local`):
  - `PORT=3001`
  - `HTTPS=true`
  - `SSL_CRT_FILE=ssl\\localhost.crt`
  - `SSL_KEY_FILE=ssl\\localhost.key`
  - `REACT_APP_API_BASE=http://localhost:3000` (opcjonalnie; w dev działa proxy z `src/setupProxy.js`)

- Certyfikaty i urządzenia mobilne:
  - Wygeneruj certyfikaty: `node generate-ssl.js`, następnie uruchom `install-cert.bat`
  - Instrukcja instalacji certyfikatu na telefonach: [mobile-cert-install.md](mobile-cert-install.md)

Uwagi:
- CRA respektuje `PORT` i `HTTPS` dla frontendu; backend czyta `process.env.PORT`.
- Jeśli `3001` jest zajęty, ustaw inny port w `.env.development.local`.

## Struktura projektu

```
├── src/                    # Kod źródłowy frontend
│   ├── App.jsx            # Główny komponent aplikacji
│   ├── api.js             # Klient API
│   ├── index.js           # Punkt wejścia
│   └── index.css          # Style CSS
├── public/                # Pliki statyczne
├── backend/               # Konfiguracja backend
├── server.js              # Serwer Express.js
├── database.db            # Baza danych SQLite
└── package.json           # Zależności projektu
```

## Jak uruchomić

- Dev (backend + frontend):
  - `npm run dev`
  - Backend: `http://localhost:3000`
  - Frontend: `http://localhost:3001`
- Tylko backend: `npm run server`
- Tylko frontend: `npm start`
- Build produkcyjny: `npm run build` (wynik w katalogu `build/`)
- Uwaga: frontend korzysta z portu `3001` (ustawiony w skrypcie `start`). Jeśli port jest zajęty, zwolnij go lub zmień port.

## Funkcjonalności

### Konfiguracja aplikacji
- Pionowe zakładki z lewym panelem nawigacyjnym i treścią po prawej
- Sticky lewy panel na wysokich ekranach
- Dynamiczny nagłówek sekcji po prawej (ikona + nazwa aktywnej zakładki)
- Spójne style i placeholdery w modalach, poprawki dark mode

### Dashboard
- Przegląd statystyk narzędzi i pracowników
- Szybkie wyszukiwanie
- Historia ostatnich aktywności

### Zarządzanie narzędziami
- Dodawanie nowych narzędzi
- Edycja istniejących narzędzi
- Śledzenie statusu (dostępne/wypożyczone)
- Historia wypożyczeń

### Zarządzanie pracownikami
- Rejestracja nowych pracowników
- Zarządzanie działami i pozycjami
- Przypisywanie uprawnień

### System wypożyczeń
- Wypożyczanie narzędzi pracownikom
- Zwracanie narzędzi
- Historia wypożyczeń

## Licencja

Projekt jest licencjonowany na zasadach MIT. Szczegóły licencji znajdziesz w pliku [license.md](license.md).

## Changelog

Zmiany wersji są opisane w pliku [CHANGELOG.md](CHANGELOG.md). Zobacz wydanie [1.1.0](https://github.com/RexEtImperator/system-zarzadzania-narzedziownia/releases/tag/1.1.0).

## Autor
dbrzezinsky

## Wersja
System Zarządzania Narzędziownią - wersja 1.1.0
