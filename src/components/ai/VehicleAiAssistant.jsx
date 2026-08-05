import { useMemo, useState } from "react";
import { getAvailableAiModules } from "../../ai/aiModuleRegistry.js";
import { buildVehicleAiContext } from "../../ai/buildVehicleAiContext.js";
import { evaluateVehicleAiCapabilities } from "../../ai/vehicleAiCapabilities.js";
import useVehicleAiModule from "../../hooks/useVehicleAiModule.js";
import AiModuleList from "./AiModuleList.jsx";
import AiModulePanel from "./AiModulePanel.jsx";

export default function VehicleAiAssistant({
  selectedCar,
  documents,
  documentsLoading,
  lifecycleSection,
  moduleContentRef,
}) {
  const availableModules = getAvailableAiModules(lifecycleSection);
  const [activeModuleId, setActiveModuleId] = useState(
    availableModules[0]?.id || ""
  );
  const context = useMemo(
    () =>
      buildVehicleAiContext(selectedCar, {
        documents,
        documentsLoading,
      }),
    [selectedCar, documents, documentsLoading]
  );
  const activeModule =
    availableModules.find((module) => module.id === activeModuleId) ||
    availableModules[0];
  const capabilities = useMemo(
    () => evaluateVehicleAiCapabilities(context, activeModule),
    [context, activeModule]
  );
  const aiState = useVehicleAiModule();

  return (
    <div className="card decision vehicleAiAssistant" ref={moduleContentRef}>
      <div className="vehicleAiAssistantHeader">
        <div>
          <p className="label">Bez automatických změn dat</p>
          <h2>🤖 AI Asistent</h2>
          <p>Společné místo pro bezpečné analytické nástroje vozidla.</p>
        </div>
        <span className="aiReadOnlyBadge">Pouze ke čtení</span>
      </div>

      <AiModuleList
        modules={availableModules}
        activeModuleId={activeModule?.id}
        onSelect={(moduleId) => {
          aiState.reset();
          setActiveModuleId(moduleId);
        }}
      />

      {activeModule ? (
        <AiModulePanel
          moduleDefinition={activeModule}
          context={context}
          capabilities={capabilities}
          aiState={aiState}
        />
      ) : (
        <p>Pro tuto fázi vozidla není dostupný žádný AI modul.</p>
      )}
    </div>
  );
}
