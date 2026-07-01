# Produktová vize AutoVýkup

AutoVýkup je interní databáze nacenění a potenciálních výkupů vozidel. Jejím cílem je sjednotit informace potřebné pro rozhodnutí o výkupu, zrychlit práci obchodníků a postupně propojit výkupní proces se zákaznickými poptávkami.

## Evidence vozidel

Každý záznam vozidla má obsahovat všechny podstatné informace pro rozhodnutí o výkupu:

- základní údaje
- technické parametry
- CEBIA historii
- fotky
- administrativní checklist
- poznámky
- AI technické vyhodnocení
- nacenění
- schválenou výkupní cenu

Evidence vozidel má sloužit jako jedno místo, kde je jasně vidět stav každého potenciálního výkupu, dostupné podklady, rizika, nacenění a obchodní rozhodnutí.

## Zákazníci a poptávky

Druhá hlavní část aplikace bude databáze zákazníků a jejich poptávek. U zákazníka bude možné evidovat, jaký vůz hledá, například značku, model, rozpočet, stáří, nájezd, palivo, převodovku, výbavu a další preference.

Aplikace bude umět porovnat poptávku zákazníka s vozidly v evidenci nacenění. Pokud se vozidlo bude podobat poptávce zákazníka, aplikace zobrazí potenciální shodu, aby obchodník rychle viděl, které výkupy mohou dávat smysl pro konkrétního zákazníka.

## Dlouhodobý cíl

Dlouhodobý cíl je propojit výkup, zákaznické poptávky, AI nacenění a doporučení obchodníkovi. AutoVýkup má postupně fungovat jako pracovní nástroj, který nejen eviduje data, ale také upozorňuje na obchodní příležitosti, rizika a další doporučené kroky.

## Návrh fází

### Fáze 1: dokončení evidence vozidel

- Stabilizovat záznam vozidla a jeho hlavní moduly.
- Dokončit technické parametry, CEBIA historii, fotky, checklist, poznámky a nacenění.
- Zajistit, aby schválená výkupní cena byla jasně oddělená od návrhů a pracovního nacenění.

### Fáze 2: zákazníci a poptávky

- Přidat databázi zákazníků.
- Umožnit evidenci poptávek a preferencí hledaného vozu.
- Navázat zákaznické poptávky na obchodní workflow.

### Fáze 3: párování poptávka ↔ vozidlo

- Porovnávat parametry poptávky s vozidly v evidenci nacenění.
- Zobrazovat potenciální shody mezi zákazníkem a vozidlem.
- Umožnit obchodníkovi rychle vyhodnotit, proč je shoda relevantní.

### Fáze 4: AI doporučení a upozornění

- Zapojit AI do doporučení vhodných výkupů pro konkrétní zákazníky.
- Upozorňovat na nové nebo změněné shody.
- Doporučovat obchodníkovi další krok podle stavu vozidla, poptávky a nacenění.
