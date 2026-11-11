# Fotostudio – první verze

## Samostatné Fotostudio v rozcestníku

Rozcestník → Fotostudio zpřístupňuje stejné generování a export bez založení karty výkupu. Uživatel vytvoří pojmenovanou sadu (model/VIN/interní číslo), vrací se k ní a používá společnou komponentu `PhotoStudio`. Výchozí pozadí je „Opportunity · tmavá dlažba“ (`public/photo-studio/opportunity-dark-tiles.png`): světlá stěna, firemní označení a antracitová dlažba. Původní pozadí jsou nadále dostupná u sad i vozů.

Sady i fotografie se ukládají do existujícího bucketu `car-photos` pod `photo-studio-sales/{authUserId}/`. Seznam sad je v podsložce `sessions`, fotografie v podsložce `{sessionId}`. Server odvozuje vlastníka z ověřeného Auth uživatele a nikdy nepřijímá ID vlastníka z klienta. Do API se posílá `scope=standalone` a ID sady. Žádné záznamy v `cars` se nevytvářejí ani nečtou. Limit je 100 sad na účet a 40 fotek na sadu. Prázdnou sadu lze smazat; sadu s fotkami je nejprve potřeba vyprázdnit. Zámek sady brání souběžnému smazání a uploadu.

Přístup mají stávající členové `valuation_staff` a účty s administrátorem nastaveným `auth.users.raw_app_meta_data.photo_studio_access = true`. Uživatelsky editovatelná metadata se pro autorizaci nepoužívají. Samostatné oprávnění nedává přístup k fotostudiu cizího výkupu. Na výslovné zadání uživatele je připraven grant účtům `jhanak` (Hanák) a `sekanina`: `supabase/sql/grant_photo_studio_sales_access.sql`. Jde o změnu příznaku těchto dvou existujících účtů, ne o změnu schématu nebo RLS. Obrázky zůstávají ve stejném veřejném bucketu jako dosavadní fotky; API odděluje sady podle vlastníka, ale přímé URL obrázků nejsou soukromé.

Ruční kontrola: otevřít novou dlaždici z rozcestníku; vytvořit sadu s modelem/VIN; nahrát JPG a zvolit tmavou dlažbu; ověřit náhled, SPZ, schválení, ZIP a názvy souborů. Vrátit se na seznam a obnovit stránku: sada a fotky zůstanou. Ověřit účty jhanak/sekanina, zamítnutí neschváleného účtu, oddělení sad různých vlastníků a zachování přístupu výkupářů. Smazat fotky a prázdnou sadu; ostatní sady musí zůstat. Zopakovat na mobilu 390 px. Stávající fotostudio v detailu vozu zůstává funkční.

Detail vozu → Příprava inzerce → Fotostudio. Nahrajte JPG/PNG/WebP jednoho pohledu, vyberte jedno z pěti pozadí Opportunity nebo bílé/šedé neutrální studio. Před uploadem se v prohlížeči automaticky určí maska vozu, server pak skládá původní vůz a pozadí přes přihlášenou Supabase funkci `vehicle-photo-studio`. Originály, výstupy a schválení zůstávají v existujícím bucketu `car-photos`, prefix `photo-studio/{carId}-{uuid}-`. Existující mazání vozu tento prefix zahrnuje. Není potřeba SQL ani změna policies.

Přístup k operacím vyžaduje platného uživatele a členství v `valuation_staff`. Klíč `OPENAI_API_KEY` je pouze v backendu. Generativní překreslování fotografie bylo odstraněno. Výřez je automatický, bez potvrzování obrysu. Do nového pozadí se kopírují původní obrazové body chráněného vozu. Zachová se záběr, perspektiva i poměr stran; delší strana je nejvýše 2000 px. Mění se pouze okolí a nadále se zakrývá SPZ. Při chybě masky se nic negeneruje a lze zkusit jiný snímek. Fotky jsou ve stejném veřejném bucketu jako dosavadní fotodokumentace, nejsou soukromé.

ZIP obsahuje pouze ručně schválené fotky, názvy jsou očíslované podle aktuálního pořadí. Pořadí šipek se neukládá; po načtení se vrátí pořadí nahrání. ZIP uživatel rozbalí a JPG nahraje na portál. Přímé publikování na portály není součástí verze. Chybějící úhly se nefabrikují; volba pohledu je ruční. Interiér a detaily zachovávají scénu. Rozměry jsou obecný export, nikoli záruka aktuálních limitů konkrétního portálu.

## Pozadí Opportunity a SPZ

### Automatické oddělení původního vozu

Původní AI úprava celého snímku byla nahrazena segmentací a skládáním. Worker načítá pouze při prvním použití knihovnu Transformers.js 3.8.1 a model onnx-community/ormbg-ONNX, revize 034e2d884afbab897e10e78fc5bb566b29533fd6, q8/WASM. Model se stáhne z Hugging Face a běží v prohlížeči; fotografie se tam neodesílá. Apache-2.0 licence knihovny i modelu jsou uvedené u jejich zdrojů. První stažení modelu je přibližně 44 MB; pomalá zařízení mohou potřebovat více času. Výpočet má limit čtyři minuty a běží mimo hlavní UI vlákno.

Klient zachovává nahraný originál, vytvoří PNG podklad bez změny kompozice a automatickou masku. Uzavřené díry masky (např. skla) se vyplní; konzervativní práh a dvoupixelový okraj chrání detaily obrysu. Zcela prázdná nebo téměř celoplošná maska se odmítne. Klient předá původní soubor, source a vehicleMask; server je uloží jako original, source.png a vehicle-mask.png. Nové manifesty mají subjectVersion: 1. Validace rozměrů omezuje PNG na 4 miliony pixelů, upload na 32 MB včetně podkladů.

Server používá pouze zdrojové pixely vozu a skutečný vybraný soubor pozadí; původní vůz se nepřepočítává generativním modelem. Nepřidávají se díly, nemění se proporce, lak, osvětlení, odrazy, výbava ani vady. Volba redukce odrazů byla odstraněna; legacy hodnota gentle se přijme, ale zpracuje jako off. Interiér a detaily použijí celý původní PNG podklad. Výsledek se kóduje jako JPEG, takže může mít běžné kompresní rozdíly. Kopírování chráněných pixelů před JPEG kódováním je testované přesnou shodou.

Automatická segmentace může mít nepřesné okraje nebo ponechat lem původního pozadí. Nezaručuje bezchybný obrys v libovolné scéně; při kontrole je třeba zkontrolovat anténu, zrcátka a pneumatiky. Po selhání se nepoužije generativní náhradní úprava. Originál zůstává zachovaný. Hotové starší výsledky se automaticky nemění a UI je označuje jako starší AI úpravu. Dosud nezpracované staré uploady bez chráněného podkladu je třeba znovu nahrát; server nesmí spustit starou rekonstrukci.

Předlohy v public/photo-studio zůstávají stejné, pouze se přizpůsobují rozměrům pozadí bez změny vozu. Změna nevyžaduje SQL ani nové oprávnění. API detekce SPZ a fyzické vložení loga zůstávají v provozu.

Varianta „Opportunity Dílna“ (`public/photo-studio/opportunity-workshop.png`) vznikla v ImageGen odstraněním vozu a prvků galerie z uživatelova snímku dílny. Zachovává světlé panely, dlažbu, šedá žebrovaná vrata a rozostřený pravý průchod. Oblasti zakryté autem jsou rekonstrukce, nikoliv skutečná dokumentace prázdné dílny. AI instrukce pro tuto variantu výslovně zakazují přidávat ceduli či logo na stěnu; ostatní značkové varianty vlastní ceduli zachovávají. Přesné prompty jsou v `docs/photo-studio-background-prompts.json`.

Po úpravě `gpt-4.1` nejprve najde oblasti všech viditelných SPZ. Server pak vytvoří zvětšený kontextový výřez každé oblasti a model znovu určí skutečné čtyři rohy v souřadnicích výřezu. Teprve zpřesněné rohy se převedou do původního obrazu. Dodatečná kontrola obrazových bodů vyžaduje střídání světlého podkladu a tmavých znaků rozložené přes značku; odmítne hladký nárazník či přilehlé části vozu. Nejde o záruku detekce všech druhů značek: nejisté výsledky zůstávají blokované pro export.

Server vloží neprůhledné logo do pixelů JPG podle perspektivy značky (`jpeg-js` 0.4.4, `pngjs` 7.0.0; připnuté verze v import mapě Deno). Samotný původní nápis OPPORTUNITY bez podtitulu je vycentrovaný podle hran textu vodorovně i svisle. Stejná textura slouží serveru a prohlížeči. U nalezené značky ani při výsledku „žádná SPZ není vidět“ není potřeba samostatné potvrzení SPZ. Zůstává běžné schválení celé fotky před exportem. Selhání/nejistota rozpoznání nepovolí export; uživatel může opakovat automatické zaměření nebo opravit rohy ručně (zvětšení 1×/2×/4×). Geometrie se ukládá do manifestu. Úprava rohů vždy zruší předchozí schválení fotky.

Opravený postup má `maskVersion: 2`. Při otevření fotostudia se automaticky zpracují všechny hotové snímky se starší verzí: AI odhady se znovu zaměří, dříve ručně potvrzené rohy zůstanou zachované a přepočítá se pouze textura. Použije se `base.jpg` bez nového placeného generování vozu/pozadí. Backend ani frontend nepovolí export starého zaměření. Při odchodu z panelu se dokončí aktuální operace a další nezačnou. Neúspěšné rozpoznání již nese novou verzi a samo se při každém otevření neopakuje; lze je zopakovat tlačítkem.

Překryv používá originální obrázek loga dodaný uživatelem (`public/photo-studio/opportunity-logo.png`), žádné AI vykreslování nápisu. Neprůhledný tmavý podklad se projektivně transformuje podle čtyř rohů značky. `result.jpg` je již fyzicky zakrytý obrázek v kvalitě 95 %; náhled, přímý odkaz i ZIP používají tento soubor bez dalšího překreslování. Nezměněná kompozice původních pixelů se ukládá jako `base.jpg`, aby šla opravit poloha loga i obnovit neúspěšná operace bez dalšího placeného generování. Původní upload a základní kompozice zůstávají ve veřejném bucketu; nejde o anonymizaci těchto zdrojových podkladů. U starších položek zůstává kompatibilní překrytí v prohlížeči; tlačítko „Zakryt SPZ automaticky“ je převede na uložený zakrytý JPG. Změna výsledku mění parametr verze URL, aby prohlížeč neukazoval starý soubor.

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

OpenAI API a kredit se používají pro rozpoznávání SPZ, nikoliv generování vozu. Oddělení pozadí vyžaduje podporu WebAssembly a dostupnost modelu při prvním použití. Přesnost rozpoznání SPZ není garantovaná, proto je nutná běžná vizuální kontrola výsledku před jeho schválením. Zámek se uklízí v `finally`; tvrdé ukončení běhu může vyžadovat správce k odstranění příslušného `-lock` objektu. Limit 40 fotek na vůz. Neobsahuje přesun fotek ze stávající galerie.

## Ověření zachování vozu

- node --test src/photoStudio/photoStudio.test.js src/photoStudio/subjectMask.test.js: autorizace, uložený originál/podklady, kompozice, opakování, mazání, SPZ, přesná shoda chráněných pixelů a původní poměr stran.
- Browser test skutečné automatické masky na lokálním snímku vozu, navazující kompozice skutečnou serverovou funkcí bez placeného generování.
- Ručně po nasazení: obnovit aplikaci, nahrát exteriér, počkat na masku bez ručního obkreslení; porovnat lak, kola, světla, obrys a vady s originálem. Ověřit maskování SPZ, schválení a ZIP.
- Nahrát snímek na výšku a detail/interiér: poměr stran a celý záběr zůstanou zachované. Zopakovat v mobilní šířce 390 px.
- Při nedostupném modelu se nesmí uložit překreslený vůz; nová fotka se nepřidá. Starší hotové snímky zůstanou nezměněné a označené.
