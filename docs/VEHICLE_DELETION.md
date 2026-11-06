# Úplné mazání vozidla

Příčina chyby: vazba `valuation_requests.converted_car_id` používala výchozí `ON DELETE NO ACTION`, a proto blokovala smazání vozu převedeného z online žádosti.

Uživatel výslovně požaduje smazání vozu ze všech přehledů včetně původní online žádosti s fotografiemi, poznámkami a historií. Oprava mění vazbu na `ON DELETE CASCADE`. Existující vazby dál odstraní dokumenty vozu, doporučení cen, zákaznické shody a všechny potomky žádosti (fotografie, poznámky, události, tokeny a e-mailové úlohy). Zákaznické kontakty, poptávky zákazníků ani jiné vozy se nemažou.

Fyzické soubory zachytí privátní trigger před smazáním do `vehicle_file_cleanup`. Funkce `cleanup-vehicle-files` vyžaduje přihlášení, nepřijímá cesty od uživatele a odstraňuje jen soubory již zařazené úspěšným smazáním vozidla. Fronta není přístupná klientským rolím. Chyba Storage API ponechá úlohu ve frontě pro opakování při dalším načtení aplikace. Přihlašovací oprávnění stávajících tabulek se nemění.

Frontend ověří skutečně vrácené ID odstraněného záznamu, aktualizuje seznamy a vyhledávání, vyprázdní vybraný detail a obnoví počet zákaznických shod. Potvrzovací dialog výslovně uvádí nevratné smazání všech souvisejících dat.

## Nasazení

1. Ověřit migrační soubor `supabase/migrations/20261106142504_cascade_vehicle_deletion.sql` a aplikovat jej v jedné transakci.
2. Nasadit Edge Function `cleanup-vehicle-files` s `verify_jwt = true` a soubory `index.ts` a `cleanup.js`.
3. Nasadit frontend včetně `src/services/vehicleDeletion.js` a integračních změn `src/App.jsx`.
4. Ověřit stav funkce a produkční build. Již existující vozidla ani žádosti se samotným nasazením nemažou.

## Ověření

- `node --test src/services/vehicleDeletion.test.js`: 7 testů včetně zamítnutého mazání a výpadku Storage API.
- ESLint změněných JS souborů a Vite build.
- Databázový test skutečné migrace v oddělených testovacích schématech v jedné transakci s `ROLLBACK`: pouze vybraný vůz a jeho žádost/potomci zmizí, přesně související soubory se zařadí do fronty, jiný vůz a soubory zůstanou, klientské role nemají přístup k frontě ani triggerové funkci. Žádná reálná data se při testu nemažou.

Ruční kontrola po nasazení (pouze na záznamu určeném ke smazání):

1. Zrušit potvrzovací dialog a ověřit, že vůz i žádost zůstaly.
2. Potvrdit smazání vozu převedeného z online žádosti. Ověřit nepřítomnost v evidenci, Vozech skladem, vyhledávání, zákaznických shodách a online žádostech po jejich obnovení.
3. Obnovit stránku a ověřit, že se záznam nevrátil. Zkontrolovat odstranění souborů a prázdnou frontu.
4. Ověřit jiný vůz a jeho žádost. Jejich data a soubory musí zůstat zachované.
5. Při výpadku čištění musí být záznam stále odstraněný a aplikace oznámit čekající soubory. Po dalším přihlášení se fronta znovu zpracuje.

Rollback pravidla mazání lze provést návratem FK na `ON DELETE NO ACTION`, odstraněním triggeru a funkce; frontu odstranit až po dokončení čekajících úloh. Již potvrzená smazání takový rollback neobnoví. Nevratné mazání se spouští až uživatelovým potvrzením konkrétního vozu.

Doporučený commit: `fix complete vehicle deletion across modules`.
