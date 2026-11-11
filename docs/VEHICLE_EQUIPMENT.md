# Výbava vozu

Katalog v `src/utils/vehicleEquipment.js` vychází ze tří snímků průvodce výbavou dodaných uživatelem. Zobrazuje pouze tyto položky v kategoriích. Ekvivalentní názvy navigace, ESP/ESC, ASR/ASC, kamer a dalších položek se převádějí na společný klíč, takže se neduplikují ani na prodejní kartě. Samostatné funkce (např. přední/zadní senzory) zůstávají oddělené. Zaškrtnutí ze snímků nejsou automaticky přebírána jako výbava jednotlivých vozidel.

Samostatná pole se ukládají přes existující `updateCar` do JSON `technical_params.equipmentDetails`: `twoKeys` a `secondWheelSet` (`yes`, `no`, prázdné), `warrantyUntil` (ISO datum), `warrantyKm` a `notes`. Dva klíče se synchronizují také s dosavadním checklistem. SQL ani změna databázového schématu nejsou potřeba.

Záruka z nových polí má přednost před starším textem záruky a promítá se do profilu i prodejní karty. Klíče, kola, záruku a rozpoznané skutečnosti z poznámek používá také stručný text inzerce. Výslovné „Ne“ u klíčů a kol má přednost před staršími poznámkami.

## Kontrola

1. Otevřít Výbavu vozu; vyhledat navigaci a ověřit jednu společnou volbu. Změnit zaškrtnutí a znovu načíst kartu.
2. Vyplnit klíče, druhou sadu kol, datum a nájezd záruky i poznámku. Obnovit kartu a zkontrolovat hodnoty. Změny používají stávající průběžné ukládání.
3. Vygenerovat inzerát: jeden řádek s čárkami a aktuálními údaji; volba „Ne“ nesmí převzít opačné tvrzení ze starší poznámky. Zkontrolovat záruku na prodejní kartě.
4. Na telefonu (šířka 390 px) ověřit ovládání polí, vyhledávání a checkboxů bez vodorovného posuvu.

Automaticky ověřeno: 222 stávajících testů, 9 testů katalogu/inzerce, lint změněných modulů a izolovaný produkční build. Formulář ověřen v prohlížeči na desktopu a při šířce 390 px, včetně změny data nativním ovládáním, výběru klíčů/kol a filtrování. Datový test ověřuje průchod přes stávající JSON tvar; při browser testu se nepřepisovala skutečná produkční karta.
