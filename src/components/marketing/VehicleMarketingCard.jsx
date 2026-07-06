import { useMemo, useRef } from "react";
import {
  buildMarketingVehicle,
  MarketingActions,
  MarketingReadinessScore,
  OpportunityClassic,
} from "../../marketing/index.js";

export default function VehicleMarketingCard({ selectedCar }) {
  const cardRef = useRef(null);
  const marketingVehicle = useMemo(
    () => buildMarketingVehicle(selectedCar),
    [selectedCar]
  );

  return (
    <div className="card decision marketingEnginePanel">
      <div className="marketingEngineTop">
        <div>
          <p className="label">Marketing Engine</p>
          <h2>A4 karta za okno vozu</h2>
        </div>
        <MarketingActions cardRef={cardRef} fileName={marketingVehicle.title} />
      </div>

      <MarketingReadinessScore readiness={marketingVehicle.readiness} />

      <div className="marketingPreviewShell">
        <OpportunityClassic vehicle={marketingVehicle} cardRef={cardRef} />
      </div>
    </div>
  );
}
