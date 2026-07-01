# AutoVýkup - architektura

Tento dokument popisuje skutečnou architekturu projektu AutoVýkup podle aktuálního stavu repozitáře. Pokud něco nelze ověřit ze souborů v repozitáři, je to označeno jako `Nutno ověřit`.

## Přehled architektury

### Stručný popis aplikace

AutoVýkup je interní webová aplikace pro evidenci a zpracování vozidel ve výkupním procesu. Umožňuje pracovat s kartami vozidel, fotkami, administrativními podklady, technickými parametry, CEBIA historií, poznámkami, naceněním a vybranými AI funkcemi.

### Frontend

Frontend je React single-page aplikace postavená pomocí Vite. Hlavní aplikační logika je aktuálně soustředěná v souboru `src/App.jsx`.

Frontend zajišťuje:

- přihlášení a registraci,
- seznam vozidel,
- detail vozidla,
- formuláře,
- upload souborů,
- přepínání pohledů a modulů,
- volání Supabase Database, Storage, Auth a Edge Functions.

### Backend

Backend je řešený přes Supabase:

- Supabase Auth pro uživatele,
- Supabase Database pro data vozidel,
- Supabase Storage pro soubory,
- Supabase Edge Functions pro AI a serverovou logiku.

V repozitáři není samostatný Node/Express backend.

### Databáze

Aplikace v kódu pracuje s tabulkou `cars`. Přesné SQL schéma, migrace, indexy a RLS pravidla nejsou v repozitáři přítomné.

Nutno ověřit: skutečné produkční schéma tabulky `cars`, RLS policies a typy sloupců v Supabase.

### AI

AI je řešená přes Supabase Edge Functions, které volají OpenAI API. V repozitáři jsou nakonfigurované čtyři Edge Functions:

- `analyze-vehicle-technical-data`,
- `analyze-cebia-history`,
- `analyze-technical-problem`,
- `analyze-car-valuation`.

Ne všechny jsou aktuálně plně implementované.

## Struktura projektu

### Hlavní složky

| Cesta | Účel |
| --- | --- |
| `src/` | Frontend aplikace v Reactu. |
| `src/assets/` | Statické assety používané frontendem. |
| `public/` | Veřejné soubory pro Vite aplikaci, například ikony a favicon. |
| `supabase/` | Konfigurace a Edge Functions pro Supabase. |
| `supabase/functions/` | Jednotlivé Supabase Edge Functions. |

### Hlavní soubory

| Soubor | Účel |
| --- | --- |
| `index.html` | HTML vstup pro Vite aplikaci. |
| `vite.config.js` | Konfigurace Vite. |
| `package.json` | Skripty, závislosti a metadata projektu. |
| `package-lock.json` | Lockfile npm závislostí. |
| `eslint.config.js` | Konfigurace ESLint. |
| `README.md` | Aktuálně výchozí React + Vite dokumentace. |
| `src/main.jsx` | Vstupní bod React aplikace. |
| `src/App.jsx` | Hlavní komponenta a většina business logiky aplikace. |
| `src/App.css` | Hlavní styly aplikace. |
| `src/index.css` | Globální styly. |
| `src/supabase.js` | Inicializace Supabase klienta. |
| `supabase/config.toml` | Konfigurace Supabase Edge Functions. |

Dokumentační soubory vytvořené během profesionalizace projektu:

- `PROJECT.md`
- `DEVELOPMENT_GUIDE.md`
- `ROADMAP.md`
- `BACKLOG.md`
- `TASKS.md`

## React architektura

### Hlavní komponenty

Aktuálně je hlavní komponentou `App` v `src/App.jsx`. V repozitáři nejsou viditelné samostatné React komponenty rozdělené do dalších souborů.

Nutno ověřit: zda je cílem v budoucnu rozdělit `App.jsx` na menší komponenty. Aktuálně to není implementované.

### Stav aplikace

Stav je spravovaný pomocí React `useState` a odvozené hodnoty pomocí `useMemo`.

V `App.jsx` jsou mimo jiné stavy pro:

- seznam vozidel `cars`,
- vyhledávací dotaz `query`,
- vybrané vozidlo `selectedCar`,
- aktuální pohled `view`,
- aktuální modul detailu `module`,
- text poznámky `noteText`,
- text technického problému `problemText`,
- loading stavy AI funkcí,
- editační režim,
- fullscreen fotku,
- přihlášeného uživatele,
- přihlašovací formulář,
- formulář nového vozidla.

### Práce s formuláři

Formuláře jsou řešené přímo v JSX v `App.jsx`. Hodnoty jsou ukládané do lokálního React stavu a následně do Supabase.

Příklady formulářů:

- přihlášení a registrace,
- založení vozidla,
- editace základních údajů vozidla,
- technické parametry,
- checklist administrativy,
- CEBIA historie,
- výbava,
- poznámky,
- nacenění.

### Navigace

Aplikace nepoužívá router knihovnu. Navigace je řešená interním stavem:

- `view` přepíná hlavní pohledy, například domovskou obrazovku, seznam, nové vozidlo a detail.
- `module` přepíná moduly uvnitř detailu vozidla, například technické parametry, fotky, checklist, CEBIA historii, výbavu, poznámky a nacenění.

## Supabase

### Auth

Supabase Auth se používá v `src/App.jsx`.

Aplikace používá:

- `supabase.auth.getSession`,
- `supabase.auth.onAuthStateChange`,
- `supabase.auth.signUp`,
- `supabase.auth.signInWithPassword`,
- `supabase.auth.signOut`.

Uživatelské jméno se v kódu převádí na e-mail s doménou `@autovykup.local`.

Nutno ověřit: produkční způsob správy uživatelů, role a pravidla přístupu.

### Database

Aplikace používá tabulku `cars`.

Operace nad tabulkou:

- `select`,
- `insert`,
- `update`,
- `delete`.

Nutno ověřit:

- přesné SQL schéma,
- RLS pravidla,
- vazbu záznamů na uživatele,
- zda jsou povolené všechny operace pro klienta.

### Storage

Aplikace používá Supabase Storage bucket `car-photos`.

Používané operace:

- upload souboru,
- získání veřejné URL přes `getPublicUrl`.

Používané složky v bucketu:

- `vehicle-photos`,
- `technical-card`,
- `cebia`.

Nutno ověřit:

- zda je bucket veřejný,
- jaké jsou Storage policies,
- zda se při mazání záznamů mažou i fyzické soubory ve Storage.

### Edge Functions

Edge Functions jsou nakonfigurované v `supabase/config.toml`.

Všechny aktuálně uvedené funkce mají `verify_jwt = false`.

Nutno ověřit: zda je veřejné volání bez JWT záměrné a bezpečné pro produkční provoz.

## Datový model

### Hlavní tabulky

Z kódu je ověřitelná hlavní tabulka:

- `cars`

Nutno ověřit: zda v produkční Supabase existují další tabulky, které nejsou v repozitáři použité.

### Očekávaná pole tabulky `cars`

Z `src/App.jsx` je zřejmé, že aplikace očekává minimálně tato pole:

Základní identifikace:

- `id`
- `name`
- `year`
- `km`
- `vin`
- `spz`
- `status`
- `created_at`
- `updated_at`
- `created_by`
- `updated_by`

Administrativa a soubory:

- `checklist`
- `photos`
- `technical_card_photos`
- `cebia_files`

Technická data a historie:

- `technical_params`
- `cebia_history`
- `equipment`

Nacenění:

- `valuation_date`
- `sale_estimate`
- `buy_estimate`
- `approved_price`

AI výstupy:

- `ai_technical_report`
- `ai_document_report`
- `ai_cebia_report`
- `ai_risk_flags`

### Hlavní JSON struktury

Podle kódu jsou jako objekt nebo pole používané zejména:

- `checklist` - stav administrativních kontrol a platnost STK,
- `equipment` - mapa výbavy vozidla,
- `technical_params` - technické parametry vozidla,
- `cebia_history` - strukturované údaje z CEBIA historie,
- `photos` - pole URL fotek,
- `technical_card_photos` - pole URL TP nebo dokladů,
- `cebia_files` - pole URL CEBIA / CarVertical souborů,
- `notes` - pole poznámek,
- `ai_risk_flags` - pole AI rizik.

### Vztahy mezi daty

Aktuálně je hlavní vztah soustředěný do jedné karty vozidla v tabulce `cars`. Fotky a dokumenty jsou uložené ve Storage jako URL v polích záznamu vozidla.

Zákaznická databáze a vazba zákazník-vozidlo zatím nejsou v repozitáři implementované.

Nutno ověřit: zda produkční databáze obsahuje další vztahy mimo aktuálně používaný frontend.

## AI

### Existující AI funkce

Podle `supabase/config.toml` existují tyto Edge Functions:

| Funkce | Stav podle repozitáře | Účel podle kódu |
| --- | --- | --- |
| `analyze-vehicle-technical-data` | Implementovaná | Zpracování TP a CEBIA souborů, extrakce technických údajů, historie a výbavy. |
| `analyze-cebia-history` | Implementovaná | Zpracování CEBIA souborů a návrat technických údajů, historie a reportu. |
| `analyze-technical-problem` | Prázdný `index.ts` | Frontend ji volá pro AI technického poradce, ale funkce není implementovaná v repozitáři. |
| `analyze-car-valuation` | Šablonová funkce | V repozitáři vypadá jako výchozí Supabase ukázka, ne reálné AI nacenění. |

### Volání z frontendu

Frontend volá přes `supabase.functions.invoke`:

- `analyze-vehicle-technical-data`,
- `analyze-cebia-history`,
- `analyze-technical-problem`.

Nutno ověřit: zda jsou všechny funkce nasazené v Supabase a jak se chovají v produkci.

## Nasazení

### GitHub

Repozitář je git projekt. Konkrétní GitHub remote, branch protection, pull request workflow a CI nejsou z lokálních souborů ověřené.

Nutno ověřit:

- URL GitHub repozitáře,
- hlavní branch,
- pravidla pro pull requesty,
- zda existuje CI.

### Vercel

Projekt je Vite aplikace a obsahuje skript `build`, takže je technicky připravený pro běžné nasazení na Vercel.

Nutno ověřit:

- zda je projekt skutečně připojený k Vercelu,
- jaký Vercel projekt se používá,
- jaké environment variables jsou nastavené,
- zda build ve Vercelu prochází,
- zda Vercel nasazuje pouze frontend.

### Produkční workflow

Produkční workflow není v repozitáři zdokumentované.

Doporučený směr podle `DEVELOPMENT_GUIDE.md`:

- nejdřív lokální kontrola,
- potom commit,
- potom push,
- potom případné nasazení.

Nutno ověřit: skutečný postup nasazení používaný v projektu.

## Závislosti

### Hlavní knihovny

| Knihovna | Účel |
| --- | --- |
| `react` | UI knihovna pro frontend. |
| `react-dom` | Renderování React aplikace do DOM. |
| `@supabase/supabase-js` | Klient pro Supabase Auth, Database, Storage a Functions. |
| `lucide-react` | Ikony používané v UI. |
| `vite` | Vývojový server a build nástroj. |
| `@vitejs/plugin-react` | React plugin pro Vite. |
| `eslint` | Statická kontrola kódu. |
| `eslint-plugin-react-hooks` | ESLint pravidla pro React hooks. |
| `eslint-plugin-react-refresh` | ESLint pravidla související s React Refresh. |
| `globals` | Globální proměnné pro ESLint konfiguraci. |

### Supabase Edge Function importy

Edge Functions používají Deno konfiguraci přes vlastní `deno.json` soubory. Některé funkce importují:

- `@supabase/functions-js`,
- `@supabase/server`.

Nutno ověřit: zda všechny importy odpovídají aktuálnímu Supabase runtime a produkčnímu nasazení.

## Riziková místa projektu

Při vývoji je potřeba být opatrný hlavně zde:

- `src/App.jsx` obsahuje většinu aplikace v jednom velkém souboru.
- Databázové schéma není v repozitáři zdokumentované pomocí migrací.
- Supabase URL a anon key jsou přímo v `src/supabase.js`.
- RLS a Storage policies nejsou ověřitelné z repozitáře.
- Edge Functions mají `verify_jwt = false`.
- `analyze-technical-problem` je prázdná funkce, ale frontend ji volá.
- `analyze-car-valuation` je šablonová funkce, ne reálné nacenění.
- Uploadované soubory se ukládají jako veřejné URL; bezpečnost bucketu je nutné ověřit.
- Mazání fotek nebo dokumentů v UI může odstranit URL ze záznamu, ale z repozitáře není ověřené mazání fyzického souboru ze Storage.
- Některé části domovské obrazovky jsou pouze připravené a nejsou plně implementované.
- Lokální build/lint může záviset na dostupnosti Node/npm v prostředí.
- Produkční workflow přes GitHub/Vercel není zatím popsáno v repozitáři.

## Jak přidávat nové funkce

Nové funkce se mají přidávat postupně a bezpečně.

Doporučený postup:

1. Ověřit `PROJECT.md`, `DEVELOPMENT_GUIDE.md`, `ROADMAP.md`, `BACKLOG.md` a `TASKS.md`.
2. Vybrat jeden malý úkol z `TASKS.md`, případně nejdřív přesunout položku z `BACKLOG.md` do `TASKS.md`.
3. Před změnou projít relevantní části kódu a ověřit aktuální implementaci.
4. Popsat cíl změny jednou větou.
5. Určit, zda změna zasahuje frontend, Supabase, databázi, Storage, Edge Functions nebo pouze dokumentaci.
6. Pokud se mění databáze, připravit přesný SQL návrh a počkat na potvrzení.
7. Implementovat nejmenší možnou změnu bez nesouvisejících refaktoringů.
8. Ověřit `git diff` a zkontrolovat změněné soubory.
9. Spustit dostupné lokální kontroly, například lint, build nebo ruční test.
10. Připravit ruční testovací checklist včetně mobilní kontroly, pokud se mění UI.
11. Uvést rizika, omezení ověření a doporučenou commit zprávu.

Nová funkce se nemá začínat, dokud předchozí změna není dokončená, otestovaná nebo výslovně odložená.
