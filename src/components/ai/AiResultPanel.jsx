import AiMissingData from "./AiMissingData.jsx";

const sectionLabels = {
  identification: "Identifikace vozidla",
  technical: "Hlavní technické údaje",
  condition: "Stav a známá poškození",
  equipmentDocumentation: "Výbava a dokumentace",
  pricing: "Cenové údaje",
};

function ResultSection({ sectionKey, values }) {
  if (!Array.isArray(values) || values.length === 0) return null;

  return (
    <section className="aiResultSection">
      <h3>{sectionLabels[sectionKey] || sectionKey}</h3>
      <ul>
        {values.map((item, index) => (
          <li key={`${sectionKey}-${index}`}>
            {item && typeof item === "object" ? (
              <><strong>{item.label}:</strong> {item.value}</>
            ) : (
              item
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function AiResultPanel({ result, onRerun, loading }) {
  if (!result) return null;
  const output = result.output || {};

  return (
    <div className="aiResultPanel" role="status">
      <div className="aiResultHeader">
        <div>
          <p className="label">Výsledek pouze ke kontrole</p>
          <h3>AI souhrn vozidla</h3>
        </div>
        <button type="button" className="primary outline" onClick={onRerun} disabled={loading}>
          Vytvořit znovu
        </button>
      </div>

      <div className="aiResultGrid">
        {Object.keys(sectionLabels).map((sectionKey) => (
          <ResultSection
            key={sectionKey}
            sectionKey={sectionKey}
            values={output[sectionKey]}
          />
        ))}
      </div>

      {output.summary && (
        <section className="aiAssistantSection">
          <h3>Krátký souhrn</h3>
          <p>{output.summary}</p>
        </section>
      )}

      <AiMissingData items={result.missingData} />

      {result.warnings?.length > 0 && (
        <div className="aiResultWarning">
          {result.warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      )}
    </div>
  );
}
