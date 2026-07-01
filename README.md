# AutoVýkup

AutoVýkup je interní webová aplikace pro evidenci a zpracování vozidel ve výkupním procesu. Aplikace pomáhá zakládat karty vozidel, ukládat podklady, fotky, technické údaje, poznámky, nacenění a vybrané AI výstupy.

## Účel projektu

Projekt je určený pro interní pracovníky výkupu vozidel. Cílem je mít jedno místo pro správu vozidel od prvního založení karty přes kontrolu administrativy a fotodokumentace až po nacenění a další rozhodnutí.

Aplikace aktuálně slouží hlavně pro:

- evidenci vozidel,
- práci s detailem vozidla,
- nahrávání fotek a dokumentů,
- kontrolu technických a administrativních podkladů,
- poznámky k vozidlu,
- základní nacenění,
- pomocné AI vyhodnocení vybraných dokumentů a údajů.

## Technologie

Frontend:

- React
- Vite
- JavaScript / JSX
- CSS
- lucide-react

Backend a data:

- Supabase Auth
- Supabase Database
- Supabase Storage
- Supabase Edge Functions

AI:

- OpenAI API volané ze Supabase Edge Functions

Nasazení:

- Vercel je plánované / používané produkční prostředí pro frontend. Nutno ověřit konkrétní projekt a produkční workflow.

## Struktura dokumentace

- `PROJECT.md` - hlavní zdroj pravdy o projektu, účelu, modulech, datovém modelu a známých rizicích.
- `ARCHITECTURE.md` - technický popis skutečné architektury podle aktuálního repozitáře.
- `DEVELOPMENT_GUIDE.md` - závazná pravidla vývoje, práce s Codexem, testování, databáze a Git.
- `ROADMAP.md` - dlouhodobý plán vývoje rozdělený do verzí a etap.
- `BACKLOG.md` - sběrné místo pro známé a budoucí nápady.
- `TASKS.md` - aktuální pracovní seznam nejbližších malých úkolů.
- `CHANGELOG.md` - bude vytvořen; historie změn projektu.
- `PRODUCT_VISION.md` - bude vytvořen; produktová vize a směr aplikace.

## Základní workflow vývoje

1. Analýza - nejdřív projít existující kód, dokumentaci a aktuální stav.
2. Návrh - popsat cíl změny, rozsah, rizika, dotčené soubory a případnou potřebu SQL.
3. Implementace - provést jednu malou změnu bez nesouvisejících zásahů.
4. Testování - ověřit změnu lokálně, připravit ruční checklist a zapsat omezení ověření.
5. Commit - použít krátkou a jasnou commit zprávu pro jednu logickou změnu.
6. Deploy - až po lokálním ověření, commitu a kontrole stavu.

## Pravidla

Nejdůležitější pravidla vývoje:

- Jeden úkol = jedna změna.
- Stabilita má přednost před novými funkcemi.
- Neprovádět zbytečné refaktoringy.
- Nezasahovat do nesouvisejících částí aplikace.
- Databázi měnit pouze vědomě, s přesným SQL a po odsouhlasení.
- Každá změna musí mít testovací checklist.
- Každá UI změna musí být použitelná na mobilu.
- Nepokračovat přes chyby, které brání ověření.

Podrobná pravidla jsou v `DEVELOPMENT_GUIDE.md`.

## Stav projektu

Projekt má aktuálně funkční základ React/Vite aplikace se Supabase napojením. Hlavní aplikační logika je soustředěná v `src/App.jsx`. Repozitář obsahuje Supabase Edge Functions pro AI, ale některé funkce jsou nehotové nebo šablonové.

Další vývoj se řídí:

- `ROADMAP.md` pro dlouhodobý směr,
- `BACKLOG.md` pro nápady,
- `TASKS.md` pro nejbližší konkrétní úkoly,
- `DEVELOPMENT_GUIDE.md` pro pravidla každé změny.

Nutno ověřit před produkčním provozem: databázové schéma, RLS pravidla, Storage policies, Vercel nastavení, GitHub workflow a nasazení Edge Functions.
