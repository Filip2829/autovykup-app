import AiMissingData from "../AiMissingData.jsx";
import AiResultPanel from "../AiResultPanel.jsx";
import AiSourceSummary from "../AiSourceSummary.jsx";

export default function VehicleSummaryAssistant({
  moduleDefinition,
  context,
  capabilities,
  aiState,
}) {
  const runSummary = () =>
    aiState.run({
      moduleId: moduleDefinition.id,
      vehicleId: context.vehicleId,
      context,
      options: {},
    });

  return (
    <div className="aiModulePanel">
      <div className="aiModuleIntro">
        <div>
          <h2>{moduleDefinition.label}</h2>
          <p>
            Souhrn je sestaven pouze z uložených údajů. Nic neukládá ani
            automaticky nemění.
          </p>
        </div>
        <button
          type="button"
          className="primary"
          onClick={runSummary}
          disabled={aiState.loading || !capabilities.canRun}
        >
          {aiState.loading ? "Připravuji souhrn…" : "Vytvořit souhrn"}
        </button>
      </div>

      <AiSourceSummary capabilities={capabilities} />
      <AiMissingData
        title="Chybějící povinné zdroje"
        items={capabilities.missingRequiredSources}
      />
      {aiState.error && <p className="badText">{aiState.error}</p>}
      <AiResultPanel
        result={aiState.result}
        onRerun={aiState.rerun}
        loading={aiState.loading}
      />
    </div>
  );
}
