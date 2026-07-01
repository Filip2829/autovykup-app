# AutoVýkup - aktuální úkoly

## Pravidla

- `TASKS.md` obsahuje pouze úkoly, na kterých se bude pracovat v nejbližší době.
- Větší nápady patří do `BACKLOG.md`.
- Každý úkol musí být malý, bezpečný a otestovatelný.
- Jeden úkol = jedna změna.
- Nový úkol se nezačíná, dokud předchozí není hotový nebo odložený.

## Stav úkolů

Používané stavy:

- Připraveno
- Rozpracováno
- Hotovo
- Odloženo

## Pracovní seznam

| ID | Název úkolu | Priorita | Stav | Mění databázi? | Testovací checklist | Poznámka |
| --- | --- | --- | --- | --- | --- | --- |
| T-001 | Zkontrolovat vývojové prostředí a build | Vysoká | Připraveno | Ne | Ověřit dostupnost Node/npm; spustit lint; spustit build; zapsat případná omezení prostředí. | Cílem je vědět, jak spolehlivě lokálně ověřovat další změny. |
| T-002 | Vytvořit ARCHITECTURE.md | Vysoká | Připraveno | Ne | Ověřit aktuální strukturu souborů; popsat frontend; popsat Supabase napojení; označit neověřené části jako Nutno ověřit. | Dokument má doplnit detailnější technický pohled vedle PROJECT.md. |
| T-003 | Vytvořit CHANGELOG.md | Vysoká | Připraveno | Ne | Vytvořit soubor; založit sekci Unreleased; zapsat dosavadní dokumentační změny; ověřit čitelnost formátu. | Changelog bude sloužit pro historii změn před commity a deployem. |
| T-004 | Zkontrolovat responzivitu hlavních obrazovek | Vysoká | Připraveno | Ne | Otevřít přihlášení; seznam vozidel; detail vozidla; technické parametry; fotky; administrativu; nacenění; ověřit mobilní šířku. | Úkol je pouze kontrolní; případné opravy se mají rozepsat jako samostatné úkoly. |
| T-005 | Připravit návrh workflow stavů vozidla | Střední | Připraveno | Ne | Projít aktuální stavy; navrhnout cílové stavy; popsat přechody; určit, zda bude potřeba SQL; neimplementovat bez potvrzení. | Návrh má předcházet jakékoliv změně stavů v aplikaci nebo databázi. |
| T-006 | Připravit návrh zákaznické databáze | Střední | Připraveno | Ano | Popsat potřebná pole zákazníka; navrhnout vazbu na vozidlo; připravit SQL návrh; uvést rizika; počkat na potvrzení. | Jde jen o návrh; implementace databáze musí být samostatný potvrzený úkol. |
