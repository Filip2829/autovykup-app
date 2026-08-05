import VehicleSummaryAssistant from "./modules/VehicleSummaryAssistant.jsx";

export default function AiModulePanel(props) {
  if (props.moduleDefinition?.id === "vehicle-summary") {
    return <VehicleSummaryAssistant {...props} />;
  }

  return <p>Tento AI modul zatím není dostupný.</p>;
}
