# Plan prac nad Enigma E-Book Builder

- [x] Zadanie 1: Rozbudowa mechanizmu reasoning i pamięci między rozdziałami.
- [x] Zadanie 2: Aktualizacja interfejsu zarządzania rozdziałami (usunięcie przycisku akceptacji, nadpisywanie, usuwanie).
- [x] Zadanie 3: Rozszerzenie backendu o operacje usuwania plików rozdziałów i reasoning.

## Podsumowanie wykonanych prac
- Przebudowano front-end tak, aby każdy rozdział był zapisywany i prezentowany z dedykowanym podglądem reasoning oraz kontrolkami zapisu lub poprawy.
- Dodano panel zarządzania zaakceptowanymi rozdziałami, umożliwiający ich ponowną generację lub całkowite usunięcie wraz z powiązanymi plikami reasoning.
- Backend wspiera teraz zapisywanie, usuwanie i scalanie plików w ramach odseparowanych sesji, co pozwala na budowanie finalnego ebooka dopiero po akceptacji wszystkich części.

## Kolejne kroki
- Zaimplementować integrację z bazą wiedzy (pliki referencyjne) tak, aby przed generacją rozdziałów model mógł automatycznie włączać odnalezione materiały pomocnicze.
- Rozszerzyć testy end-to-end, aby zweryfikować przepływ akceptacji, nadpisywania i usuwania rozdziałów w przeglądarce oraz poprawną obsługę błędów sieciowych.
