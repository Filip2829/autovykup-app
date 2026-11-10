# Fotostudio – první verze

Detail vozu → Příprava inzerce → Fotostudio. Nahrajte JPG/PNG/WebP jednoho pohledu, vyberte bílé nebo šedé studio. Po uploadu běží postupně AI úpravy přes přihlášenou Supabase funkci `vehicle-photo-studio`. Originály, výstupy a schválení zůstávají v existujícím bucketu `car-photos`, prefix `photo-studio/{carId}-{uuid}-`. Existující mazání vozu tento prefix zahrnuje. Není potřeba SQL ani změna policies.

Přístup k operacím vyžaduje platného uživatele a členství v `valuation_staff`. Klíč `OPENAI_API_KEY` je pouze v backendu. Model `gpt-image-1.5`, vysoká věrnost vstupu, JPG 1536×1024, kvalita medium. Při chybě zůstává originál a lze opakovat úpravu. Výstup je AI rekonstrukce: věrnost vozu nelze garantovat a před exportem je nutná kontrola. Fotky jsou ve stejném veřejném bucketu jako dosavadní fotodokumentace, nejsou soukromé.

ZIP obsahuje pouze ručně schválené fotky, názvy jsou očíslované podle aktuálního pořadí. Pořadí šipek se neukládá; po načtení se vrátí pořadí nahrání. ZIP uživatel rozbalí a JPG nahraje na portál. Přímé publikování na portály není součástí verze. Chybějící úhly se nefabrikují; volba pohledu je ruční. Interiér a detaily zachovávají scénu. Rozměry jsou obecný export, nikoli záruka aktuálních limitů konkrétního portálu.

## Ověření

- `node --test src/photoStudio/photoStudio.test.js`: formáty, evidence, ZIP CRC a adresář, autorizace, celý cyklus s mock AI/storage, opakování bez další platby, chyba a zachování originálu.
- `npx eslint src/photoStudio src/components/VehicleAdvertisingPrep.jsx` a produkční build.
- Ručně: přihlásit se jako pracovník; otevřít vůz a Přípravu inzerce; nahrát jeden exteriér; počkat na AI; přepnout originály; porovnat lak, SPZ, výbavu a vady; schválit; obnovit seznam i stránku; schválení i fotky zůstávají.
- Nahrát interiér/detail: zachová se prostředí. Neplatný formát a >12 MB se odmítne.
- Seřadit šipkami a stáhnout ZIP; zkontrolovat názvy, pořadí, JPEG a že neschválené nejsou zahrnuté.
- Mobil 390 px: ovládání v jednom sloupci, nahrávání z telefonu, žádný horizontální posuv.
- Při nedostupném AI ověřit zprávu a opakování. Nezavřený panel udržuje frontu; po odchodu se dokončí aktuální serverová operace, další nezačnou. Obnovit seznam pro výsledek.

## Omezení

Vyžaduje přístup projektu OpenAI k obrazovému modelu a kredit. Reálný placený převod musí být ověřen fotografií uživatele. Zámek proti souběžné úpravě se uklízí v `finally`; tvrdé ukončení běhu může vyžadovat správce k odstranění příslušného `-lock` objektu. Limit 40 fotek na vůz. Neobsahuje mazání jednotlivých snímků a přesun fotek ze stávající galerie.
