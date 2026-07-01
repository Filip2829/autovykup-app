# AutoVýkup - projektový přehled

Tento dokument je hlavní zdroj pravdy o projektu AutoVýkup. Před větší změnou aplikace, databáze, architektury nebo vývojového postupu je potřeba tento dokument zkontrolovat a případně aktualizovat.

## 1. Stručný popis projektu

AutoVýkup je interní webová aplikace pro evidenci a zpracování vozidel ve výkupním procesu. Aplikace umožňuje zakládat karty vozidel, doplňovat administrativní a technické údaje, nahrávat fotky a dokumenty, sledovat stav přípravy k nacenění a ukládat poznámky nebo AI výstupy.

Projekt je aktuálně postavený jako React aplikace s Vite a Supabase backendem.

## 2. Uživatelé a účel aplikace

Aplikaci používají interní pracovníci výkupu vozidel.

Hlavní účely:

- evidence vozidel ve výkupu,
- rychlé založení nové karty vozidla,
- kontrola podkladů a administrativy,
- ukládání fotek vozidla,
- ukládání TP, CEBIA nebo CarVertical dokumentů,
- doplňování technických parametrů,
- sledování historie CEBIA,
- evidence výbavy,
- poznámky k vozidlu,
- základní nacenění vozidla,
- využití AI pro pomocné vyhodnocení dokumentů a technických údajů.

Nutno ověřit: přesné role uživatelů, oprávnění a produkční workflow ve firmě nejsou v repozitáři zdokumentované.

## 3. Použitý tech stack

Frontend:

- React 19
- Vite 8
- JavaScript / JSX
- CSS
- lucide-react pro ikony

Backend a data:

- Supabase JavaScript client
- Supabase Auth
- Supabase Database, v aplikaci používaná tabulka `cars`
- Supabase Storage, v aplikaci používaný bucket `car-photos`
- Supabase Edge Functions

AI:

- OpenAI API volané ze Supabase Edge Functions
- `analyze-vehicle-technical-data` používá OpenAI Responses API
- `analyze-cebia-history` používá OpenAI Chat Completions API

Vývojové nástroje:

- ESLint
- Vite build a preview skripty

## 4. Aktuální architektura aplikace

Aktuální aplikace je jednoduchá single-page aplikace.

Hlavní soubory:

- `src/main.jsx` - vstupní bod React aplikace.
- `src/App.jsx` - hlavní aplikační komponenta, obsahuje stav aplikace, UI, práci se Supabase a většinu business logiky.
- `src/App.css` - hlavní styly aplikace včetně responsivního chování.
- `src/index.css` - globální styly.
- `src/supabase.js` - vytvoření Supabase klienta.
- `supabase/config.toml` - konfigurace Supabase Edge Functions.
- `supabase/functions/*` - serverové Edge Functions.

Aktuální architektonická poznámka:

- Většina frontend logiky je soustředěná v jednom velkém souboru `src/App.jsx`.
- Aplikace zatím nemá samostatné komponenty, služby, hooky ani oddělenou datovou vrstvu.
- Databázové migrace nebo SQL schéma nejsou v repozitáři aktuálně viditelné.

## 5. Hlavní moduly aplikace

Podle aktuálního `src/App.jsx` aplikace obsahuje tyto části:

- Přihlášení a registrace uživatele přes Supabase Auth.
- Domovská obrazovka s přehledem modulů.
- Seznam vozidel a vyhledávání podle názvu, VIN a SPZ.
- Založení nového vozidla.
- Detail vozidla.
- Workflow vozidla:
  - podklady,
  - fotky,
  - nacenění,
  - schválení.
- Technické parametry vozidla.
- Fotky vozu.
- Administrativa vozu:
  - checklist,
  - STK,
  - TP / doklad,
  - CEBIA / CarVertical.
- Historie CEBIA.
- Výbava vozu.
- Poznámky a AI technický poradce.
- Nacenění vozu.

Některé dlaždice na domovské obrazovce jsou pouze připravené a hlásí, že budou doprogramované v další fázi.

## 6. Hlavní datový model vozidla

Aplikace pracuje s tabulkou `cars`. Přesné databázové schéma není v repozitáři doložené migrací, ale z kódu je zřejmé, že aplikace očekává minimálně tato pole:

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

Administrativa a workflow:

- `checklist`
- `photos`
- `technical_card_photos`
- `cebia_files`

Technické a CEBIA údaje:

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

Stavy vozidla používané aplikací:

- `Chybí podklady`
- `Připraveno k nacenění`
- `Nacenění hotové`
- `Výkupní cena potvrzena`

Nutno ověřit: přesné typy sloupců, povinné hodnoty, indexy, RLS pravidla a vazba dat na konkrétní uživatele.

## 7. Napojení na Supabase

Supabase klient je definovaný v `src/supabase.js`.

Aplikace používá:

- `supabase.auth.getSession`
- `supabase.auth.onAuthStateChange`
- `supabase.auth.signUp`
- `supabase.auth.signInWithPassword`
- `supabase.auth.signOut`
- `supabase.from("cars").select`
- `supabase.from("cars").insert`
- `supabase.from("cars").update`
- `supabase.from("cars").delete`
- `supabase.storage.from("car-photos").upload`
- `supabase.storage.from("car-photos").getPublicUrl`
- `supabase.functions.invoke`

Storage:

- Bucket používaný v kódu: `car-photos`.
- Soubory jsou ukládány do složek:
  - `vehicle-photos`,
  - `technical-card`,
  - `cebia`.

Nutno ověřit:

- zda je bucket `car-photos` veřejný,
- zda jsou nastavena správná Storage policies,
- zda jsou nastavena správná RLS pravidla pro tabulku `cars`,
- zda je bezpečné mít Supabase URL a anon key přímo v klientském souboru.

## 8. Napojení na AI / Edge Functions

V projektu jsou nakonfigurované tyto Edge Functions:

- `analyze-vehicle-technical-data`
- `analyze-cebia-history`
- `analyze-technical-problem`
- `analyze-car-valuation`

Aktuální stav podle souborů:

- `analyze-vehicle-technical-data` zpracovává TP a CEBIA soubory, podporuje obrázky i PDF přes OpenAI Files a Responses API.
- `analyze-cebia-history` zpracovává CEBIA soubory a vrací technické údaje, historii CEBIA a textový report.
- `analyze-technical-problem` má v repozitáři prázdný `index.ts`, ale frontend tuto funkci volá.
- `analyze-car-valuation` aktuálně vypadá jako výchozí ukázková Supabase funkce a neobsahuje reálnou logiku nacenění.

Všechny uvedené funkce mají v `supabase/config.toml` nastaveno `verify_jwt = false`.

Nutno ověřit:

- jestli mají být Edge Functions veřejně volatelné bez JWT,
- jak jsou v produkci nastavené secrets, hlavně `OPENAI_API_KEY`,
- které AI funkce jsou skutečně nasazené v Supabase,
- jestli se používají aktuální a cenově vhodné OpenAI modely,
- jak se mají AI výsledky ručně kontrolovat před použitím v rozhodování.

## 9. Produkční nasazení přes Vercel

Projekt obsahuje Vite frontend, který je typicky nasaditelný na Vercel přes build příkaz `vite build`.

V `package.json` jsou dostupné skripty:

- `dev`
- `build`
- `lint`
- `preview`

Nutno ověřit:

- zda je projekt skutečně napojený na Vercel,
- jaký Vercel projekt a tým se používá,
- jaké environment variables jsou na Vercelu nastavené,
- zda Vercel nasazuje pouze frontend a Supabase zůstává samostatná backend služba,
- zda se před produkčním nasazením vždy spouští lokální kontrola, lint a build.

## 10. Známá rizika a omezení

Aktuálně známá rizika:

- `src/App.jsx` obsahuje většinu aplikace v jednom velkém souboru.
- V repozitáři není viditelné SQL schéma ani migrace databáze.
- Některé Edge Functions jsou nehotové nebo šablonové.
- Frontend volá `analyze-technical-problem`, ale odpovídající Edge Function má prázdný `index.ts`.
- `analyze-car-valuation` zatím neobsahuje reálné nacenění.
- Edge Functions mají `verify_jwt = false`.
- Není zdokumentovaný bezpečnostní model, role uživatelů ani RLS pravidla.
- Není zdokumentovaný proces nasazení na Vercel.
- Není zdokumentovaný testovací checklist pro hlavní workflows.
- README je stále výchozí React + Vite šablona.

Omezení ověření:

- Tento dokument vychází pouze ze souborů aktuálně přítomných v repozitáři.
- Produkční nastavení Supabase a Vercel není možné plně ověřit pouze z lokálních souborů.
- Stav databáze, Storage policies, RLS a secrets je nutné ověřit přímo v Supabase.

## 11. Pravidlo hlavního zdroje pravdy

`PROJECT.md` je hlavní zdroj pravdy o projektu AutoVýkup.

Pravidla:

- Před každou větší změnou se má ověřit, že změna odpovídá tomuto dokumentu.
- Pokud se změní architektura, datový model, Supabase napojení, AI funkce nebo produkční deployment, musí se aktualizovat i tento dokument.
- Pokud si Codex nebo vývojář není jistý aktuálním stavem projektu, má nejdřív zkontrolovat `PROJECT.md` a potom ověřit fakta v kódu.
- Informace, které nejsou ověřitelné v repozitáři, musí být označené jako `Nutno ověřit`.
