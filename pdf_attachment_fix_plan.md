# Plan wdrożenia poprawki obsługi załączników PDF

## Zakres
Eliminacja błędu pojawiającego się przy przetwarzaniu plików PDF, gdy biblioteka `pdf.js` nie zostanie pobrana z CDN, poprzez zapewnienie lokalnego fallbacku oraz bezpiecznej obsługi błędów podczas ekstrakcji tekstu.

## Zadania
- [x] Dodać lokalny fallback dla pdf.js (lekki ekstraktor tekstu), który działa offline oraz nie wymaga dodatkowego workera.
- [x] Ujednolicić inicjalizację runtime’u PDF (wykrywanie dostępności CDN, fallbacku i obsługa błędów).
- [x] Zaktualizować logikę ekstrakcji tekstu z PDF tak, by wykorzystywała nowy fallback i raportowała błędy w przyjazny sposób.
- [x] Utrzymać dotychczasowy pipeline dla pozostałych formatów oraz zweryfikować poprawność pliku HTML.

## Ryzyka i mitigacje
- **Niepełne wsparcie PDF** – fallback bazuje na prostym ekstraktorze tekstu i może pominąć nietypowe konstrukcje (np. silnie niestandardowe fonty). Mitigacja: zachowanie próby użycia pełnego `pdf.js` oraz jasne komunikaty o błędach.
- **Brak wsparcia `DecompressionStream`** – przeglądarki bez API dekompresji nie odczytają strumieni `Flate`. Mitigacja: komunikat błędu zachęcający do dołączenia pełnej biblioteki.

## Testy
- [x] `php -l enigma_ebook.html`
