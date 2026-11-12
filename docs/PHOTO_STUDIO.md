# Fotostudio – první verze

## Oprava přerušeného zpracování a focení s obrysem (12. 11. 2026)

Produkční logy potvrdily ukončení `CPUTime` (cca 2055 ms, HTTP 546), po kterém ve Storage zůstal zámek a další pokusy vracely 409. Nový klient rozděluje kompozici, čištění a zakrytí SPZ do samostatných HTTP operací. Nové podklady mají delší stranu nejvýše 1280 px; staré PNG se při kompozici rovnoměrně zmenší na stejný limit. Originál se nemění. Analýza SPZ dekóduje snímek jednou pro všechny výřezy a kontroly. Hotové starší exporty mohou mít původní rozlišení.

Zámky obsahují náhodný token a čas. Zámek starší než 10 minut (více než maximální životnost běhu funkce) lze bezpečně obnovit; souběžné obnovy jedné generace sdílejí vlastní ochranný zámek a kontrolují obsah před odstraněním. U starých textových zámků se ověřuje `created_at` objektu Storage. Neznámé stáří ani aktivní zámek se nepřebírají. Uvolnit lze pouze vlastní generaci.

Nové výchozí prostředí **Opportunity Atelier** je inspirované uživatelovými ukázkami: světlá zadní stěna, stropní světelné pásy, betonová kruhová podlaha a nápis Opportunity. Původní Showroom zůstává volitelný. Pozadí vytvořil vestavěný ImageGen; prompt a následná změna jsou uložené v `photo-studio-background-prompts.json`. Zvětšilo se usazení celého vozu a doplnil se kontaktní stín i pod vzdálenějšími koly. Perspektiva, původní odrazy a vady vozu se nepřekreslují: venkovní fotografie shora nemůže pouhou výměnou pozadí vypadat stejně jako skutečný snímek v ateliéru z výšky světlometů.

Tlačítko **Focení s obrysem** otevře vodítko pro osm vnějších pohledů a varianty osobní vůz/SUV/dodávka. Živá zadní kamera používá pouze video, bez mikrofonu. Telefonní prohlížeč musí mít HTTPS a povolenou kameru. Zachycení používá stejný středový výřez 3:2 jako náhled. Obrys je pouze překryv, do JPG se neukládá. Před odesláním je kontrola snímku; zavření vypne kameru. Alternativní systémový fotoaparát / výběr snímku nemá živý překryv. Vodítko neověřuje správné zarovnání automaticky.

U položek se zachovaným podkladem lze zvolit **Upravit znovu · vybrané prostředí**. Schválení se zruší a nový výsledek vzniká z původního podkladu. Neověřený mezivýsledek nelze schválit ani exportovat. Nedokončené čištění může navázat na ověřenou kompozici; nemůže přeskočit kontrolu použitím staršího výsledku.

Ruční checklist: otevřít Fotostudio a vybrat Atelier; zkontrolovat světlou stěnu a stropní osvětlení; otevřít focení, přepnout čelo/záď/boky/45° a karoserie; povolit kameru, srovnat vůz, vyfotit, zkontrolovat a použít. Zopakovat snímek a zavřít kameru. Ověřit odmítnuté oprávnění a alternativní upload. Na mobilu 390 px nesmí být vodorovný posuv. Zaseknutou fotografii zkusit zpracovat znovu: starý zámek se obnoví, aktivní se odmítne. U hotové fotky změnit prostředí přes tlačítko Upravit znovu a porovnat obrys, kola, světla, SPZ, lak a vady s originálem. Schválit a zkontrolovat ZIP. Obnovit seznam i stránku a ověřit uložený výsledek. SQL, schéma ani oprávnění se nemění.

## Pravidla podle skutečného obsahu fotografie (11. 11. 2026)

Uživatel doplnil příklady img_8954, img_8942, img_8947, img_8948, img_8949, img_8950 a img_8952 a požádal o showroom všude, kde je skutečně vidět okolní prostředí vozu, i o odstranění volného prachu, šlápot a nečistot v interiéru při zachování ovladačů a materiálů. Tato aktuální pravidla nahrazují výjimku pro pohled Detail i dřívější neutrální plochu ve výhledu z interiéru.

Před uploadem klient připraví PNG a zavolá autorizovanou operaci `inspect`. Ta bez zápisu do Storage rozpozná skutečný obsah snímku (`exterior`, `exterior_detail`, `interior`, `interior_detail`), viditelné okolí a případný důkazní záběr poškození. Rozhoduje obsah, nikoliv pouze ručně vybraný pohled. Pro nové fotografie se ukládá `photoRulesVersion: 3` a `compositionVersion: 3`. Hotové historické fotografie se samy nemění.

Celý vůz se nadále odděluje lokálním modelem a usazuje na podlahu. Těsné venkovní detaily se neposílají do salienčního výřezu: na skutečném img_8947 zaměňoval odrazy na laku za okolí a vykusoval karoserii. Místo toho server rozpozná pouze vnější okolí hlavního vozu a vloží showroom výhradně do těchto oblastí. Původní výřez, velikost, poloha, lak a odrazy na voze zůstávají zachované. Po kompozici se porovnává původní snímek s výsledkem a předlohou; bez potvrzení zachování vozu a odstranění okolí se výsledek neuloží.

Interiéry i jejich detaily mají stejný showroom ve výhledu přes skla, otevřené dveře a úzké pruhy kolem hran snímku. Příklad img_8950: štěrk pod dveřmi se nahrazuje, ovladače oken a obložení zůstávají. Všechny otvory používají jednu souvislou předlohu, nikoliv opakovaný obrázek v každém okně.

Čištění interiéru je lokální fotografická úprava, nikoliv generování nových plastů/tlačítek. Obrazová analýza ve stávajícím OpenAI API vymezí pouze bezpečně rozpoznaný volný prach, vlákna, otisky/světlý špinavý film a šlápoty na gumových kobercích; vyžaduje jistotu alespoň 0,98. Každá oblast obsahuje ochranné výluky symbolů, textů, hran ovladačů, švů a skutečných vad. U filmu je nutná čistá referenční oblast stejného materiálu a osvětlení. Izolované světlé částice se tlumí lokálním mediánem; film se konzervativně přizpůsobuje referenci při zachování původní vysokofrekvenční struktury. Tmavé škrábance se nevyplňují. Neobnovuje se poškozený plast, lak, kůže ani čalounění; důkazní záběry poškození se nečistí.

Samostatné porovnání před a po čištění musí potvrdit zachování ovladačů, materiálů a opotřebení a změnu pouze volných nečistot. Selhání zastaví uložení i schválení. Původní upload se nepřepisuje. Operace přidávají obrazovou klasifikaci, lokalizaci nečistot a kontrolu přes stávající OpenAI API; fotografie se nepředávají novému poskytovateli a nepoužívá se Images Edit API. Přesnost rozpoznání a rozsah odstranění nečistot z libovolného snímku nejsou garantované; při nejistotě se oblast nemění nebo se zpracování zastaví.

Ověření: `node --test src/photoStudio/photoStudio.test.js src/photoStudio/subjectMask.test.js src/photoStudio/showroomComposition.test.js src/photoStudio/photoRules.test.js`; lint změněných modulů a izolovaný build. Testy zahrnují ochranu symbolů, tmavých škrábanců a struktury materiálu, film na gumě, štěrk u dveří, zachování výřezu a odrazů na karoserii, skutečný obsah odlišný od vybraného pohledu a zablokování nevyhovující kontroly. Odpovědi cloudové analýzy jsou v testech simulované. Lokální salienční model byl ověřen na dodaných fotografiích světlometů a právě jeho nevyhovující výsledek vedl k vyřazení této cesty pro těsné detaily.

Ruční checklist po nasazení: obnovit aplikaci, nahrát dodané záběry; u světlometů zkontrolovat původní výřez a každý díl lesklé karoserie. U img_8950 ověřit odstranění štěrku pod dveřmi bez zásahu do ovladačů. U img_8954/img_8952 porovnat symboly a texturu plastů s originálem; u img_8948/img_8949 zkontrolovat koberečky, jejich žebra a skutečné vady. Při nejistotě nesmí být dostupný hotový výsledek ke schválení. Staré hotové fotografie je třeba nahrát znovu. SQL ani nové oprávnění nejsou potřeba.

## Aktuální showroom a interiéry (11. 11. 2026)

Uživatel 11. 11. 2026 výslovně povolil při spuštění úpravy interiéru předat celou původní fotografii i její upravenou verzi do OpenAI API k rozpoznání výhledu z oken a ověření zachování kabiny. Potvrdil i upozornění, že snímky mohou obsahovat osoby nebo osobní věci. Souhlas zazněl po automatickém odmítnutí prvního nasazení této nové operace. Úprava se spouští pouze u nově nahraného / výslovně zpracovaného snímku interiéru, nikoliv hromadně nad starými fotografiemi při otevření aplikace.

V nabídce zůstává pouze Opportunity Showroom. Pět ostatních rastrových pozadí bylo odstraněno ze statických souborů; neutrální bílé/šedé varianty již nejsou volitelné. Starší klíče API se mapují na showroom, aby starší otevřený klient nedokázal znovu vybrat jiné pozadí. Hotové historické fotografie se nemění.

Showroomový obrázek v `public/photo-studio/opportunity-showroom.png` byl upraven vestavěným ImageGen: přesun stejné cedule níže, zachování místnosti, světel a dlažby. Cedule je celá pod horními 15 % obrazu, takže zůstává v přiloženém typu ořezu. Prompt je uložen v `docs/photo-studio-background-prompts.json`.

Nové exteriéry používají `compositionVersion: 2`. Výřez vozu se jako celek rovnoměrně zmenší a posune podle svého obrysu: nejvýše 86 % šířky a 58 % výšky snímku, spodní obrys na 89 % výšky. Horní část stěny zůstává pro ceduli. Poměr stran snímku i proporce a úhel vozu zůstávají zachované; mění se jeho velikost a umístění v záběru. Kontaktní stín vychází ze spodního profilu výřezu, takže respektuje rozdílnou výšku kontaktů pneumatik u šikmých pohledů. Stín se kreslí pouze do pozadí; znovu vložené chráněné pixely vozu se nepřebarvují.

U pohledu Interiér server pomocí stávajícího gpt-4.1 rozpozná pouze oblasti výhledu ven přes skla nebo otevřené dveře. Každá oblast má ochranné výluky pro zrcátka, sloupky a ostatní vybavení; přijme se pouze jistota alespoň 0,95 a validní geometrie. Výhled se vyplní neprůhlednou teplou světlou plochou podobnou přiloženým ukázkám. Zbytek interiéru zůstává původní. Nejde o generativní rekonstrukci kabiny. Druhé porovnání původního a upraveného snímku vyžaduje zachování kabiny a zakrytí výhledu; při selhání se základ ani hotový výsledek neuloží a schválení není možné. Zpracování interiéru přidává dva obrazové požadavky na stávající OpenAI API. Detail / poškození tyto úpravy neprovádí.

Ověření: `node --test src/photoStudio/photoStudio.test.js src/photoStudio/subjectMask.test.js src/photoStudio/showroomComposition.test.js`, lint a izolovaný produkční build. Testy zahrnují obrys a stín pro různé proporce pohledů, zachování zdrojových barev, přesné zachování pixelů palubní desky a zrcátka mimo výhled, zamítnutí nejisté geometrie i neúspěšné výsledné kontroly a pozici cedule. Odpovědi obrazové analýzy interiéru jsou v automatických testech simulované; přesnost rozpoznání libovolného skutečného interiéru nelze garantovat.

Ruční checklist: obnovit aplikaci; ověřit jedinou showroomovou kartu na desktopu i 390 px; nahrát přední, boční a šikmý pohled a zkontrolovat pneumatiky na podlaze, proporce a ceduli po ořezu. Nahrát interiér se zřetelným výhledem ven, zkontrolovat všechna skla, zrcátka, sloupky, displeje a potahy. Potvrdit zakrytí SPZ a exportovat ZIP. Při nejistotě musí zůstat originál a nezpřístupnit se schválení výsledku. Starší snímky je pro nové zpracování třeba znovu nahrát. SQL ani změna oprávnění nejsou potřeba.

Následující části popisují původní zavádění jednotlivých funkcí; pro výběr pozadí, kompozici a úpravy interiéru platí aktuální postup výše.

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
