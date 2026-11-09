# Mobilní nacenění vozidel

První použitelná verze mobilního rozhraní pro práci přímo u vozu. Vstup je v hlavním menu pod názvem „Mobilní nacenění“ nebo přes adresu `https://autovykup-app.vercel.app/?mobile-inspection=1`. Platí běžné přihlášení do AutoVýkupu.

## Pracovní postup

1. Vyplnit značku, model a alespoň VIN nebo SPZ. Tlačítko „Založit vůz a pokračovat“ vytvoří běžnou kartu ve stavu nacenění. Nejde o druhou evidenci ani závěrečné kopírování.
2. Vyfotit nebo vybrat TP. Fotografie se uloží soukromě do dokumentů s kategorií „Technický průkaz“.
3. Přidat fotografie vozu. Zobrazí se i v běžné galerii karty.
4. Doplnit technické parametry ručně nebo načíst návrh z TP či registru. Před převzetím je vidět navrhovaná i dosavadní hodnota. Automaticky jsou vybrané jen prázdné údaje; nahrazení vyplněného údaje vyžaduje výslovný výběr.
5. K poškození vybrat místo, napsat popis a pořídit snímek. Popis se přidá k dosavadnímu stavu a fotografie k běžným fotkám vozu i vazbě poškození.
6. Doplnit zákazníka a uložit interní poznámky.
7. Vyplnit náklady na přípravu a ceny. Porovnání trhu využívá stávající AI službu a společnou historii výpočtů. Výsledek se nejprve zobrazí; cenová pásma se převezmou až tlačítkem. Schválená cena zůstává ručním rozhodnutím.
8. „Dokončit prohlídku“ uloží její dokončení. Kartu lze dál otevřít v běžném detailu a upravovat; stav obchodu se automaticky nemění.

Základní a cenová pole se po založení průběžně ukládají po přestávce v psaní. K dispozici je také trvale viditelné tlačítko „Uložit“. Poznámka má vlastní ukládací tlačítko. Změny rozepsané během ukládání se nesmažou odpovědí serveru.

## Pokračování a chyby

- Přehled rozpracovaných prohlídek umožňuje pokračovat ve stejném voze. Lze vybrat i jiný existující vůz z evidence.
- Formulář, poznámka, popis poškození a jejich výchozí uložené hodnoty se průběžně uchovávají v prohlížeči pod klíčem přihlášeného uživatele. Pokud prohlížeč místní úložiště nepovolí, zobrazí se upozornění.
- Výchozí hodnoty pomáhají odhalit souběžnou úpravu kolegou; zápis je navíc podmíněný aktuálním `updated_at`. Konflikt nevede k přepsání údajů.
- Opakované založení po ztracené odpovědi hledá stejný klíč vytvoření. Před vytvořením se kontrolují existující VIN a normalizované SPZ. Nevzniká nová databázová unikátní podmínka; souběžné založení stejného vozu dvěma různými uživateli se nadále řídí možnostmi stávající databáze.
- Neúspěšně nahraná fotografie zůstane ve frontě s možností opakování. Stabilní identifikátor brání zdvojení při opakování a úspěšně připojený soubor se při ztracené odpovědi nemaže.
- Soubory čekající na upload zůstávají v paměti otevřené stránky, ne v místním textovém konceptu. Před odchodem se musí nahrát nebo vědomě odebrat. Při zavření stránky se prohlížeč pokusí upozornit; po ukončení prohlížeče systémem může být nutné soubor vybrat znovu.
- Tlačítko pro vrácení neuložených úprav formuláře umožní opravit nebo opustit chybný koncept bez zásahu do uložených údajů.

## Integrace

Modul používá stávající `cars`, `vehicle_documents`, buckety `car-photos` a `vehicle-documents`, Edge Functions pro TP, registr a tržní nacenění a tabulku historie nacenění. Po uložení se aktualizuje přehled vozů a synchronizace CRM shod. Nevzniká nová tabulka, SQL migrace ani změna oprávnění.

Hlavní soubory jsou `src/mobileInspection/MobileInspection.jsx`, `inspectionService.js`, `inspectionModel.js`, `inspectionDraft.js` a `mobileInspection.css`. Starší checkpoint na větvi `codex/mobile-inspection-wip` je historický podklad.

## Ověření první verze

- `npm.cmd run test:mobile`: validace, konflikty, zachování původních dat, opakované založení, soukromé TP, poznámky a uploady bez duplicit, ztracené odpovědi, návrhy registru, použití historie tržního nacenění a místní koncepty.
- Regresní testy aplikace, poptávek a sdílení; ESLint mobilních zdrojů a produkční build.
- Prohlížeč s viewportem 390 × 844: založení izolovaného vozu, kontrola návrhu údajů, uložení poznámky, převzetí cenového pásma, dokončení prohlídky a nahrání TP. V tomto testu se nevolala produkční databáze ani placené AI nacenění.

Ruční kontrola skutečného obchodního případu: otevřít menu na telefonu, založit skutečný vůz, vyfotit TP a vůz, přidat poškození a poznámku, zkontrolovat údaje a ceny, otevřít běžnou kartu a ověřit všechna uložená data. Testovat i obnovení stránky a opakování uploadu po ztrátě připojení.
