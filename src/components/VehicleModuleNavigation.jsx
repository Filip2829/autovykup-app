import {
  Camera,
  ClipboardCheck,
  ClipboardList,
  FileText,
  MessageCircle,
  Bot,
  Search,
  ShieldCheck,
  Star,
  UserRound,
  WalletCards,
} from "lucide-react";

const valuationModules = [
  {
    key: "identification",
    title: "Základní identifikace vozu",
    description: "Značka, model, VIN, SPZ, rok a nájezd",
    icon: Search,
  },
  {
    key: "customer",
    title: "Zákazník",
    description: "Kontaktní údaje osoby nabízející vůz",
    icon: UserRound,
  },
  {
    key: "checklist",
    title: "Dokumenty a AI načtení",
    description: "CEBIA, technický průkaz a ostatní podklady",
    icon: FileText,
  },
  {
    key: "technical",
    title: "Technické parametry",
    description: "Strukturované technické údaje vozidla",
    icon: ClipboardList,
  },
  {
    key: "damage",
    title: "Poškození a stav",
    description: "Kontrola vozu, známé vady a odhad oprav",
    icon: ShieldCheck,
  },
  {
    key: "photos",
    title: "Fotografie",
    description: "Fotodokumentace aktuálního stavu vozu",
    icon: Camera,
  },
  {
    key: "notes",
    title: "Poznámky",
    description: "Interní poznámky k případu",
    icon: MessageCircle,
  },
  {
    key: "valuation",
    title: "Nacenění",
    description: "Návrhy cen a potvrzená výkupní cena",
    icon: WalletCards,
  },
  {
    key: "aiAssistant",
    title: "AI Asistent",
    description: "Bezpečný souhrn uložených údajů vozidla",
    icon: Bot,
  },
  {
    key: "valuationSummary",
    title: "Souhrn pro stanovení výkupní ceny",
    description: "Přehled podkladů a cen pro rozhodnutí",
    icon: ClipboardCheck,
  },
];

const stockModules = [
  {
    key: "valuationSummary",
    title: "Přehled vozidla",
    description: "Souhrn uložených údajů a aktuálního stavu",
    icon: ClipboardCheck,
  },
  {
    key: "technical",
    title: "Technické parametry",
    description: "Identifikace, motor, registrace a STK",
    icon: ClipboardList,
  },
  {
    key: "checklist",
    title: "CEBIA a dokumenty",
    description: "Administrativa a sdílené dokumenty vozidla",
    icon: FileText,
  },
  {
    key: "photos",
    title: "Fotografie",
    description: "Fotografie pro evidenci a následný prodej",
    icon: Camera,
  },
  {
    key: "equipment",
    title: "Výbava",
    description: "Evidovaná výbava vozidla",
    icon: Star,
  },
  {
    key: "damage",
    title: "Poškození a opravy",
    description: "Stav vozu, vady a plánované opravy",
    icon: ShieldCheck,
  },
  {
    key: "notes",
    title: "Poznámky",
    description: "Interní poznámky k vozidlu",
    icon: MessageCircle,
  },
  {
    key: "customer",
    title: "Zákazník",
    description: "Historický kontakt osoby nabízející vůz",
    icon: UserRound,
  },
  {
    key: "interestedCustomers",
    title: "Možní zájemci",
    description: "CRM shody a zájemci o vozidlo",
    icon: UserRound,
  },
  {
    key: "valuation",
    title: "Cenové informace",
    description: "Výkupní a plánované prodejní ceny",
    icon: WalletCards,
  },
  {
    key: "postPurchaseCosts",
    title: "Náklady po výkupu",
    description: "Náklady na přípravu skladového vozu",
    icon: WalletCards,
  },
  {
    key: "aiAssistant",
    title: "AI Asistent",
    description: "Souhrn vozidla pouze ke kontrole",
    icon: Bot,
  },
  {
    key: "advertising",
    title: "Příprava na inzerci a prodej",
    description: "Připravenost, prodejní texty a marketingové výstupy",
    icon: ClipboardCheck,
  },
];

const sectionCopy = {
  valuation: {
    title: "Pracovní postup nacenění",
    description: "Doplňte podklady v pořadí potřebném pro rozhodnutí o výkupu.",
  },
  approved_purchase: {
    title: "Vůz schválený k výkupu",
    description:
      "Vůz je schválený, ale zatím není fyzicky vykoupený ani vedený skladem.",
  },
  stock: {
    title: "Detail skladového vozu",
    description: "Doplňte údaje potřebné pro přípravu, inzerci a prodej.",
  },
  sold: {
    title: "Detail prodaného vozu",
    description: "Historický přehled prodaného vozidla a jeho podkladů.",
  },
  archived: {
    title: "Archivovaný vůz",
    description: "Historický přehled archivovaného vozidla a jeho podkladů.",
  },
};

export default function VehicleModuleNavigation({
  lifecycleSection,
  valuationComplete,
  onOpenModule,
  onEditIdentification,
}) {
  const isValuationFlow =
    lifecycleSection === "valuation" ||
    lifecycleSection === "approved_purchase";
  const modules = isValuationFlow ? valuationModules : stockModules;
  const copy = sectionCopy[lifecycleSection] || sectionCopy.valuation;

  return (
    <>
      <div className={`lifecycleContext lifecycleContext-${lifecycleSection}`}>
        <div>
          <p className="label">Životní cyklus vozidla</p>
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
        {lifecycleSection === "approved_purchase" && (
          <strong>Čeká na fyzický výkup</strong>
        )}
      </div>

      <div className="grid vehicleModuleGrid">
        {modules.map(({ key, title, description, icon: Icon }) => (
          <div className="module" key={key}>
            <Icon />
            <h3>{title}</h3>
            <p className="moduleDescription">{description}</p>
            {key === "valuation" && isValuationFlow && (
              <p className={valuationComplete ? "okText" : ""}>
                {valuationComplete ? "Hotovo" : "Zatím neprovedeno"}
              </p>
            )}
            <button
              onClick={() =>
                key === "identification"
                  ? onEditIdentification()
                  : onOpenModule(key)
              }
            >
              Otevřít
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
