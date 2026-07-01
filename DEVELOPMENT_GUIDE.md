# AutoVýkup - vývojový návod

Tento dokument je závazný návod pro všechny budoucí změny v projektu AutoVýkup. Každá změna má být malá, čitelná, ověřitelná a v souladu s aktuálním stavem projektu popsaným v `PROJECT.md`.

## 1. Filozofie projektu

### Stabilita má přednost před novými funkcemi

AutoVýkup je interní pracovní aplikace. Je důležitější, aby spolehlivě fungovaly existující workflow, než aby rychle přibývaly nové funkce. Pokud je aplikace v rozbitém nebo neověřeném stavu, nejdřív se opravuje tento stav.

### Jednoduchost

Řešení má být co nejjednodušší, ale ne zjednodušené na úkor bezpečnosti nebo čitelnosti. Nové abstrakce se přidávají pouze tehdy, když řeší skutečný problém nebo snižují opakování.

### Čitelnost

Kód i dokumentace mají být srozumitelné pro další vývoj. Názvy funkcí, proměnných a souborů mají popisovat skutečný účel. Komentáře se používají jen tam, kde pomáhají pochopit složitější část.

### Mobilní použití

Aplikace se bude často používat na telefonu. Každá nová funkce nebo úprava UI musí být použitelná na mobilu, zejména ve workflow detailu vozidla, focení, administrativy a poznámek.

### Profesionální kvalita

Výstup má působit jako interní profesionální nástroj: konzistentní, klidný, čitelný a bez náhodných změn vzhledu. UI změny musí respektovat existující styl aplikace.

## 2. Pravidla práce s Codexem

### Jeden úkol = jedna změna

Každý úkol má řešit jednu jasnou změnu. Nesmí se spojovat více nesouvisejících úprav do jednoho zadání.

Příklad správného rozsahu:

- opravit ukládání poznámky,
- přidat jeden nový sloupec s přesným SQL,
- upravit mobilní rozložení jedné obrazovky,
- vytvořit jeden dokument.

Příklad špatného rozsahu:

- předělat celý detail vozidla a zároveň přidat zákazníky,
- opravit AI, změnit databázi a upravit design najednou,
- refaktorovat aplikaci bez konkrétního cíle.

### Žádné zbytečné refaktoringy

Codex nemá refaktorovat kód jen proto, že by šel napsat jinak. Refaktoring je povolený pouze tehdy, když:

- je přímo nutný pro splnění úkolu,
- snižuje konkrétní riziko,
- odstraňuje jasnou duplicitu,
- byl výslovně odsouhlasený.

### Před změnou analyzovat existující kód

Před implementací musí Codex nejdřív projít relevantní soubory a pochopit aktuální řešení. Nemá hádat strukturu projektu ani vytvářet nový styl mimo existující aplikaci.

Minimálně se ověřuje:

- kde je řešená funkce implementovaná,
- jaký datový model používá,
- jak se ukládá do Supabase,
- jak vypadá související UI,
- jestli existuje mobilní chování.

### Nezasahovat do nesouvisejících částí aplikace

Změna se má dotknout pouze souborů a částí kódu, které jsou nutné pro daný úkol. Codex nesmí opravovat, přepisovat ani "vylepšovat" okolní kód bez zadání.

## 3. Standardní workflow každého úkolu

Každý vývojový úkol má probíhat v tomto pořadí.

### 1. Analýza

Codex nejdřív zjistí:

- jak je aktuální funkce postavená,
- které soubory jsou relevantní,
- zda úkol mění frontend, databázi, Supabase, Edge Functions nebo jen dokumentaci,
- jaká jsou rizika.

### 2. Návrh

Před větší změnou má Codex stručně popsat:

- cíl změny,
- rozsah změny,
- které soubory pravděpodobně upraví,
- zda je potřeba SQL,
- jak se bude změna testovat.

U malých jasných změn může být návrh krátký, ale cíl musí být zřejmý.

### 3. Implementace

Implementace má být co nejmenší. Codex má zachovat existující styl projektu, názvosloví a datové struktury.

Při implementaci platí:

- neměnit nesouvisející kód,
- nepřidávat knihovny bez důvodu,
- neměnit databázi bez výslovného odsouhlasení,
- neodstraňovat existující funkce bez zadání,
- udržet mobilní použitelnost.

### 4. Kontrola

Po implementaci Codex ověří:

- `git diff`,
- změněné soubory,
- zda nevznikla nechtěná změna v kódu,
- zda je změna v souladu se zadáním.

Pokud lze spustit lokální kontrolu, použije se podle dostupnosti prostředí:

- lint,
- build,
- lokální spuštění aplikace,
- ruční ověření v prohlížeči.

Pokud kontrola nejde spustit kvůli prostředí, Codex to výslovně uvede.

### 5. Testovací checklist

Každá změna musí mít ruční testovací checklist. Checklist má být konkrétní a ověřitelný.

Příklad:

- Přihlásit se.
- Otevřít seznam vozidel.
- Otevřít detail vozidla.
- Přejít do upraveného modulu.
- Provést změněnou akci.
- Obnovit stránku.
- Zkontrolovat, že data zůstala uložená.
- Ověřit rozložení na mobilní šířce.

### 6. Commit message

Po dokončení změny Codex doporučí jednoduchou commit zprávu. Commit zpráva má být krátká, konkrétní a v angličtině.

Příklady:

- `add project overview documentation`
- `add development guide`
- `fix vehicle note saving`
- `improve vehicle detail mobile layout`
- `add customer database base structure`

## 4. Pravidla pro databázi

### Žádná změna databáze bez SQL

Pokud změna vyžaduje nový sloupec, tabulku, index, policy, trigger nebo úpravu existující struktury, Codex musí dodat přesný SQL příkaz.

Bez SQL se databázová změna nepovažuje za připravenou.

### SQL vždy přiložit

SQL musí být uvedené přímo v odpovědi nebo v samostatném migračním souboru, pokud bude takový postup zaveden.

SQL musí obsahovat:

- co se mění,
- proč se to mění,
- přesný příkaz,
- případné riziko pro existující data,
- ruční ověření po provedení.

### Neměnit existující strukturu bez důvodu

Existující tabulky a sloupce se nesmí přejmenovávat, mazat ani měnit typy bez jasného důvodu a odsouhlasení.

Před změnou existující struktury je nutné uvést:

- dopad na aktuální data,
- dopad na frontend,
- dopad na Supabase policies,
- rollback nebo bezpečný návratový postup, pokud je relevantní.

### Nutno ověřit produkční nastavení

Repozitář aktuálně neobsahuje úplné databázové migrace. Proto je před každou DB změnou nutné ověřit skutečný stav v Supabase.

## 5. Pravidla pro React

### Zachovat styl projektu

Nový kód má navazovat na aktuální styl aplikace. Pokud je funkce v `src/App.jsx`, změna má být nejdřív provedena konzervativně tam, pokud není výslovně cílem oddělit komponenty.

### Nepřidávat knihovny bez důvodu

Nová knihovna je povolená pouze tehdy, když:

- řeší jasný problém,
- není rozumně nahraditelná existujícím řešením,
- nezvyšuje zbytečně složitost,
- je uvedeno, proč je potřeba.

### Znovu používat existující komponenty a vzory

Před vytvořením nového UI řešení se má Codex podívat, zda už v aplikaci existuje podobný vzor:

- karta,
- formulář,
- tlačítko,
- upload,
- checklist,
- modul detailu vozidla,
- mobilní breakpoint.

### Minimální zásahy

React změna má být co nejmenší. Nemá se měnit struktura celé komponenty, pokud úkol řeší jen jednu část UI nebo jeden handler.

### Mobilní kontrola

Každá UI změna musí uvést, jak ji ověřit na mobilní šířce. Zvláštní pozornost patří:

- formulářům,
- tlačítkům,
- kartám,
- uploadům,
- dlouhým textům,
- detailu vozidla.

## 6. Testování

Před dokončením každé změny musí Codex uvést:

### Co otestovat

Konkrétní části aplikace, kterých se změna týká.

Příklad:

- přihlášení,
- založení vozidla,
- editace detailu,
- nahrání fotky,
- uložení checklistu,
- spuštění AI funkce,
- mobilní rozložení.

### Jak změnu ověřit

Kroky musí být napsané tak, aby je šlo ručně projít v aplikaci.

Příklad:

- Přihlásit se.
- Otevřít detail vozidla.
- Upravit hodnotu.
- Obnovit stránku.
- Zkontrolovat uloženou hodnotu.

### Jaká jsou rizika

Codex musí uvést známá rizika, například:

- změna ukládá data do Supabase,
- změna ovlivňuje existující vozidla,
- změna je pouze vizuální,
- změna nebyla lokálně ověřena kvůli omezení prostředí,
- AI výstup musí být ručně zkontrolován.

## 7. Git

### Doporučený formát commit zpráv

Commit zprávy mají být krátké, věcné a v angličtině.

Doporučený formát:

`<verb> <area or object>`

Příklady:

- `add development guide`
- `add project overview documentation`
- `fix photo preview layout`
- `improve vehicle detail mobile layout`
- `add customer database base structure`
- `fix technical problem analysis function`

### Malé commity

Commit má obsahovat malou logickou změnu. Dokumentace, UI úprava, databázová změna a AI funkce se nemají míchat do jednoho commitu, pokud nejde o jednu neoddělitelnou změnu.

### Jeden commit = jedna logická změna

Jeden commit má odpovídat jednomu úkolu. Pokud se během práce objeví další problém, má se zapsat jako nový úkol a řešit samostatně.

### Před commitem

Před doporučením commitu musí Codex uvést:

- změněné soubory,
- shrnutí změny,
- zda byl změněn kód aplikace,
- zda je potřeba SQL,
- testovací checklist,
- případné omezení ověření.

## 8. Zakázané postupy

V projektu AutoVýkup jsou zakázané tyto postupy:

- Přepisovat velké části aplikace bez výslovného zadání.
- Měnit databázi bez odsouhlasení a přesného SQL.
- Provádět rozsáhlé refaktoringy jako součást malé změny.
- Odstraňovat funkce bez zadání.
- Vytvářet duplicitní funkce, moduly nebo datové struktury.
- Přidávat knihovny jen kvůli pohodlí.
- Měnit produkční chování bez ručního testovacího checklistu.
- Pokračovat ve vývoji přes známou chybu, která brání ověření úkolu.
- Měnit nesouvisející soubory.
- Měnit bezpečnostní nastavení Supabase bez samostatného odsouhlasení.
- Nahrazovat ověřitelný stav projektu domněnkami.

## Checklist před každou změnou

Codex si má před každou změnou projít tento checklist:

- Je cíl změny jasně popsaný?
- Jde opravdu o jeden úkol a jednu logickou změnu?
- Prošel jsem relevantní soubory?
- Odpovídá změna `PROJECT.md`?
- Zasahuji jen do nutných souborů?
- Neměním databázi bez SQL a odsouhlasení?
- Nepřidávám knihovnu bez jasného důvodu?
- Zachovávám existující styl React aplikace?
- Je změna použitelná na mobilu?
- Mám připravený ruční testovací checklist?
- Umím uvést rizika a omezení ověření?
- Mám jednoduchou doporučenou commit zprávu?
