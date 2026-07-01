# AutoVýkup - roadmapa vývoje

Tento dokument popisuje dlouhodobý plán vývoje projektu AutoVýkup. Roadmapa neurčuje přesné datum dokončení, ale pořadí a logiku etap. Každá položka se má před realizací rozpadnout na malé samostatné úkoly podle `DEVELOPMENT_GUIDE.md`.

Priority:

- Vysoká - důležité pro stabilitu, každodenní používání nebo bezpečnost.
- Střední - důležité pro profesionalizaci workflow.
- Nízká - užitečné rozšíření, které nemá blokovat stabilní provoz.

Složitost:

- Malá - lokální změna bez zásahu do více oblastí.
- Střední - změna napříč UI, daty nebo workflow.
- Velká - změna vyžadující architekturu, databázi, oprávnění nebo integrace.

## Verze 1 - Stabilní základ

Cíl: dostat aktuální aplikaci do stabilního, čitelného a bezpečně rozšiřitelného stavu.

| Položka | Priorita | Popis | Složitost |
| --- | --- | --- | --- |
| Stabilizace aplikace | Vysoká | Ověřit aktuální stav aplikace, odstranit známé chyby a zajistit, že hlavní workflow lze bezpečně používat. | Střední |
| Opravy chyb | Vysoká | Řešit konkrétní chyby po jedné, vždy s ručním testovacím checklistem. | Střední |
| Dokončení dokumentace | Vysoká | Doplnit projektovou dokumentaci, vývojová pravidla, roadmapu, aktuální úkoly a changelog. | Malá |
| Sjednocení UI | Střední | Sjednotit formuláře, karty, tlačítka, stavové prvky a prázdné stavy bez změny funkční logiky. | Střední |
| Kontrola responzivity | Vysoká | Projít hlavní obrazovky na mobilní šířce a opravit problémy s čitelností nebo ovládáním. | Střední |

## Verze 2 - Profesionální výkup

Cíl: rozšířit aplikaci z evidence vozidel na profesionální výkupní workflow se zákazníky a komunikací.

| Položka | Priorita | Popis | Složitost |
| --- | --- | --- | --- |
| Workflow stavů vozidel | Vysoká | Zpřesnit a rozšířit stavy vozidel tak, aby odpovídaly reálnému výkupnímu procesu. | Střední |
| Zákaznická databáze | Vysoká | Přidat základní evidenci zákazníků jako samostatný modul. Pravděpodobně vyžaduje nové databázové tabulky. | Velká |
| Propojení zákazníka s vozidlem | Vysoká | Umožnit přiřadit vozidlo ke konkrétnímu zákazníkovi a zobrazovat vazbu v detailu. | Velká |
| Historie komunikace | Střední | Evidovat telefonáty, e-maily, schůzky a důležité komunikační události u zákazníka nebo vozidla. | Velká |
| Poznámky | Střední | Zpřesnit práci s poznámkami, případně oddělit interní poznámky, zákaznické poznámky a technické poznámky. | Střední |
| Přílohy | Střední | Rozšířit správu příloh tak, aby byly přehledně kategorizované a navázané na vozidlo nebo zákazníka. | Střední |

## Verze 3 - AI asistent výkupčího

Cíl: využít AI jako pomocný nástroj pro rychlejší kontrolu, shrnutí a rozhodování, ale ponechat finální odpovědnost člověku.

| Položka | Priorita | Popis | Složitost |
| --- | --- | --- | --- |
| AI nacenění | Střední | Připravit AI podporu pro návrh výkupní a prodejní ceny na základě dat vozidla. Výstup musí být kontrolovaný člověkem. | Velká |
| AI kontrola dokumentů | Vysoká | Stabilizovat a zpřesnit AI čtení TP, CEBIA a dalších dokumentů. | Velká |
| AI rizika modelu | Střední | Doplnit upozornění na modelová, technická nebo historická rizika vozidla. | Velká |
| AI doporučení opravy | Střední | Přidat AI podporu pro odhad možných závad, doporučení kontroly a orientační náročnost opravy. | Střední |
| AI souhrn vozidla | Střední | Vytvořit stručný přehled vozidla pro výkupčího, včetně podkladů, rizik, ceny a dalších kroků. | Střední |

## Verze 4 - Firemní provoz

Cíl: připravit aplikaci pro stabilní používání více lidmi, s řízením oprávnění a manažerským přehledem.

| Položka | Priorita | Popis | Složitost |
| --- | --- | --- | --- |
| Více uživatelů | Vysoká | Ověřit a doplnit podporu více reálných uživatelů včetně vazby na vytvořil/upravil. | Střední |
| Role a oprávnění | Vysoká | Zavést role, oprávnění a pravidla přístupu k datům. Vyžaduje návrh bezpečnostního modelu a pravděpodobně RLS. | Velká |
| Audit změn | Vysoká | Evidovat důležité změny u vozidel, zákazníků, cen, stavů a AI výstupů. | Velká |
| Dashboard | Střední | Přidat přehled rozpracovaných vozidel, čekajících úkolů a důležitých stavů. | Střední |
| Statistiky | Nízká | Doplnit základní statistiky výkupu, nacenění, dokončení a prodeje. | Střední |
| Upozornění | Střední | Přidat upozornění na neúplné podklady, staré případy, chybějící komunikaci nebo blížící se termíny. | Střední |

## Verze 5 - Automatizace

Cíl: zrychlit opakované činnosti, propojit aplikaci s dalšími systémy a připravit pravidelné výstupy.

| Položka | Priorita | Popis | Složitost |
| --- | --- | --- | --- |
| Import vozidel | Střední | Umožnit hromadný import vozidel ze souboru nebo jiného zdroje. | Velká |
| Export | Střední | Přidat export vozidel, zákazníků nebo reportů do praktického formátu. | Střední |
| Propojení s inzercí | Nízká | Připravit integraci s inzertními portály nebo interním prodejním workflow. | Velká |
| Automatické připomínky | Střední | Automaticky upozorňovat na nedokončené kroky, staré případy a chybějící podklady. | Velká |
| Automatické reporty | Nízká | Generovat pravidelné reporty pro vedení nebo provoz výkupu. | Velká |

## Princip vývoje

Vývoj AutoVýkupu musí postupovat po malých, bezpečných krocích.

Pravidla:

- Vždy se realizuje pouze jedna malá funkce nebo jedna logická změna.
- Každá změna musí být dokončená, zkontrolovaná a otestovaná.
- Nová funkce nezačne dříve, než je předchozí změna stabilní.
- Pokud se objeví chyba, nejdřív se opraví chyba a až potom se pokračuje v dalším vývoji.
- Větší moduly se dělí na etapy, které lze samostatně ověřit.
- Databázové změny se provádějí pouze vědomě, s přesným SQL a testovacím postupem.
- AI funkce jsou pomocné a jejich výstupy musí být ručně ověřitelné.
- Mobilní použitelnost je součástí definice hotové změny.
