# Marketing Engine

Status: Návrh  
Datum: 2026-07-06  
Účel: Architektonická specifikace budoucího modulu Marketing Engine

## 1. Účel modulu

Marketing Engine bude vytvářet prodejní a marketingové výstupy z dat jednoho vozidla.

Základní princip: jedna informace se zadává pouze jednou a používá se ve více výstupech.

Modul bude sloužit pro A4 kartu za okno, PDF pro zákazníka, inzeráty, sociální sítě a další marketingové materiály.

## 2. Hlavní pravidlo

> Jednou vyplnit, všude použít.

## 3. Vstupní data

Marketing Engine bude čerpat pouze z existujících a ověřených dat vozidla. Vstupní data budou pocházet zejména z těchto oblastí:

- základní údaje vozidla
- technické parametry
- výbava
- fotografie
- cena
- CEBIA / historie
- poškození / známé vady
- náklady a ekonomika
- příprava pro inzerci
- hlavní přednosti
- kontaktní údaje firmy

## 4. Výstupy Marketing Engine

### A) Dokumenty

- A4 karta za okno
- PDF pro zákazníka
- interní prodejní list
- předávací protokol

### B) Inzerce

- Sauto
- TipCars
- Omnio
- firemní web

### C) Sociální sítě

- Facebook příspěvek
- Instagram příspěvek
- Instagram Stories

### D) AI texty

- krátký prodejní text
- dlouhý prodejní text
- slogan vozu
- hlavní výhody
- SEO nadpis

## 5. A4 karta za okno

A4 karta za okno je první prioritní výstup Marketing Engine. Má sloužit jako rychlý, přehledný a důvěryhodný prodejní materiál přímo u vystaveného vozu.

Karta má obsahovat:

- logo Opportunity
- kontaktní údaje
- název vozu
- motorizaci/verzi
- prodejní cenu
- hlavní fotografii
- základní parametry
- základní informace
- technické parametry
- výbavu ve zkráceném výběru
- hlavní přednosti vozu
- důvěryhodnostní body:
  - pravidelný servis
  - bez nehod / transparentní historie, pokud je pravdivé
  - CEBIA / ověřená historie
  - prověřený stav
- QR kód na detail vozu
- patičku firmy

## 6. Pravidla pro A4 kartu

- Vždy jedna hlavní fotografie.
- Cena musí být výrazná.
- Maximálně 10-15 položek výbavy.
- Maximálně 5 hlavních předností.
- Dlouhé texty se nepoužívají.
- Pokud údaj chybí, nezobrazovat prázdné pole.
- Vše musí být pravdivé.
- Pokud je vůz poškozený nebo má známou vadu, nesmí se v marketingu tvářit jako bezvadný.
- PDF se negeneruje pomocí AI layoutu, ale z pevné šablony.
- AI smí pomoci s výběrem předností a textů, ale nesmí měnit fakta.

## 7. Architektura

Aktuální základní architektura modulu:

```text
src/marketing/
  index.js
  mapper/
    buildMarketingVehicle.js
  templates/
    opportunity-classic/
      OpportunityClassic.jsx
      OpportunityClassic.css
  components/
    MarketingActions.jsx
    MarketingReadinessScore.jsx
```

### Data mapper

`buildMarketingVehicle(selectedCar)` je mezivrstva mezi interním objektem auta a marketingovými šablonami.

Mapper převádí data z `selectedCar` na jednotný marketingový objekt:

```js
{
  title,
  subtitle,
  price,
  heroImage,
  vin,
  specs,
  technical,
  equipment,
  highlights,
  guarantees,
  condition,
  contact,
  readiness
}
```

Šablony nesmí přímo řešit složitou strukturu auta, historické názvy polí ani fallbacky. Tyto věci patří do mapperu.

Mapper zároveň hlídá pravdivost marketingu:

- pokud údaj chybí, použije bezpečný fallback,
- pokud existují známé vady nebo poškození, nepoužije tvrzení typu „bez nehod“,
- výbavu omezuje na rozumný počet položek,
- hlavní přednosti vybírá jen z dostupných dat.

### Šablony

Marketingové šablony jsou oddělené od dat. Každá šablona přijímá jednotný marketingový objekt a řeší pouze layout daného výstupu.

První oficiální šablona:

- `OpportunityClassic`

`OpportunityClassic` je základní A4 karta za okno vozu ve stylu Opportunity. Vzhled je připravený jako foundation a bude se dál ladit podle finálního schváleného template.

### Komponenty

`MarketingActions` řeší akce nad aktuální šablonou:

- tisk karty,
- stažení karty jako HTML.

`MarketingReadinessScore` zobrazuje jednoduchou připravenost marketingových dat a seznam chybějících bodů.

## 8. Technický princip

Marketingové výstupy se nemají ručně ukládat jako statické PDF, pokud to není nutné.

Mají se generovat vždy z aktuálních dat vozidla. Tím se zabrání starým cenám a neaktuálním informacím.

Později může aplikace nabídnout náhled, stažení PDF a tisk.

## 9. Priorita implementace

1. A4 karta za okno
2. PDF pro zákazníka
3. Text inzerátu Sauto/TipCars
4. Facebook příspěvek
5. Instagram příspěvek
6. Instagram Stories

## 10. Rizika

- Nepravdivé údaje v marketingu: výstupy musí vycházet pouze z ověřených dat a nesmí vylepšovat fakta.
- Příliš mnoho textu na A4: karta musí zůstat rychle čitelná a prodejně účinná.
- Chybějící fotografie: bez kvalitní hlavní fotografie bude výstup působit nedůvěryhodně.
- Neaktuální cena: marketingové materiály se musí generovat z aktuální ceny vozidla.
- Příliš složitý design: šablony musí být pevné, přehledné a snadno tisknutelné.
- Nekonzistentní data: stejný vůz nesmí mít v různých výstupech rozdílné parametry, cenu nebo výbavu.

## 11. Stav dokumentu

Tento dokument je návrh architektonické specifikace. Neobsahuje implementaci, výběr knihoven pro PDF, změny Supabase ani návrh databázových migrací.
