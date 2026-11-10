# Fotostudio – první verze

Detail vozu → Příprava inzerce → Fotostudio. Nahrajte JPG/PNG/WebP jednoho pohledu, vyberte jedno z pěti pozadí Opportunity nebo bílé/šedé neutrální studio. Po uploadu běží postupně AI úpravy přes přihlášenou Supabase funkci `vehicle-photo-studio`. Originály, výstupy a schválení zůstávají v existujícím bucketu `car-photos`, prefix `photo-studio/{carId}-{uuid}-`. Existující mazání vozu tento prefix zahrnuje. Není potřeba SQL ani změna policies.

Přístup k operacím vyžaduje platného uživatele a členství v `valuation_staff`. Klíč `OPENAI_API_KEY` je pouze v backendu. Model `gpt-image-1.5`, vysoká věrnost vstupu, JPG 1536×1024, kvalita medium. Při chybě zůstává originál a lze opakovat úpravu. Výstup je AI rekonstrukce: věrnost vozu nelze garantovat a před exportem je nutná kontrola. Fotky jsou ve stejném veřejném bucketu jako dosavadní fotodokumentace, nejsou soukromé.

ZIP obsahuje pouze ručně schválené fotky, názvy jsou očíslované podle aktuálního pořadí. Pořadí šipek se neukládá; po načtení se vrátí pořadí nahrání. ZIP uživatel rozbalí a JPG nahraje na portál. Přímé publikování na portály není součástí verze. Chybějící úhly se nefabrikují; volba pohledu je ruční. Interiér a detaily zachovávají scénu. Rozměry jsou obecný export, nikoli záruka aktuálních limitů konkrétního portálu.

## Pozadí Opportunity a SPZ

Předlohy jsou v `public/photo-studio/opportunity-{white,graphite,showroom,concrete}.png`. Náhledové karty i backend používají stejné soubory. Pro exteriér backend připojí vybranou předlohu jako druhý obrázek k AI úpravě; pro interiér/detail ji neposílá. Cesty jsou pevně povolené v modelu a backend nikdy nestahuje URL zadané uživatelem. Logo a prostor mohou být při AI kompozici mírně odlišné. Volba platí pro nově nahrávané fotky, nemění hotové výstupy.

Varianta „Opportunity Dílna“ (`public/photo-studio/opportunity-workshop.png`) vznikla v ImageGen odstraněním vozu a prvků galerie z uživatelova snímku dílny. Zachovává světlé panely, dlažbu, šedá žebrovaná vrata a rozostřený pravý průchod. Oblasti zakryté autem jsou rekonstrukce, nikoliv skutečná dokumentace prázdné dílny. AI instrukce pro tuto variantu výslovně zakazují přidávat ceduli či logo na stěnu; ostatní značkové varianty vlastní ceduli zachovávají. Přesné prompty jsou v `docs/photo-studio-background-prompts.json`.

Po úpravě `gpt-4.1` nejprve najde oblasti všech viditelných SPZ. Server pak vytvoří zvětšený kontextový výřez každé oblasti a model znovu určí skutečné čtyři rohy v souřadnicích výřezu. Teprve zpřesněné rohy se převedou do původního obrazu. Dodatečná kontrola obrazových bodů vyžaduje střídání světlého podkladu a tmavých znaků rozložené přes značku; odmítne hladký nárazník či přilehlé části vozu. Nejde o záruku detekce všech druhů značek: nejisté výsledky zůstávají blokované pro export.

Server vloží neprůhledné logo do pixelů JPG podle perspektivy značky (`jpeg-js` 0.4.4, `pngjs` 7.0.0; připnuté verze v import mapě Deno). Samotný původní nápis OPPORTUNITY bez podtitulu je vycentrovaný podle hran textu vodorovně i svisle. Stejná textura slouží serveru a prohlížeči. U nalezené značky ani při výsledku „žádná SPZ není vidět“ není potřeba samostatné potvrzení SPZ. Zůstává běžné schválení celé fotky před exportem. Selhání/nejistota rozpoznání nepovolí export; uživatel může opakovat automatické zaměření nebo opravit rohy ručně (zvětšení 1×/2×/4×). Geometrie se ukládá do manifestu. Úprava rohů vždy zruší předchozí schválení fotky.

Opravený postup má `maskVersion: 2`. Při otevření fotostudia se automaticky zpracují všechny hotové snímky se starší verzí: AI odhady se znovu zaměří, dříve ručně potvrzené rohy zůstanou zachované a přepočítá se pouze textura. Použije se `base.jpg` bez nového placeného generování vozu/pozadí. Backend ani frontend nepovolí export starého zaměření. Při odchodu z panelu se dokončí aktuální operace a další nezačnou. Neúspěšné rozpoznání již nese novou verzi a samo se při každém otevření neopakuje; lze je zopakovat tlačítkem.

Překryv používá originální obrázek loga dodaný uživatelem (`public/photo-studio/opportunity-logo.png`), žádné AI vykreslování nápisu. Neprůhledný tmavý podklad se projektivně transformuje podle čtyř rohů značky. `result.jpg` je již fyzicky zakrytý obrázek v kvalitě 95 %; náhled, přímý odkaz i ZIP používají tento soubor bez dalšího překreslování. Nezměněný AI základ se ukládá jako `base.jpg`, aby šla opravit poloha loga i obnovit neúspěšná operace bez dalšího placeného generování. Původní upload a základní AI výstup zůstávají ve veřejném bucketu; nejde o anonymizaci těchto zdrojových podkladů. U starších položek zůstává kompatibilní překrytí v prohlížeči; tlačítko „Zakryt SPZ automaticky“ je převede na uložený zakrytý JPG. Změna výsledku mění parametr verze URL, aby prohlížeč neukazoval starý soubor.

Další ruční kontrola: u nové přední/zadní a šikmé fotografie ověřit automatické logo včetně modrého pruhu bez dalšího potvrzování SPZ; otevřít přímý JPG a stáhnout ZIP. Při nejistém rozpoznání musí zůstat schválení blokované a fungovat opakování i ruční oprava. Po opravě musí zmizet schválení, po obnově se musí zobrazit nový výsledek. Ověřit i neviditelnou SPZ, více značek a mobilní zvětšení.

## Mazání jednotlivých fotek

Každá položka má tlačítko „Smazat fotku“ s potvrzením. Backend vyžaduje přihlášení a členství ve `valuation_staff` a odstraní pouze přesné cesty daného vozu a ID fotky: originál, `base.jpg`, `result.jpg` a manifest. Ostatní položky i fotogalerie vozu zůstanou beze změny. Manifest se maže až po úspěšném odstranění obrázků, takže chybu lze opakovat. Mazání je idempotentní. Všechny změny včetně generování sdílejí zámek jedné fotky: smazání během generování v jiné záložce je odmítnuté a generování nemůže soubory po smazání obnovit.

Ruční kontrola: zrušit potvrzení mazání (fotka zůstane), potvrdit mazání (fotka zmizí), obnovit stránku (nevrátí se), ověřit ostatní snímky a fotogalerii. Při chybě Storage se nesmí zobrazit úspěch; po obnovení lze akci opakovat. U fotky zpracovávané v jiné záložce musí backend odmítnout smazání.

## Ověření

- `node --test src/photoStudio/photoStudio.test.js`: formáty, evidence, ZIP CRC a adresář, autorizace, celý cyklus s mock AI/storage, opakování bez další platby, chyba a zachování originálu.
- `npx eslint src/photoStudio src/components/VehicleAdvertisingPrep.jsx` a produkční build.
- Ručně: přihlásit se jako pracovník; otevřít vůz a Přípravu inzerce; nahrát jeden exteriér; počkat na AI; přepnout originály; porovnat lak, SPZ, výbavu a vady; schválit; obnovit seznam i stránku; schválení i fotky zůstávají.
- Nahrát interiér/detail: zachová se prostředí. Neplatný formát a >12 MB se odmítne.
- Seřadit šipkami a stáhnout ZIP; zkontrolovat názvy, pořadí, JPEG a že neschválené nejsou zahrnuté.
- Mobil 390 px: ovládání v jednom sloupci, nahrávání z telefonu, žádný horizontální posuv.
- Při nedostupném AI ověřit zprávu a opakování. Nezavřený panel udržuje frontu; po odchodu se dokončí aktuální serverová operace, další nezačnou. Obnovit seznam pro výsledek.

## Omezení

Vyžaduje přístup projektu OpenAI k obrazovému modelu a kredit. Reálný placený převod musí být ověřen fotografií uživatele. Přesnost rozpoznání SPZ není garantovaná, proto je nutná běžná vizuální kontrola výsledku před jeho schválením. Zámek se uklízí v `finally`; tvrdé ukončení běhu může vyžadovat správce k odstranění příslušného `-lock` objektu. Limit 40 fotek na vůz. Neobsahuje přesun fotek ze stávající galerie.
