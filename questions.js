/* Baza pytań teleturnieju Milion. Na razie po 2 pytania testowe na każdy z 12 poziomów; właściwą bazę dopiszemy później.
   Format: { id, lvl: 1..12, q: 'treść', a: ['A', 'B', 'C', 'D'], ok: indeks poprawnej (0..3) }.
   Kolejność odpowiedzi jest tasowana przy losowaniu, więc `ok` może zawsze wskazywać np. pierwszą. id muszą być unikalne. */
window.ML_QUESTIONS = [
  { id: 'p1a', lvl: 1, q: 'Ile nóg ma pająk?', a: ['6', '8', '10', '4'], ok: 1 },
  { id: 'p1b', lvl: 1, q: 'Która z tych miejscowości jest stolicą Polski?', a: ['Kraków', 'Warszawa', 'Gdańsk', 'Poznań'], ok: 1 },
  { id: 'p2a', lvl: 2, q: 'Ile dni ma rok przestępny?', a: ['365', '366', '364', '360'], ok: 1 },
  { id: 'p2b', lvl: 2, q: 'Które z tych zwierząt jest ssakiem?', a: ['Rekin', 'Delfin', 'Pingwin', 'Krokodyl'], ok: 1 },
  { id: 'p3a', lvl: 3, q: 'Z ilu województw składa się Polska?', a: ['14', '15', '16', '18'], ok: 2 },
  { id: 'p3b', lvl: 3, q: 'Jaki gaz rośliny pobierają z powietrza podczas fotosyntezy?', a: ['Tlen', 'Azot', 'Dwutlenek węgla', 'Hel'], ok: 2 },
  { id: 'p4a', lvl: 4, q: 'Kto napisał „Pana Tadeusza”?', a: ['Juliusz Słowacki', 'Adam Mickiewicz', 'Henryk Sienkiewicz', 'Bolesław Prus'], ok: 1 },
  { id: 'p4b', lvl: 4, q: 'Która rzeka jest najdłuższa w Polsce?', a: ['Odra', 'Warta', 'Wisła', 'Bug'], ok: 2 },
  { id: 'p5a', lvl: 5, q: 'W którym roku Polska wstąpiła do Unii Europejskiej?', a: ['1999', '2004', '2007', '2001'], ok: 1 },
  { id: 'p5b', lvl: 5, q: 'Który pierwiastek ma symbol chemiczny Fe?', a: ['Fluor', 'Żelazo', 'Fosfor', 'Ferm'], ok: 1 },
  { id: 'p6a', lvl: 6, q: 'Ile wynosi suma kątów wewnętrznych trójkąta?', a: ['90°', '180°', '270°', '360°'], ok: 1 },
  { id: 'p6b', lvl: 6, q: 'Która planeta jest najbliżej Słońca?', a: ['Wenus', 'Mars', 'Merkury', 'Ziemia'], ok: 2 },
  { id: 'p7a', lvl: 7, q: 'Kto namalował „Bitwę pod Grunwaldem”?', a: ['Jan Matejko', 'Józef Chełmoński', 'Stanisław Wyspiański', 'Jacek Malczewski'], ok: 0 },
  { id: 'p7b', lvl: 7, q: 'Który szczyt jest najwyższy w całych Tatrach?', a: ['Rysy', 'Gerlach', 'Lodowy Szczyt', 'Krywań'], ok: 1 },
  { id: 'p8a', lvl: 8, q: 'W którym roku Jan III Sobieski pokonał Turków pod Wiedniem?', a: ['1683', '1610', '1655', '1701'], ok: 0 },
  { id: 'p8b', lvl: 8, q: 'Ile kości ma szkielet dorosłego człowieka?', a: ['186', '206', '226', '256'], ok: 1 },
  { id: 'p9a', lvl: 9, q: 'Jakie miasto jest stolicą Australii?', a: ['Sydney', 'Melbourne', 'Canberra', 'Perth'], ok: 2 },
  { id: 'p9b', lvl: 9, q: 'Kto skomponował cykl koncertów „Cztery pory roku”?', a: ['Jan Sebastian Bach', 'Antonio Vivaldi', 'Wolfgang Amadeus Mozart', 'Joseph Haydn'], ok: 1 },
  { id: 'p10a', lvl: 10, q: 'Kto był pierwszym koronowanym królem Polski?', a: ['Mieszko I', 'Bolesław Chrobry', 'Kazimierz Wielki', 'Władysław Łokietek'], ok: 1 },
  { id: 'p10b', lvl: 10, q: 'Jak nazywa się najmniejsza kość w ciele człowieka?', a: ['Kowadełko', 'Strzemiączko', 'Młoteczek', 'Kość grochowata'], ok: 1 },
  { id: 'p11a', lvl: 11, q: 'Który pierwiastek ma liczbę atomową 79?', a: ['Srebro', 'Platyna', 'Złoto', 'Rtęć'], ok: 2 },
  { id: 'p11b', lvl: 11, q: 'W którym roku wydano dzieło Kopernika „O obrotach sfer niebieskich”?', a: ['1543', '1514', '1569', '1492'], ok: 0 },
  { id: 'p12a', lvl: 12, q: 'Które państwo ma najwięcej stref czasowych (z terytoriami zamorskimi)?', a: ['Rosja', 'Stany Zjednoczone', 'Francja', 'Wielka Brytania'], ok: 2 },
  { id: 'p12b', lvl: 12, q: 'Ile w przybliżeniu wynosi stała Avogadra?', a: ['6,022 · 10²³ mol⁻¹', '3,141 · 10²³ mol⁻¹', '6,626 · 10⁻³⁴ mol⁻¹', '9,807 · 10²³ mol⁻¹'], ok: 0 },
];
