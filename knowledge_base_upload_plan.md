# Plan wdrożenia obsługi załączników jako bazy wiedzy

## Cel
Zastąpić sztywne ładowanie pliku `Analiza_rynku_Ebook_Copywriting.pdf` mechanizmem pozwalającym użytkownikowi dodać do pięciu własnych materiałów referencyjnych (`pdf`, `md`, `doc`, `txt`), które zostaną włączone do kontekstu pracy modelu przy generowaniu ebooka. System ma bronić się przed przepełnieniem kontekstu dzięki ograniczeniu łącznej liczby znaków oraz czytelnemu komunikowaniu limitów.

## Założenia
- Obsługa załączników dostępna bez przeładowania strony, przy pomocy FileReader API w przeglądarce.
- Każdy plik po wczytaniu trafia do historii rozmowy jako wiadomość systemowa (niewidoczna treść, informacja o załączniku w UI).
- Limit: maksymalnie 5 plików, łączna suma rozmiaru tekstu w kontekście nie przekracza ustalonego bufora (np. 60 000 znaków).
- W przypadku przekroczenia limitu użytkownik otrzymuje komunikat i plik nie jest dodawany.
- Mechanizm można łatwo rozszerzyć na dodatkowe formaty w przyszłości.

## Taski
1. **Refaktoryzacja inicjalizacji bazy wiedzy**  
   - usunąć logikę ładowania stałego pliku PDF z `knowledge_base/Analiza_rynku_Ebook_Copywriting.pdf`, w tym wywołania `loadKnowledgeBase()` i powiązane komunikaty błędów.
   - uprościć strukturę stanu `knowledgeBase` tak, aby początkowo odzwierciedlała brak załączników.

2. **Dodanie interfejsu wgrywania plików**  
   - w `enigma_ebook.html` dodać ukryty `<input type="file" multiple>` z akceptowanymi rozszerzeniami `.pdf,.md,.doc,.docx,.txt` oraz przycisk aktywujący okno wyboru.
   - wyświetlać listę załączonych plików z możliwością podglądu nazwy i usunięcia z kolejki.
   - zadbać o responsywność przy małych rozdzielczościach.

3. **Odczyt i konwersja treści**  
   - wykorzystać `FileReader` do pozyskania zawartości, konwertując PDF do tekstu (np. przy użyciu `pdf.js`) i dokumenty `doc/docx` poprzez bibliotekę typu `mammoth.js` lub fallback na informację o nieobsługiwanym formacie.
   - dla `md` i `txt` czytać zawartość jako tekst.
   - po konwersji walidować długość i aktualizować licznik wykorzystania limitu.

4. **Integracja z przebiegiem rozmowy**  
   - w API komunikacji z modelem dodać agregowanie tekstów załączników do wiadomości systemowych przekazywanych przed promptem użytkownika.
   - w UI czatu dodawać informacyjną kartę „Załączono plik …” bez pełnej treści.

5. **Obsługa limitów i błędów**  
   - zdefiniować stałe limitów (max plików, max łącznej długości tekstu, opcjonalnie max rozmiar pojedynczego pliku).
   - przy przekroczeniach prezentować przyjazne komunikaty i odrzucać pliki.
   - rejestrować błędy parsowania i informować użytkownika o niepowodzeniu konwersji.

6. **Czyszczenie stanu przy restarcie sesji**  
   - upewnić się, że przycisk resetu/nowej sesji usuwa wszystkie załączniki z kontekstu oraz UI.

## Ryzyka i mitigacje
- **Duże pliki PDF/Doc** – konwersja może być ciężka i przekraczać limit; wymagane przycinanie do wycinków lub ostrzeżenie.  
  _Mitigacja_: wprowadzenie limitu znaków z wyraźnym komunikatem oraz opcjonalne skracanie treści.
- **Brak wsparcia dla `doc/docx` bez biblioteki** – konieczna dodatkowa zależność lub fallback.  
  _Mitigacja_: jeśli w ramach implementacji nie uda się dodać biblioteki, należy przygotować ścieżkę komunikatu „format nieobsługiwany” i zasugerować konwersję do PDF/MD/TXT.
- **Złożoność UI** – integracja z istniejącym panelem może wprowadzić konflikty.  
  _Mitigacja_: zaplanowanie niezależnej sekcji UI z modułową logiką JS.

## Kryteria akceptacji
- Brak automatycznych prób wczytywania `Analiza_rynku_Ebook_Copywriting.pdf` po uruchomieniu aplikacji.
- Użytkownik może dodać maksymalnie 5 załączników, a UI pokazuje ich status i pozwala usuwać.
- Treść zaakceptowanych plików trafia do kontekstu rozmowy (widoczna w logu wiadomości systemowych lub w narzędziu debugującym).
- Przy przekroczeniu limitów aplikacja odmawia dodania pliku i informuje użytkownika o przyczynie.
- Reset sesji usuwa wszystkie dotychczasowe załączniki z kontekstu oraz UI.

Proszę o akceptację planu przed rozpoczęciem implementacji.
