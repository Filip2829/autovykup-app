import { lazy, Suspense } from "react";

const VehicleSummaryAssistant = lazy(() => import("./modules/VehicleSummaryAssistant.jsx"));
const PurchaseInspectionAssistant = lazy(() => import("./modules/PurchaseInspectionAssistant.jsx"));
const PriceRecommendationAssistant = lazy(() => import("./modules/PriceRecommendationAssistant.jsx"));

export default function AiModulePanel(props) {
  let content;
  if (props.moduleDefinition?.id === "price-recommendation") {
    content = <PriceRecommendationAssistant {...props} />;
  } else if (props.moduleDefinition?.id === "vehicle-summary") {
    content = <VehicleSummaryAssistant {...props} />;
  } else if (props.moduleDefinition?.id === "purchase-inspection") {
    content = <PurchaseInspectionAssistant {...props} />;
  } else {
    content = <p>Tento AI modul zatím není dostupný.</p>;
  }
  return <Suspense fallback={<p className="mutedText">Načítám AI modul…</p>}>{content}</Suspense>;
}
