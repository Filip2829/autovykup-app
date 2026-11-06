# Chystání vozů na bazar

Modul je dostupný z rozcestníku. Obsahuje všechny skladové vozy včetně komise a rezervací; prodané a archivované vozy se nezobrazují. Výchozí filtr ukazuje nezainzerované vozy, připravené vozy čekající na inzerci jsou nahoře. Filtr „Všechny skladové“ zobrazí i zainzerované.

Fajfky se ukládají ihned. Poznámka má vlastní tlačítko Uložit a indikaci neuloženého textu. Pro načtení změn kolegy slouží Obnovit přehled. Obnovení a filtrování zachovává rozpracované poznámky; před opuštěním modulu je uložte.

Data využívají existující JSONB `cars.checklist`. Čištění a mechanická kontrola sdílí stávající položky administrativy. Nové údaje jsou v `stockPreparation` (`ready`, `advertised`, `note`). SQL migrace ani změny oprávnění nejsou potřeba. Označení připravenosti a inzerce mění odpovídající stav vozu; rezervace zůstává zachovaná. Fajfky jsou nezávislé, dokončení čištění a kontroly se neodvozuje automaticky z inzerce.

Ukládání čte aktuální záznam, mění pouze checklist, stav a autora/čas úpravy. Před zápisem kontroluje souběžnou změnu checklistu a stavu. Chyba nebo chybějící oprávnění se zobrazí v řádku a nezobrazí falešné potvrzení o uložení.

Změněné soubory tohoto úkolu: `src/App.jsx`, nové `src/components/StockPreparation.jsx`, `src/components/StockPreparation.css`, `src/utils/stockPreparation.js`, `src/utils/stockPreparation.test.js` a tento dokument. Existující rozpracované změny vyhledávání a AI inzerce byly zachované.

## Ruční ověření po přihlášení

1. Na rozcestníku otevřít Chystání vozů na bazar. Ověřit skladové vozy, včetně komise, a nepřítomnost prodaných vozů.
2. Změnit čištění a mechanickou kontrolu, obnovit stránku a ověřit trvalé uložení i v Administrativě vozu.
3. Zaškrtnout Připraveno k inzerci. Vůz se zvýrazní jako čekající na zainzerování.
4. Uložit poznámku, obnovit stránku a ověřit text. Ověřit také zrušení úpravy a zachování rozepsaného textu při filtrování a obnovení přehledu.
5. Zaškrtnout Zainzerováno. Vůz zmizí z výchozího filtru, zůstane pod Všechny skladové a jeho stav je Inzerováno. Zrušit fajfku a ověřit návrat. U rezervace musí zůstat stav Rezervováno.
6. Ve druhém přihlášeném prohlížeči změnit údaj. V prvním obnovit přehled a ověřit změnu. U souběžné změny stejné poznámky musí aplikace ohlásit konflikt a zachovat rozepsaný text.
7. Při vypnutém připojení zkusit uložit fajfku i poznámku. Musí se zobrazit chyba bez falešného potvrzení uložení; po obnovení spojení lze akci zopakovat.
8. Při šířce 390 px ověřit karty vozů, všechny čtyři fajfky, poznámku a filtry bez vodorovného posouvání celé stránky.

Automatická kontrola: `node --test src/utils/stockPreparation.test.js`, `npm.cmd run build`; nové JS/JSX soubory ověřit ESLintem. Plný projektový lint má existující chyby mimo tento modul. Ukládání s přihlášeným uživatelem a mobilní vzhled vyžadují ruční ověření výše.

Doporučený commit: `add stock vehicle preparation overview`.
