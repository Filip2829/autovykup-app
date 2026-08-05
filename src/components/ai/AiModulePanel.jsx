import VehicleSummaryAssistant from "./modules/VehicleSummaryAssistant.jsx";
import PurchaseInspectionAssistant from "./modules/PurchaseInspectionAssistant.jsx";

export default function AiModulePanel(props) {
  if (props.moduleDefinition?.id === "vehicle-summary") {
    return <VehicleSummaryAssistant {...props} />;
  }

  if (props.moduleDefinition?.id === "purchase-inspection") {
    return <PurchaseInspectionAssistant {...props} />;
  }

  return <p>Tento AI modul zatím není dostupný.</p>;
}
