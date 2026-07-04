import { Edit, Trash2 } from "lucide-react";

export default function VehicleHeader({
  selectedCar,
  statusClassName,
  onBack,
  onEdit,
  onDelete,
  formatDate,
}) {
  return (
    <>
      <button className="back bigBack" onClick={onBack}>
        ← Zpět
      </button>

      <div className="card carHero">
        <div className="carHeroTop">
          <div>
            <h2>{selectedCar.name}</h2>
            <p>
              {selectedCar.year} · {selectedCar.km?.toLocaleString("cs-CZ")} km
            </p>
          </div>

          <span className={`statusBadge ${statusClassName}`}>
            {selectedCar.status}
          </span>
        </div>

        <div className="carHeroBody">
          <div className="carInfoGrid">
            <div>
              <strong>VIN:</strong>
              <p>{selectedCar.vin || "—"}</p>
            </div>

            <div>
              <strong>SPZ:</strong>
              <p>{selectedCar.spz || "—"}</p>
            </div>

            <div>
              <strong>Vytvořil:</strong>
              <p>{selectedCar.created_by || "—"}</p>
            </div>

            <div>
              <strong>Přidáno:</strong>
              <p>{formatDate(selectedCar.created_at)}</p>
            </div>

            <div>
              <strong>Poslední úprava:</strong>
              <p>{selectedCar.updated_by || "—"}</p>
            </div>

            <div>
              <strong>Upraveno:</strong>
              <p>{formatDate(selectedCar.updated_at, true)}</p>
            </div>
          </div>

          <div className="heroActions">
            <button className="primary outline" onClick={onEdit}>
              <Edit size={18} />
              Upravit údaje
            </button>

            <button className="danger outlineDanger" onClick={onDelete}>
              <Trash2 size={18} />
              Smazat záznam
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
