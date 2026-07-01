# AutoVýkup - produktová vize

Tento dokument popisuje produktovou vizi projektu AutoVýkup. Vychází z aktuálního stavu repozitáře a z dokumentů `PROJECT.md`, `ARCHITECTURE.md`, `DEVELOPMENT_GUIDE.md`, `ROADMAP.md`, `BACKLOG.md` a `TASKS.md`.

Pokud některá informace není ověřitelná z repozitáře, je označená jako `Nutno ověřit`.

## Proč AutoVýkup vzniká

AutoVýkup vzniká jako interní pracovní nástroj pro profesionálnější a přehlednější řízení výkupu vozidel.

Výkup vozidla není jednorázový formulář. Je to proces, ve kterém se postupně sbírají údaje, fotky, dokumenty, historie, technická zjištění, poznámky a cenové rozhodnutí. Pokud jsou tyto informace roztříštěné mezi chaty, e-maily, složky, tabulky nebo osobní poznámky, roste riziko chyb, zdržení a špatného rozhodnutí.

AutoVýkup má vytvořit jedno pracovní místo, kde výkupčí rychle vidí stav vozidla, chybějící podklady, rizika a další potřebný krok.

## Jaké problémy řeší

### Roztříštěná evidence vozidel

Informace o vozidle mají být na jednom místě. Karta vozidla má obsahovat základní údaje, fotky, dokumenty, technické parametry, CEBIA historii, výbavu, poznámky a nacenění.

### Nejasný stav výkupního procesu

Uživatel má rychle poznat, zda vozidlu chybí podklady, jestli je připravené k nacenění, zda už je nacenění hotové a jestli je cena potvrzená.

### Chybějící nebo neúplné podklady

Aplikace má pomáhat hlídat administrativní checklist, fotky, TP, CEBIA / CarVertical dokumenty a další podklady potřebné pro rozhodnutí.

### Opakovaná ruční práce

Část práce, například čtení dokumentů nebo příprava souhrnu vozidla, může být urychlená AI. AI ale musí zůstat pomocným nástrojem, ne automatickým rozhodovatelem.

### Riziko nekonzistentních rozhodnutí

Jednotný workflow, strukturované informace a historie změn mají snížit závislost na paměti jednotlivce a zlepšit opakovatelnost výkupního procesu.

## Hlavní uživatelé

### Výkupčí

Primární uživatel aplikace. Zakládá vozidla, doplňuje údaje, nahrává fotky a dokumenty, kontroluje podklady, zapisuje poznámky a pracuje s naceněním.

### Vedoucí nebo manažer výkupu

Nutno ověřit. Pravděpodobně potřebuje přehled rozpracovaných vozidel, stavů, rizik, cen a výkonu týmu.

### Administrativa / back office

Nutno ověřit. Může pomáhat s dokumenty, zákaznickými údaji, komunikací nebo kontrolou kompletnosti podkladů.

### Technická kontrola / servisní konzultant

Nutno ověřit. Může doplňovat technické poznámky, rizika, doporučení opravy a kontrolu závad.

## Hlavní cíle projektu

1. Zrychlit a zpřehlednit výkupní proces.
2. Snížit počet chyb způsobených chybějícími nebo roztříštěnými informacemi.
3. Zajistit, aby každé vozidlo mělo jasný stav a další krok.
4. Umožnit práci na mobilu, zejména při focení a kontrole vozidla.
5. Vytvořit základ pro zákaznickou databázi a historii komunikace.
6. Postupně doplnit AI asistenci pro dokumenty, rizika, technické problémy a nacenění.
7. Připravit aplikaci na firemní provoz s rolemi, oprávněními, auditem a statistikami.

## Co není cílem projektu

AutoVýkup nemá být v nejbližší fázi:

- veřejný zákaznický portál,
- plnohodnotný CRM systém pro celou firmu,
- účetní systém,
- skladový systém,
- inzertní platforma,
- automatický rozhodovací systém bez kontroly člověkem,
- náhrada odborného úsudku výkupčího,
- velký komplexní systém budovaný najednou.

Tyto oblasti mohou být v budoucnu integrované nebo rozšířené, ale nesmí ohrozit stabilitu hlavního výkupního workflow.

## Hlavní principy návrhu aplikace

### Mobil jako první praktický kontext

Aplikace se bude často používat při práci s vozidlem. Focení, kontrola checklistu, rychlé poznámky a čtení detailu musí být pohodlné na telefonu.

### Jedna obrazovka má podporovat jeden pracovní záměr

Detail vozidla má být přehledný a rozdělený do logických modulů. Uživatel nemá lovit důležité informace v nepřehledném bloku textu.

### Stabilita před rozšiřováním

Nové funkce se přidávají až ve chvíli, kdy je předchozí změna dokončená, otestovaná a stabilní.

### Data musí být dohledatelná

Důležité změny, zejména ceny, stavy, dokumenty a budoucí zákaznická komunikace, mají být dohledatelné. Audit změn je pro firemní provoz klíčový směr.

### AI má pomáhat, ne rozhodovat

AI může číst dokumenty, navrhovat souhrny, upozorňovat na rizika nebo připravovat orientační doporučení. Finální rozhodnutí musí zůstat na člověku.

### Každá funkce musí mít jasný provozní přínos

Funkce se nepřidává proto, že je technicky zajímavá. Přidává se proto, že zrychlí práci, sníží chyby, zlepší kontrolu nebo podpoří rozhodování.

## Jak budeme rozhodovat o nových funkcích

Nová funkce má projít těmito otázkami:

1. Jaký konkrétní problém řeší?
2. Kterému uživateli pomáhá?
3. Jak často se bude používat?
4. Zrychlí práci nebo sníží riziko chyby?
5. Je nutná teď, nebo patří do `BACKLOG.md`?
6. Dá se rozdělit na menší bezpečné kroky?
7. Mění databázi, oprávnění nebo produkční chování?
8. Je použitelná na mobilu?
9. Jak ji ručně otestujeme?
10. Jak poznáme, že se povedla?

Funkce se přesouvá z `BACKLOG.md` do `TASKS.md` až ve chvíli, kdy je připravená k nejbližší práci.

## Produktové metriky úspěchu

Tuto kapitolu přidáváme proto, aby projekt neměřil úspěch jen počtem funkcí, ale reálným dopadem na práci výkupu.

Možné metriky:

- čas potřebný k založení kompletní karty vozidla,
- počet vozidel s kompletními podklady,
- počet vozidel čekajících na doplnění dokumentů,
- průměrné stáří rozpracovaných případů,
- počet ručních chyb v evidenci,
- počet případů s dohledatelnou historií komunikace,
- rychlost přípravy nacenění,
- podíl vozidel zpracovaných přes mobilní workflow,
- spokojenost interních uživatelů.

Nutno ověřit: konkrétní cílové hodnoty a způsob měření zatím nejsou v repozitáři definované.

## Jak poznáme, že je projekt úspěšný

Projekt je úspěšný, pokud:

- výkupčí běžně používají aplikaci jako hlavní pracovní nástroj,
- u většiny vozidel je jasné, v jakém jsou stavu,
- chybějící podklady jsou viditelné a dohledatelné,
- fotky, dokumenty a poznámky jsou ukládané na jedno místo,
- nacenění má jasný záznam a historii,
- nové funkce nevznikají chaoticky, ale podle roadmapy a úkolů,
- aplikace je použitelná na mobilu,
- firma dokáže zpětně dohledat důležité změny a rozhodnutí,
- AI výstupy šetří čas, ale nejsou nekontrolovaným zdrojem pravdy.

## Dlouhodobá vize na 2-3 roky

### Rok 1: Stabilní interní nástroj

První fáze má udělat z AutoVýkupu stabilní aplikaci pro každodenní evidenci vozidel.

Hlavní směry:

- dokončit dokumentaci,
- stabilizovat aktuální aplikaci,
- zkontrolovat responzivitu,
- sjednotit UI,
- zpřesnit workflow stavů,
- připravit zákaznickou databázi,
- opravit nebo dokončit rozpracované AI funkce.

### Rok 2: Profesionální výkupní workflow

Druhá fáze má rozšířit aplikaci z evidence vozidel na ucelený výkupní proces.

Hlavní směry:

- zákazníci,
- vazba zákazník-vozidlo,
- historie komunikace,
- přílohy a dokumenty,
- audit změn,
- role a oprávnění,
- dashboard rozpracovaných případů.

### Rok 3: Asistovaný a automatizovaný provoz

Třetí fáze má podpořit rychlejší rozhodování, manažerský přehled a integrace.

Hlavní směry:

- AI souhrn vozidla,
- AI rizika a doporučení,
- AI podpora nacenění,
- statistiky,
- upozornění,
- exporty a reporty,
- případné propojení s inzercí nebo dalšími firemními systémy.

## Produktová rizika

Tuto kapitolu přidáváme proto, že dlouhodobě rozvíjená interní aplikace může selhat nejen technicky, ale i produktově.

Hlavní rizika:

- aplikace začne být příliš složitá pro rychlou práci výkupčího,
- nové funkce se budou přidávat bez jasné priority,
- data budou ukládaná nekonzistentně,
- mobilní použití zůstane druhotné,
- AI bude působit důvěryhodněji, než odpovídá kvalitě vstupních dat,
- nebude jasně nastavené, kdo může měnit ceny, stavy a zákaznická data,
- nebude existovat audit důležitých změn,
- projekt se rozroste bez průběžné dokumentace.

## Produktové rozhodovací pravidlo

Pokud existuje konflikt mezi rychlým přidáním nové funkce a stabilitou hlavního výkupního workflow, má přednost stabilita.

Pokud existuje konflikt mezi komplexní funkcí a jednodušším ověřitelným krokem, má přednost jednodušší krok.

Pokud funkce nemá jasného uživatele, jasný problém a jasný testovací checklist, nemá se implementovat. Má zůstat v `BACKLOG.md`, dokud nebude připravená.
