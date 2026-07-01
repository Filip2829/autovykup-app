# AutoVykup - Master Workflow v2 pro Codex

Tento dokument urcuje zavazny postup pro dalsi praci s Codexem v projektu AutoVykup.
Cilem je delat male, citelne a overitelne zmeny bez zmatku mezi lokalnim projektem,
GitHubem a Vercel.

## A) Zakladni pravidla

- Pracovat pouze v `C:\Users\filip.kralik\Documents\autovykup-app`.
- Nepouzivat GitHub Codespaces.
- Nikdy nevytvaret kopii projektu.
- Jedna zmena = jeden maly ukol.
- Nemenit nesouvisejici casti aplikace.
- Nemenit databazi bez vyslovneho schvaleni uzivatele.
- Nepushovat bez potvrzeni uzivatele.
- Pri existujicich necommitnutych zmenach uzivatele je nerevertovat a nestagovat bez potvrzeni.
- Commitovat pouze soubory, ktere patri k danemu ukolu.

## B) Povinny postup pred kazdou zmenou

Pred jakoukoliv upravou musi Codex spustit:

```powershell
pwd
git status
git log --oneline -5
git rev-parse --show-toplevel
```

Kontrola musi potvrdit:

- projekt bezi lokalne v `C:\Users\filip.kralik\Documents\autovykup-app`
- nejde o GitHub Codespaces ani jinou kopii projektu
- jsou zname aktualni necommitnute soubory
- dalsi zmena je dost mala a presne ohranicena

## C) Povinny postup po zmene

Po kazde zmene musi Codex:

```powershell
git status --short
git diff
npm.cmd run build
```

Pravidla po buildu:

- vypsat zmenene soubory
- ukazat konkretni `git diff`
- pokud build selze, necommitovat
- pokud build projde, navrhnout commit
- nepushovat bez dalsiho potvrzeni uzivatele

## D) Doporuceny vyvojovy cyklus

1. Codex udela jednu malou zmenu.
2. Codex ukaze zmenene soubory, diff a vysledek buildu.
3. Uzivatel otestuje aplikaci na `localhost:5173`.
4. Uzivatel potvrdi, ze zmena je v poradku.
5. Codex vytvori commit.
6. Uzivatel potvrdi push.
7. Codex pushne zmenu.
8. Overi se Vercel deployment.

## E) Pravidla pro UI zmeny

- Nejdriv najit presny modul, ktery se ma menit.
- Upravovat pouze dany modul a souvisejici styly.
- Nemenit texty, logiku ani rozlozeni mimo zadany modul.
- U vetsich zmen preferovat refaktor do komponent misto dalsiho zvetsovani `src/App.jsx`.
- Vzdy ukazat konkretni `git diff`.
- Pokud UI zmena muze ovlivnit data nebo workflow, zastavit se a vyzadat potvrzeni.

## F) Doporucena architektura do budoucna

`src/App.jsx` rozdelovat postupne a po malych krocich bez soucasne zmeny chovani.

Doporucene poradi:

1. Zacit modulem `TechnicalParameters`.
2. Potom oddelit `CebiaHistory`.
3. Potom oddelit `Notes`.
4. Potom oddelit `Valuation`.

Pravidla pro sdilene casti:

- spolecne definice poli davat do `src/data`
- helper funkce davat do `src/utils`
- presuny delat bez zmeny business logiky
- po kazdem kroku spustit `npm.cmd run build`
- pri vetsim presunu pridat nebo upravit testy tam, kde to snizi riziko regresi
