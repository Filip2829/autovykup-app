# Sdílené nabídky vozidel

U každé karty vozidla a skutečné zákaznické poptávky je tlačítko „Sdílet vůz / nabídka pro AAA“. Připraví odkaz pro externího příjemce bez přihlášení. Žádný e-mail se neposílá. Uživatel odkaz zkopíruje a odešle vlastní cestou.

## Postup

1. Otevřít sdílení z detailu vozu nebo poptávky.
2. Vybrat účel AAA Auto nebo zájemce. U AAA jsou předvybrané dostupné fotografie, TP a Cebia; u zájemce jsou TP zpočátku vypnuté.
3. Zkontrolovat všechny podklady, vybrat sdílené soubory a podle potřeby nahrát chybějící TP nebo Cebii (PDF, JPEG, PNG, WebP do 10 MB).
4. Zkontrolovat nebo upřesnit platnost STK a odpočet DPH pro tuto nabídku. Podkladová karta se tím nemění. Rok, motorizace a další dostupné parametry se načtou ze záznamu.
5. Případně doplnit zprávu pro příjemce a platnost odkazu (1, 7, 14 nebo 30 dní; výchozí 14 dní).
6. Potvrdit sdílení vybraných podkladů, vytvořit odkaz a zkopírovat jej. U neúplné nabídky se zvlášť potvrzují chybějící podklady.
7. V přehledu vytvořených odkazů lze odkaz zneplatnit.

Fotografie z formulářových poptávek jsou dostupné i bez převodu do evidence. U již převedeného vozu se stejné fotografie nepřidávají dvakrát. Chybějící údaje se označují jako neuvedené, nikoliv jako potvrzené. Interní odhady, schválené výkupní ceny, marže, náklady, poznámky a kontakty původního zákazníka nejsou součástí veřejného datového výstupu. Uživatel kontroluje obsah vybraných originálních dokumentů, které samy mohou obsahovat osobní údaje.

## Technické řešení

- Veřejná stránka `/nabidka-vozu#token` zobrazuje fotografickou galerii, technické parametry, STK, DPH, vybrané TP a výpisy Cebia a firemní kontakt Opportunity.
- Token má 256 náhodných bitů, v databázi se ukládá pouze SHA-256 otisk. Fragment není součástí HTTP adresy odesílané při načtení stránky.
- `vehicle-sharing` Edge Function autentizuje všechny správcovské operace přes ověřenou Supabase session a `valuation_staff`. Jediná veřejná operace `view` vyžaduje platný neuhodnutelný token.
- `vehicle_share_links` uchovává vybraný snímek nabídky, vazbu na zdroj, expiraci, zneplatnění a autora. Pozdější změny karty se do starého odkazu nepromítají; je potřeba vytvořit nový.
- `vehicle_share_attachments` eviduje TP a Cebii přidané přímo pro sdílení. Soubory jsou ve stávajícím soukromém bucketu `vehicle-documents`; načítají se také při sdílení propojeného vozu/poptávky.
- Obě nové tabulky mají RLS a nulová přímá oprávnění pro `anon` i `authenticated`; přistupuje k nim pouze serverová funkce. Nemění se přístupová pravidla existujících tabulek ani veřejnost bucketů.
- Souborové odkazy se podepisují na nejvýše pět minut, vždy nejvýše do expirace nabídky. Po zneplatnění nelze získat další souborové odkazy; již načtené nebo stažené soubory nelze vzít zpět a dříve podepsané odkazy mohou doběhnout do své krátké expirace.
- Při smazání zdroje se související odkazy a přílohy odstraní kaskádou; nové soubory se zařadí do stávající fronty úklidu. Žádný existující vůz ani poptávka se při instalaci migrace nemění ani nemaže.
- Veřejná stránka a API mají `no-store`, `no-referrer` a `noindex`. API podepisuje jen serverem vybrané soubory příslušného záznamu, ne cesty zadané anonymním volajícím.

## Nasazení a ověření

Databázový předpoklad: `supabase/migrations/20261109135307_vehicle_share_links.sql`. Uživatel 9. 11. 2026 výslovně schválil tuto změnu i dokončení nasazení; migrace byla aplikována a oprávnění obou tabulek byla ověřena SQL dotazem (RLS zapnuté, čtení pro `anon` a `authenticated` zakázané). Potom se nasazuje Edge Function `vehicle-sharing` a frontend.

Automatické kontroly: `npm.cmd run test:sharing`, `npm.cmd run test:valuation`, `npm.cmd test`, `npm.cmd run build` a ESLint změněných komponent a modulů. Testy ověřují kompletní HTTP tok vytvoření, anonymního zobrazení a zneplatnění, expiraci, oprávnění, whitelist veřejných údajů, výběr souborů, soubory z nepřevedené poptávky, duplicity a podpisy uploadů.

Ruční checklist:

1. Z vozu otevřít sdílení a porovnat počty fotografií, TP a Cebie s uloženými podklady.
2. Z nepřevedené poptávky zkontrolovat načtení fotografií a TP; přidat chybějící výpis Cebia.
3. Přepnout na zájemce a ověřit vypnutí TP; označit konkrétní sdílené soubory.
4. Vytvořit odkaz a otevřít ho bez přihlášení. Ověřit galerii, dokumenty, STK, DPH a absenci interních cen, poznámek a zákaznických kontaktů.
5. Zneplatnit odkaz a ověřit, že nový požadavek veřejnou nabídku již nevrátí.
6. Na mobilní šířce ověřit výběr souborů, kopírování odkazu a veřejnou galerii.

Nejde o automatické zasílání, přijímání cenových nabídek ani průběžnou synchronizaci již vydaných odkazů.
