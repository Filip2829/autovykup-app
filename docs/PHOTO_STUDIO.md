# Fotostudio – první verze

Detail vozu → Příprava inzerce → Fotostudio. Nahrajte JPG/PNG/WebP jednoho pohledu, vyberte jedno ze čtyř pozadí Opportunity nebo bílé/šedé neutrální studio. Po uploadu běží postupně AI úpravy přes přihlášenou Supabase funkci `vehicle-photo-studio`. Originály, výstupy a schválení zůstávají v existujícím bucketu `car-photos`, prefix `photo-studio/{carId}-{uuid}-`. Existující mazání vozu tento prefix zahrnuje. Není potřeba SQL ani změna policies.

Přístup k operacím vyžaduje platného uživatele a členství v `valuation_staff`. Klíč `OPENAI_API_KEY` je pouze v backendu. Model `gpt-image-1.5`, vysoká věrnost vstupu, JPG 1536×1024, kvalita medium. Při chybě zůstává originál a lze opakovat úpravu. Výstup je AI rekonstrukce: věrnost vozu nelze garantovat a před exportem je nutná kontrola. Fotky jsou ve stejném veřejném bucketu jako dosavadní fotodokumentace, nejsou soukromé.

ZIP obsahuje pouze ručně schválené fotky, názvy jsou očíslované podle aktuálního pořadí. Pořadí šipek se neukládá; po načtení se vrátí pořadí nahrání. ZIP uživatel rozbalí a JPG nahraje na portál. Přímé publikování na portály není součástí verze. Chybějící úhly se nefabrikují; volba pohledu je ruční. Interiér a detaily zachovávají scénu. Rozměry jsou obecný export, nikoli záruka aktuálních limitů konkrétního portálu.

## Pozadí Opportunity a SPZ

Předlohy jsou v `public/photo-studio/opportunity-{white,graphite,showroom,concrete}.png`. Náhledové karty i backend používají stejné soubory. Pro exteriér backend připojí vybranou předlohu jako druhý obrázek k AI úpravě; pro interiér/detail ji neposílá. Cesty jsou pevně povolené v modelu a backend nikdy nestahuje URL zadané uživatelem. Logo a prostor mohou být při AI kompozici mírně odlišné. Volba platí pro nově nahrávané fotky, nemění hotové výstupy.

Po úpravě `gpt-4o-mini` navrhne čtyři vnější rohy každé SPZ v normalizovaných souřadnicích. Selhání/nejistota nesmí automaticky povolit export. Uživatel otevře kontrolu SPZ, opraví případné rohy (zvětšení 1×/2×/4×), případně výslovně potvrdí, že SPZ není viditelná. Geometrie se ukládá do manifestu. Změna rohů ruší předchozí schválení. Backend zamítne schválení bez potvrzené kontroly SPZ, frontend odmítne takové snímky exportovat; platí i pro starší výstupy.

Překryv používá originální obrázek loga dodaný uživatelem (`public/photo-studio/opportunity-logo.png`), žádné AI vykreslování nápisu. Neprůhledný tmavý podklad s logem se projektivně transformuje podle čtyř rohů značky; stejný kód slouží náhledu a JPG exportu. Export po překrytí má JPEG kvalitu 95 %. Originál a základní AI výstup zůstávají beze změn ve veřejném úložišti; tato funkce zakrývá SPZ v náhledech výsledku a exportu, není anonymizací originálů v úložišti. Přesnost automatického rozpoznání není garantována, proto je kontrola povinná.

Další ruční kontrola: vybrat každé ze 4 pozadí a ověřit náhled i označení, přepnout na neutrální bez loga; u exteriéru zkontrolovat vybranou předlohu. U přední/zadní a šikmé SPZ zkontrolovat logo včetně modrého pruhu, upravit čtyři rohy, uložit a obnovit stránku. Bez kontroly musí být schválení zakázané. Po opravě musí zmizet schválení. Stáhnout ZIP a ověřit fyzicky zakryté značky v JPG; přepnutí na originály musí dál ukazovat původní snímky. Ověřit i neviditelnou SPZ, více značek a mobilní zvětšení.

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
