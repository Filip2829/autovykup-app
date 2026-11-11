# Výbava vozu

Katalog v `src/utils/vehicleEquipment.js` vychází ze tří snímků průvodce výbavou dodaných uživatelem. Zobrazuje pouze tyto položky v kategoriích. Ekvivalentní názvy navigace, ESP/ESC, ASR/ASC, kamer a dalších položek se převádějí na společný klíč, takže se neduplikují ani na prodejní kartě. Samostatné funkce (např. přední/zadní senzory) zůstávají oddělené. Zaškrtnutí ze snímků nejsou automaticky přebírána jako výbava jednotlivých vozidel.

Samostatná pole se ukládají přes existující `updateCar` do JSON `technical_params.equipmentDetails`: `twoKeys` a `secondWheelSet` (`yes`, `no`, prázdné), `warrantyUntil` (ISO datum), `warrantyKm` a `notes`. Dva klíče se synchronizují také s dosavadním checklistem. SQL ani změna databázového schématu nejsou potřeba.

Záruka z nových polí má přednost před starším textem záruky a promítá se do profilu i prodejní karty. Klíče, kola, záruku a rozpoznané skutečnosti z poznámek používá také stručný text inzerce. Výslovné „Ne“ u klíčů a kol má přednost před staršími poznámkami.

## Tlačítko doplnění z CEBIA

„Automaticky doplnit výbavu z CEBIA“ spustí analýzu pouze po kliknutí u otevřeného vozu. Používá stávající funkci `analyze-vehicle-technical-data` a předává pouze identifikaci vozu a přiložené CEBIA dokumenty (starší `cebiaFiles` a dokumenty kategorie CEBIA). Neanalyzuje automaticky ostatní vozy, fotky ani jiné dokumenty. Bez CEBIA zobrazí výzvu k nahrání.

Přidává jen odpovídající položky katalogu s důkazem zdroje `cebia` a jistotou alespoň 0,7; nespoléhá na pouhý seznam bez důkazů. Zachovává ručně vyplněnou i výslovně odškrtnutou výbavu, záruku, klíče, kola a poznámky. Během analýzy je formulář uzamčený; odchod z modulu zruší následné použití výsledku. Neprovádí změny technických údajů nebo historie z odpovědi analýzy. Nevyžaduje SQL ani novou Edge Function.

Ověření tlačítka: 4 testy s napodobenou odpovědí služby, lint, build a browser kontrola zobrazení bez kliknutí. Žádný skutečný CEBIA report ani skutečná karta nebyly v rámci úpravy analyzovány nebo doplněny. Ruční kontrola po výslovném spuštění uživatelem: načíst CEBIA, zkontrolovat počet doplněných položek, obnovení karty a zachování ostatních údajů; bez reportu musí zůstat výbava beze změny.

## Kontrola

1. Otevřít Výbavu vozu; vyhledat navigaci a ověřit jednu společnou volbu. Změnit zaškrtnutí a znovu načíst kartu.
2. Vyplnit klíče, druhou sadu kol, datum a nájezd záruky i poznámku. Obnovit kartu a zkontrolovat hodnoty. Změny používají stávající průběžné ukládání.
3. Vygenerovat inzerát: jeden řádek s čárkami a aktuálními údaji; volba „Ne“ nesmí převzít opačné tvrzení ze starší poznámky. Zkontrolovat záruku na prodejní kartě.
4. Na telefonu (šířka 390 px) ověřit ovládání polí, vyhledávání a checkboxů bez vodorovného posuvu.

Automaticky ověřeno: 222 stávajících testů, 9 testů katalogu/inzerce, lint změněných modulů a izolovaný produkční build. Formulář ověřen v prohlížeči na desktopu a při šířce 390 px, včetně změny data nativním ovládáním, výběru klíčů/kol a filtrování. Datový test ověřuje průchod přes stávající JSON tvar; při browser testu se nepřepisovala skutečná produkční karta.
