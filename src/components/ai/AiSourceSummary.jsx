const sourceLabels = {
  identity: "Identifikace",
  technical: "Technické údaje",
  documents: "Dokumenty",
  cebia: "CEBIA",
  condition: "Stav a poškození",
  equipment: "Výbava",
  checklist: "Checklist",
  notes: "Poznámky",
  valuation: "Nacenění",
  photos: "Fotografie",
};

export default function AiSourceSummary({ capabilities }) {
  return (
    <section className="aiAssistantSection">
      <h3>Použité zdroje</h3>
      <div className="aiSourceGrid">
        {Object.entries(capabilities.availability).map(([source, available]) => (
          <div
            key={source}
            className={`aiSourceItem ${available ? "isAvailable" : "isMissing"}`}
          >
            <span>{sourceLabels[source] || source}</span>
            <strong>{available ? "Dostupné" : "Chybí"}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
