import {
  customerDemandPriorities,
  customerDemandStatuses,
} from "../../services/customerDemands.js"

function getLabel(options, value) {
  return options.find((option) => option.value === value)?.label || value
}

function formatDate(value) {
  if (!value) return "Neuvedeno"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Neuvedeno"

  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date)
}

function formatNumber(value, suffix = "") {
  if (value === null || value === undefined || value === "") return "Neuvedeno"
  return `${new Intl.NumberFormat("cs-CZ").format(Number(value))}${suffix}`
}

function formatRange(minimum, maximum, suffix = "") {
  if (minimum == null && maximum == null) return "Neuvedeno"
  if (minimum == null) return `do ${formatNumber(maximum, suffix)}`
  if (maximum == null) return `od ${formatNumber(minimum, suffix)}`
  return `${formatNumber(minimum)}–${formatNumber(maximum, suffix)}`
}

function DemandValues({ label, values }) {
  return (
    <div className="crmDemandValues">
      <small>{label}</small>
      {values?.length ? (
        <div className="crmDemandTags">
          {values.map((value) => (
            <span key={value}>{value}</span>
          ))}
        </div>
      ) : (
        <strong>Neuvedeno</strong>
      )}
    </div>
  )
}

export default function CustomerDemandDetail({
  demand,
  deleting,
  error,
  notice,
  onBack,
  onEdit,
  onDelete,
}) {
  return (
    <div className="crmDemandDetail">
      <div className="crmDemandDetailHeader">
        <div>
          <button type="button" className="backButton" onClick={onBack}>
            ← Zpět na poptávky
          </button>
          <h2>{demand.title}</h2>
          <div className="crmDemandBadges">
            <span className={`crmDemandStatus crmDemandStatus-${demand.status}`}>
              {getLabel(customerDemandStatuses, demand.status)}
            </span>
            <span
              className={`crmDemandPriority crmDemandPriority-${demand.priority}`}
            >
              {getLabel(customerDemandPriorities, demand.priority)}
            </span>
          </div>
        </div>

        <div className="crmDemandActions">
          <button type="button" className="primaryButton" onClick={onEdit}>
            Upravit
          </button>
          <button
            type="button"
            className="crmDangerButton"
            onClick={onDelete}
            disabled={deleting}
          >
            {deleting ? "Mažu…" : "Smazat"}
          </button>
        </div>
      </div>

      {error && (
        <div className="crmFormError" role="alert">
          {error}
        </div>
      )}

      {notice && (
        <div className="crmReloadWarning" role="status">
          {notice}
        </div>
      )}

      <div className="crmDemandDetailSection">
        <h3>Základní parametry</h3>
        <div className="crmDemandDetailGrid">
          <div>
            <small>Cena</small>
            <strong>{formatRange(demand.minPrice, demand.maxPrice, " Kč")}</strong>
          </div>
          <div>
            <small>Rok výroby</small>
            <strong>{formatRange(demand.minYear, demand.maxYear)}</strong>
          </div>
          <div>
            <small>Maximální nájezd</small>
            <strong>{formatNumber(demand.maxMileage, " km")}</strong>
          </div>
          <div>
            <small>Výkon</small>
            <strong>
              {formatRange(demand.minPowerKw, demand.maxPowerKw, " kW")}
            </strong>
          </div>
          <div>
            <small>Vytvořeno</small>
            <strong>{formatDate(demand.createdAt)}</strong>
          </div>
          <div>
            <small>Poslední úprava</small>
            <strong>{formatDate(demand.updatedAt)}</strong>
          </div>
        </div>
      </div>

      <div className="crmDemandDetailSection">
        <h3>Požadované vozidlo</h3>
        <div className="crmDemandDetailGrid">
          <DemandValues label="Značky" values={demand.makes} />
          <DemandValues label="Modely" values={demand.models} />
          <DemandValues label="Karoserie" values={demand.bodyTypes} />
          <DemandValues label="Paliva" values={demand.fuelTypes} />
          <DemandValues label="Převodovky" values={demand.transmissions} />
          <DemandValues label="Pohony" values={demand.drivetrains} />
        </div>
      </div>

      <div className="crmDemandDetailSection">
        <h3>Výbava a barvy</h3>
        <div className="crmDemandDetailGrid">
          <DemandValues
            label="Povinná výbava"
            values={demand.requiredEquipment}
          />
          <DemandValues
            label="Preferovaná výbava"
            values={demand.preferredEquipment}
          />
          <DemandValues
            label="Preferované barvy"
            values={demand.preferredColors}
          />
          <DemandValues
            label="Vyloučené barvy"
            values={demand.excludedColors}
          />
        </div>
      </div>

      <div className="crmDemandNotes">
        <small>Poznámka</small>
        <p>{demand.notes || "Bez poznámky."}</p>
      </div>
    </div>
  )
}
