# Codex workflow pro AutoVykup

Tento soubor definuje pravidla pro dalsi praci Codexu v projektu AutoVykup.
Cilem je drzet zmeny male, kontrolovatelne a bez zasahu do nesouvisejicich casti aplikace.

## Audit projektu

- Hlavni repozitar: `/workspaces/autovykup-app`
- Aktualni lokalni cesta v tomto behu: `C:/Users/filip.kralik/Documents/autovykup-app`
- Git top-level: `C:/Users/filip.kralik/Documents/autovykup-app`
- Vetev pri auditu: `main`
- Stav pri auditu: `main...origin/main [ahead 2]`, zmeneny `README.md`, necommitnute dokumentacni soubory `ARCHITECTURE.md`, `BACKLOG.md`, `CHANGELOG.md`, `DEVELOPMENT_GUIDE.md`, `PRODUCT_VISION.md`, `PROJECT.md`, `ROADMAP.md`, `TASKS.md`
- Posledni commit pri auditu: `c074ae3d9a24c12c0056c4f3306f40d69937735e` - `UI popisky technickych parametru`
- Hlavni vstup aplikace: `src/main.jsx`
- Hlavni komponenta aplikace: `src/App.jsx`
- Styl aplikace: `src/App.css`, `src/index.css`
- Supabase klient: `src/supabase.js`
- Supabase edge funkce: `supabase/functions/*`
- Build konfigurace: `vite.config.js`, `package.json`

## Hlavni moduly v App.jsx

`src/App.jsx` je aktualne velky soubor s temito castmi:

- konstanty a ciselniky: `emptyChecklist`, `equipmentItems`, `STATUS`
- pomocne funkce: `getUsername`, `clone`, `normalizeArray`, `formatDate`, `prepareCar`, `calculateStatus`, `getWorkflow`
- stav aplikace: seznam aut, vyhledavani, vybrane auto, aktivni view, aktivni modul, prihlaseny uzivatel, formular noveho auta, AI loading stavy
- autentizace: `checkUser`, `signUp`, `signIn`, `signOut`
- datove operace nad autem: `loadCars`, `createCar`, `updateCar`, `saveCarEdit`, `deleteCar`
- soubory a fotky: `uploadFile`, `downloadPhoto`, `addPhoto`, `deletePhoto`, `addTechnicalCardPhoto`, `deleteTechnicalCard`, `addCebiaFile`, `deleteCebiaFile`
- editace detailu auta: checklist, STK, vybava, technicke parametry, naceneni, poznamky
- AI akce: `analyzeVehicleTechnicalData`, `analyzeDocuments`, `analyzeTechnicalProblem`
- UI moduly rizene hodnotou `module`: `technical`, `photos`, `checklist`, `cebiaHistory`, `equipment`, `notes`, `valuation`

## Pravidla vyvoje pro Codex

- Pracuj pouze v `/workspaces/autovykup-app`.
- Nikdy nevytvarej kopii projektu.
- Jedna zmena = jeden ukol.
- Pred kazdou upravou vzdy spust `git status`.
- Po kazde uprave vzdy ukaz `git diff`.
- Pred commitem vzdy spust build.
- Nepushuj na GitHub bez vyslovneho potvrzeni.
- Nemen databazi bez vyslovneho zadani.
- Nemen nesouvisejici casti aplikace.
- Pokud si nejsi jisty, zastav se a zeptej se.
- U UI zmen vzdy uved presne soubory a casti kodu, kterych se zmena tyka.
- Pri existujicich necommitnutych zmenach uzivatele je nerevertuj a nestaguj je bez potvrzeni.
- Commituj pouze soubory, ktere patri k danemu ukolu.

## Doporuceny dalsi architektonicky krok

`src/App.jsx` rozdelovat postupne, bez zmeny chovani a bez soucasneho redesignu UI.

Prvni bezpecny krok:

1. Vyjmout ciste konstanty a pomocne funkce do samostatnych souboru:
   - `src/constants/carWorkflow.js` pro `STATUS`, `emptyChecklist`, `equipmentItems`
   - `src/utils/carData.js` pro `prepareCar`, `calculateStatus`, `getWorkflow`, formatovani dat a validace vyplnenych hodnot
2. Pridat minimalni testy pro funkce `prepareCar`, `calculateStatus` a `isChecklistComplete`, aby dalsi presuny mely kontrolu chovani.
3. Teprve potom oddelovat UI moduly podle hodnoty `module`:
   - `TechnicalModule`
   - `PhotosModule`
   - `ChecklistModule`
   - `CebiaHistoryModule`
   - `EquipmentModule`
   - `NotesModule`
   - `ValuationModule`
4. Datove operace nad Supabase presunout az pozdeji do hooku nebo service vrstvy, napriklad `useCarsRepository`, protoze maji nejvetsi riziko behavioralnich regresi.

Snizeni rizika pri dalsich upravach:

- delat vzdy jeden maly presun bez funkcni zmeny
- po kazdem kroku spustit build
- porovnat `git diff` a overit, ze se nemenila business logika
- pri UI modulech nejdrive jen presunout JSX a predat existujici handlery pres props
- teprve po stabilnim rozdeleni resit zjednoduseni stavu, hooky a testy
