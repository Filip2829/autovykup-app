# Mobilní výkup – rozpracováno, pokračování na jiném počítači

> Aktualizace 9. 11. 2026: původní rozpracovaný základ byl dokončen do první použitelné verze v hlavní větvi. Aktuální postup, omezení a ověření jsou v [Mobilním nacenění](MOBILE_INSPECTION.md). Následující text zachovává historický stav ze 6. 11. 2026.

Stav k 6. 11. 2026: uživatel potřeboval práci přerušit před odchodem z práce. Vývoj je zastavený; tento checkpoint je uložený na větvi `codex/mobile-inspection-wip`. Nic z tohoto modulu ještě není nasazeno do produkce.

## Zadání a potvrzená rozhodnutí

- Samostatný testovací modul, vlastní vstup z rozcestníku, původní přidání výkupu zachovat.
- Jeden jednoduchý scrollovací formulář použitelný při fyzické kontrole na telefonu.
- Postup: základní údaje z TP → vyfocení TP → fotografie vozu → načtení technických parametrů z registru → fotografie poškození s místem a popisem → poznámky → nacenění.
- Uživatel výslovně zvolil: **vůz se automaticky objeví v aktuální evidenci hned po prvním uložení základních údajů**. Všechny další kroky upravují stejnou kartu, žádné závěrečné kopírování ani druhá tabulka.
- Uživatel dříve dal trvalý souhlas s automatickým nasazováním dokončených a ověřených požadovaných změn. Nedokončený modul se nenasazuje.

## Co je připravené

- `src/mobileInspection/inspectionModel.js`: formulář, mapování existujících sloupců, validace identity/cen, kontrola změn stejných polí kolegou, tvorba nové karty ve stavu `valuation`, vstup pro stávající tržní nacenění.
- `src/mobileInspection/inspectionService.js`: načtení rozpracovaných prohlídek, založení karty se značkou `technical_params.mobileInspection.version = 1`, kontrola duplicit VIN/SPZ, opakování vytvoření se stejným klíčem, ukládání změněných polí s kontrolou `updated_at`, poznámky, upload fotografií, podepsané odkazy na TP, napojení na stávající registr a čtení TP, doplnění prázdných údajů, stávající tržní nacenění a společná historie výsledků, dokončení prohlídky.
- `src/mobileInspection/preparePhoto.js`: zmenšení fotografií na telefonu, zachování originálu, když převod není podporovaný nebo by soubor zvětšil.
- TP se ukládá do existujícího **soukromého** bucketu `vehicle-documents` a tabulky `vehicle_documents` (cesta `carId/uuid.ext`, kategorie `Jiný dokument`, název začíná `Technický průkaz`).
- Fotografie vozu i poškození používají existující `car-photos`, cestu `vehicle-photos/carId-kind-uuid.ext` a standardní `cars.photos`. Popis poškození se navíc zapisuje do stávajících polí `damage_report` a `inspectionPhotos`.
- Není navržena žádná změna DB schématu, nová oprávnění ani nová Edge Function.

## Zbývá udělat

1. Dopsat React UI a CSS. Plán: `MobileInspection.jsx`, oddělené přehledné sekce / mediální vstupy, nadpis „Mobilní výkup · TEST“, vysvětlení automatického vytvoření v evidenci, velká tlačítka fotoaparátu a galerie, sticky ukládání, rozpracované prohlídky k opětovnému otevření.
2. Rozpracované texty chránit před ztrátou: viditelný stav uložení, zachování při chybě, případně per-user/per-car lokální draft, zákaz dvojího založení během ukládání. Selhané uploady musí jít zopakovat bez opakování již úspěšných souborů.
3. Nechat uživatele zkontrolovat návrh údajů z TP/registru před přijetím. Stávající ručně vyplněné údaje automaticky nepřepisovat. Doplnit možnost ruční úpravy podstatných technických parametrů.
4. Pro nacenění použít stejné existující služby a bezpečnostní filtrování trhu. Výsledek nejdřív zobrazit, ceny do formuláře převzít až explicitním tlačítkem. Ukládání skutečných cen zůstává na `cars`.
5. Integrovat do **aktuálního** `src/App.jsx` z hlavní větve: samostatná položka rozcestníku a view; callback aktualizuje `cars`, detail a stávající `synchronizeVehicleMatches`. Doporučený přímý vstup je query parametr `?mobile-inspection=1` (chráněný stávajícím přihlášením).
6. Napsat smysluplné testy modelu a služby: duplicitní VIN/SPZ, opakované vytvoření po chybě sítě, zachování poznámek a ostatních polí, konflikt kolegy, chyby uploadů a úklid pouze nového souboru, nacenění, limity souborů.
7. Ověřit UI v prohlížeči na mobilní šířce a celý tok přes mock bez vytváření fiktivních produkčních vozů. Udělat build, lint změněných souborů a ruční checklist. Až poté nasadit hotový samostatný modul.

## Důležité pro pokračování

- Tato větev vychází z aktuální produkce, ne ze starého lokálního HEAD pracovního PC. Před pokračováním ji načíst z GitHubu a pracovat nad ní.
- Pracovní PC mělo mnoho starších rozpracovaných změn, které nebyly součástí tohoto úkolu; byly ponechány beze změny. Necommitovat je do mobilního modulu.
- Nová služba importuje existující `src/services/priceRecommendationCore.js` a `priceRecommendationSnapshots.js` – obě jsou již v produkční větvi. Na pracovním PC byly pro lokální vývoj načteny jejich přesné existující verze; není potřeba je duplikovat ani měnit.
- Produkční Supabase projekt: `mncpsdrckkgkujatvlwb`; Vercel projekt: `autovykup-app`; repozitář: `Filip2829/autovykup-app`.
- V této fázi proběhla jen syntax kontrola a lint těchto tří nových JS souborů. Testy funkčnosti a UI ještě hotové nejsou. Modul je rozpracovaný, nepovažovat ho za připravený k nasazení.

Na notebooku lze napsat: „Pokračuj v mobilním výkupu z větve codex/mobile-inspection-wip. Nejdřív si přečti docs/MOBILE_INSPECTION_CHECKPOINT.md.“
