# System Zarządzania Narzędziownią

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

## Funkcjonalności

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

## Autor
dbrzezinsky

## Wersja
System Zarządzania Narzędziownią - wersja 1.0
