# AutoVýkup - backlog nápadů

Backlog obsahuje všechny známé nápady. Položka se přesouvá do `TASKS.md` teprve ve chvíli, kdy se na ní začne aktivně pracovat.

Stavy:

- Nápad - zatím pouze návrh nebo možnost.
- Připraveno - položka je dostatečně jasná pro rozpad na konkrétní úkol.
- Čeká - položka závisí na jiné etapě, rozhodnutí, datech nebo ověření.

## UI / UX

| Název | Priorita | Stav | Poznámka |
| --- | --- | --- | --- |
| Sjednotit vzhled formulářů | Střední | Nápad | Formuláře mají držet konzistentní pořadí labelů, inputů a nápověd. |
| Zlepšit prázdné stavy | Střední | Nápad | Například prázdný seznam vozidel, chybějící fotky nebo žádné poznámky. |
| Zpřehlednit detail vozidla | Vysoká | Nápad | Detail vozidla je hlavní pracovní obrazovka a musí být rychle čitelný. |
| Sjednotit tlačítka a akce | Střední | Nápad | Primární, sekundární a destruktivní akce mají být vizuálně jasné. |
| Přidat potvrzovací a chybové stavy | Střední | Nápad | Ukládání, chyby a dokončené akce mají být pro uživatele srozumitelné. |

## Evidence vozidel

| Název | Priorita | Stav | Poznámka |
| --- | --- | --- | --- |
| Zpřesnit workflow stavů vozidel | Vysoká | Připraveno | Navazuje na existující stavy vozidla a bude vyžadovat přesné zadání procesu. |
| Přidat filtr podle stavu | Střední | Nápad | Umožní rychle najít vozidla podle aktuální fáze výkupu. |
| Přidat řazení seznamu vozidel | Střední | Nápad | Například podle data vytvoření, poslední úpravy nebo stavu. |
| Přidat archiv vozidel | Střední | Čeká | Nutno rozhodnout, zda archiv znamená nový stav, nový sloupec nebo samostatný pohled. |
| Zlepšit validaci VIN a SPZ | Střední | Nápad | Validace musí být praktická a nesmí blokovat výjimky bez důvodu. |

## Zákazníci

| Název | Priorita | Stav | Poznámka |
| --- | --- | --- | --- |
| Zákaznická databáze | Vysoká | Čeká | Vyžaduje návrh databázové struktury a SQL. |
| Detail zákazníka | Vysoká | Čeká | Navazuje na základní zákaznickou databázi. |
| Propojení zákazníka s vozidlem | Vysoká | Čeká | Vyžaduje jasnou vazbu mezi tabulkami zákazníků a vozidel. |
| Historie komunikace se zákazníkem | Střední | Čeká | Pravděpodobně samostatná tabulka nebo strukturovaný záznam. |
| Poznámky k zákazníkovi | Střední | Čeká | Musí být oddělené od poznámek k vozidlu, pokud to workflow potvrdí. |

## AI funkce

| Název | Priorita | Stav | Poznámka |
| --- | --- | --- | --- |
| Stabilizovat AI kontrolu dokumentů | Vysoká | Připraveno | Existuje napojení na Edge Functions, ale je potřeba ověřit spolehlivost a výstupy. |
| Dokončit AI technického poradce | Vysoká | Připraveno | Frontend funkci volá, ale odpovídající Edge Function je podle projektu prázdná. |
| AI nacenění vozidla | Střední | Čeká | Vyžaduje datový základ, pravidla a ruční kontrolu výstupu. |
| AI rizikové vlajky | Střední | Nápad | Upozornění na rizika z historie, dokumentů nebo technického stavu. |
| AI souhrn vozidla | Střední | Nápad | Krátké shrnutí pro výkupčího před rozhodnutím. |

## Dokumenty

| Název | Priorita | Stav | Poznámka |
| --- | --- | --- | --- |
| Zpřehlednit přílohy u vozidla | Střední | Nápad | Rozdělit nebo lépe popsat TP, CEBIA a další dokumenty. |
| Přidat typ dokumentu | Střední | Čeká | Pravděpodobně vyžaduje úpravu datového modelu. |
| Zlepšit náhled PDF dokumentů | Střední | Nápad | Nutno ověřit technické možnosti a mobilní použitelnost. |
| Přidat kontrolu chybějících dokumentů | Vysoká | Nápad | Pomůže před naceněním ověřit kompletnost podkladů. |
| Historie nahraných dokumentů | Nízká | Čeká | Pravděpodobně souvisí s auditem změn. |

## Fotografie

| Název | Priorita | Stav | Poznámka |
| --- | --- | --- | --- |
| Zlepšit mobilní focení vozidla | Vysoká | Nápad | Focení je klíčové pro práci v terénu. |
| Přidat kategorie fotek | Střední | Čeká | Například exteriér, interiér, poškození, doklady. Vyžaduje návrh dat. |
| Zlepšit náhled galerie | Střední | Nápad | Galerie má být pohodlná na mobilu i desktopu. |
| Přidat mazání souborů ze Storage | Střední | Čeká | Nutno ověřit bezpečný postup, aby se nerozbily odkazy. |
| Povinný foto checklist | Střední | Nápad | Pomůže hlídat kompletnost fotodokumentace. |

## Nacenění

| Název | Priorita | Stav | Poznámka |
| --- | --- | --- | --- |
| Zpřesnit nacenění vozidla | Vysoká | Nápad | Současné hodnoty je možné evidovat, ale workflow může potřebovat více pravidel. |
| Přidat schvalování ceny | Vysoká | Čeká | Nutno rozhodnout role a oprávnění. |
| Historie změn ceny | Střední | Čeká | Pravděpodobně souvisí s auditem změn. |
| Marže a očekávaný zisk | Střední | Nápad | Může dopočítávat rozdíl mezi výkupní a prodejní cenou. |
| AI návrh ceny | Střední | Čeká | Musí být pouze pomocný a ručně kontrolovaný. |

## Statistiky

| Název | Priorita | Stav | Poznámka |
| --- | --- | --- | --- |
| Dashboard rozpracovaných vozidel | Střední | Nápad | Přehled vozidel podle stavu a stáří případu. |
| Statistiky výkupu | Nízká | Nápad | Počet vozidel, dokončené případy, průměrná doba zpracování. |
| Statistiky nacenění | Nízká | Nápad | Přehled výkupních a prodejních cen. |
| Přehled chybějících podkladů | Střední | Nápad | Praktické pro každodenní kontrolu. |
| Report pro vedení | Nízká | Čeká | Závisí na tom, jaké metriky firma skutečně potřebuje. |

## Administrace

| Název | Priorita | Stav | Poznámka |
| --- | --- | --- | --- |
| Role a oprávnění | Vysoká | Čeká | Vyžaduje návrh bezpečnostního modelu a Supabase RLS. |
| Audit změn | Vysoká | Čeká | Důležité pro ceny, stavy a citlivé změny. |
| Správa uživatelů | Střední | Čeká | Nutno ověřit, jak se mají uživatelé zakládat a spravovat. |
| Nastavení checklistů | Nízká | Nápad | Umožnilo by upravovat položky bez zásahu do kódu. |
| Produkční bezpečnostní kontrola | Vysoká | Připraveno | Ověřit RLS, Storage policies, Edge Functions a secrets. |

## Integrace

| Název | Priorita | Stav | Poznámka |
| --- | --- | --- | --- |
| Import vozidel | Střední | Čeká | Nutno určit zdroj dat a formát. |
| Export vozidel | Střední | Nápad | Například CSV nebo interní report. |
| Propojení s inzercí | Nízká | Čeká | Vyžaduje výběr cílové platformy a API. |
| Propojení s účetnictvím | Nízká | Nápad | Zatím pouze budoucí možnost. |
| Webhooky pro automatizace | Nízká | Nápad | Možné využití po stabilizaci hlavního workflow. |

## Mobilní použití

| Název | Priorita | Stav | Poznámka |
| --- | --- | --- | --- |
| Mobilní kontrola detailu vozidla | Vysoká | Připraveno | Detail vozidla je hlavní pracovní obrazovka. |
| Mobilní optimalizace formulářů | Vysoká | Nápad | Inputy, labely a tlačítka musí být pohodlné na telefonu. |
| Mobilní upload fotek | Vysoká | Nápad | Klíčové pro práci v terénu. |
| Rychlé akce na mobilu | Střední | Nápad | Například přidat fotku, poznámku nebo změnit stav. |
| Kontrola dlouhých textů na mobilu | Střední | Nápad | AI reporty a poznámky nesmí rozbíjet layout. |

## Budoucí nápady

| Název | Priorita | Stav | Poznámka |
| --- | --- | --- | --- |
| Automatické připomínky | Střední | Čeká | Závisí na stavech, termínech a rolích. |
| Automatické reporty | Nízká | Čeká | Vhodné až po zavedení statistik. |
| Interní notifikace | Střední | Nápad | Upozornění na změny, chybějící podklady nebo staré případy. |
| Více provozoven | Nízká | Čeká | Nutno ověřit, zda firma potřebuje oddělovat data podle poboček. |
| Veřejný výkupní formulář | Nízká | Nápad | Možný budoucí vstup pro zákazníky, oddělený od interní aplikace. |
