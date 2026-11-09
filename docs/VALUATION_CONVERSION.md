# Přenos zákaznické poptávky do evidence

Akce „Převést do evidence AutoVýkup“ v poptávkách nacenění vytváří kartu pomocí stávající transakční funkce `valuation_action`. Produkční Edge Function `online-valuation-intake` následně dokončuje přenos přes `valuationConversion.js`. Změna nevyžaduje nové tabulky, sloupce ani SQL migraci.

## Rozdělení údajů

- Základní identifikace, rok a nájezd: pole vozidla ze stávajícího převodu.
- Značka, model, palivo, motorizace, převodovka, pohon a rok první registrace: technické parametry.
- Celé zadané jméno, telefon, e-mail a preferovaný kontakt: zákaznické údaje. Formulář má jediné pole jména; nepředstíráme rozlišení křestního jména a příjmení.
- Odpovědi zákazníka, výbava, servisní historie, doplněné informace a souhlasy: čitelný souhrn v poznámkách. Kompletní původní data jsou zachována v `technical_params.onlineValuation`.
- Interní poznámky: poznámky k vozidlu se jménem autora a časem. Interní komentář a všechny ceny jsou zahrnuté také do souhrnu nacenění.
- Výkupní odhad a schválená cena včetně obou hranic, prodejní odhad a představa zákazníka: cenová pole karty. Kompletní nacenění včetně nákladů na přípravu zůstává v `technical_params.onlineValuationPricing`.
- Popis poškození, závad a havárie: odpovídající textová pole poškození. Náklady na přípravu: odhad nákladů na opravu a souhrn původního nacenění.
- Fotografie vozu včetně snímků poškození: běžné `cars.photos` a stávající bucket `car-photos`.
- Přední a zadní strana TP: soukromý bucket `vehicle-documents`, záznamy v `vehicle_documents`, kategorie „Technický průkaz“. TP se nekopíruje do veřejné galerie vozidla.

## Ukládání a opakování

Před převodem se musí uložit rozepsané ceny, poznámka, stav a přiřazení. Tlačítko při neuložených změnách nelze použít. Server ověří oprávnění pracovníka, produkční rozsah poptávky a aktuální revizi. Testovací a neodeslané poptávky se nepřevádějí.

Při chybě může již existovat karta nebo část souborů. Původní podklady zůstávají zachované. Po obnovení detailu lze použít „Dokončit přenos podkladů“; stejná karta a deterministické identifikátory souborů a dokumentů zabrání duplicitám. Existující soubor musí mít shodný obsah. Přenos je dokončený až po uložení všech údajů a značky `technical_params.onlineValuationTransfer`.

U dříve převedených karet se doplní fotografie, dokumenty, poznámky a chybějící údaje. Již vyplněné údaje a ceny se nepřepisují. Při souběžné úpravě karty kolegou se zápis zopakuje nad aktuální verzí; při dalším konfliktu se zobrazí chyba. Dokončený přenos je jednorázový snímek poptávky, nikoliv průběžná synchronizace pozdějších změn.

## Ověření

Automatické testy: `npm.cmd run test:valuation`; širší regrese: `npm.cmd test`; produkční sestavení: `npm.cmd run build`.

Ruční checklist pro skutečný obchodní případ:

1. Přihlásit se účtem s přístupem k poptávkám a otevřít skutečnou zpracovanou poptávku.
2. Uložit nacenění a interní poznámky. Ověřit, že rozepsané změny převod blokují.
3. Potvrdit převod a otevřít vzniklou kartu v evidenci.
4. Zkontrolovat zákazníka, technické údaje, odpovědi a interní poznámky, ceny i jejich rozmezí.
5. Ve fotografiích ověřit snímky vozu; v dokumentech otevřít obě dostupné strany TP.
6. Obnovit stránku a ověřit trvalé uložení. Při opakovaném dokončení nevzniká další vůz, fotografie ani dokument.
7. Ověřit dostupnost tlačítka a čitelnost souhrnů na mobilní šířce.

Automatické testy používají izolovaného klienta se simulací Storage a databáze, včetně výpadku a souběžné úpravy. Nevytvářejí fiktivní zákaznické vozy v produkci.
