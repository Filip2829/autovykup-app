import {
  canTransitionCustomerVehicleMatch,
  customerVehicleMatchStatuses,
} from "../../services/customerVehicleMatches.js"

const levelLabels = {
  excellent: "Výborná shoda",
  good: "Dobrá shoda",
  possible: "Možná shoda",
  poor: "Slabá shoda",
}

function getCustomerName(customer) {
  return [customer?.firstName, customer?.lastName].filter(Boolean).join(" ").trim()
    || customer?.email
    || customer?.phone
    || "Zákazník bez jména"
}

function getVehicleName(car) {
  return car?.name || car?.vin || "Vozidlo bez názvu"
}

function getStatusLabel(value) {
  return customerVehicleMatchStatuses.find((status) => status.value === value)
    ?.label || value
}

export default function CustomerVehicleMatchCard({
  match,
  showCustomer = true,
  showVehicle = true,
  changingStatus = false,
  onOpenCustomer,
  onOpenVehicle,
  onChangeStatus,
}) {
  return (
    <article className={`crmMatchCard crmMatchCard-${match.level}`}>
      <div className="crmMatchCardTop">
        <div>
          {showCustomer && <h3>{getCustomerName(match.customer)}</h3>}
          {showVehicle && <h3>{getVehicleName(match.car)}</h3>}
          <p>{match.demand?.title || "Poptávka bez názvu"}</p>
        </div>
        <div className="crmMatchScore">
          <strong>{levelLabels[match.level] || levelLabels.poor}</strong>
          <span>{match.score} bodů</span>
          <small>{getStatusLabel(match.status)}</small>
        </div>
      </div>

      <div className="crmMatchReasons">
        <div>
          <h4>Hlavní důvody shody</h4>
          {match.matchedCriteria.length > 0 ? (
            <ul>
              {match.matchedCriteria.slice(0, 3).map((item, index) => (
                <li key={`${item.key}-${index}`}>{item.message}</li>
              ))}
            </ul>
          ) : (
            <p>Poptávka nemá další omezující kritéria.</p>
          )}
        </div>

        {match.warnings.length > 0 && (
          <div className="crmMatchWarnings">
            <h4>Odchylky ke kontrole</h4>
            <ul>
              {match.warnings.slice(0, 3).map((item, index) => (
                <li key={`${item.key}-${index}`}>{item.message}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="crmMatchActions">
        {showCustomer && match.customer && onOpenCustomer && (
          <button
            type="button"
            className="secondaryButton"
            onClick={() => onOpenCustomer(match.customer)}
          >
            Otevřít zákazníka
          </button>
        )}
        {showVehicle && match.car && onOpenVehicle && (
          <button
            type="button"
            className="secondaryButton"
            onClick={() => onOpenVehicle(match.car)}
          >
            Otevřít vozidlo
          </button>
        )}
        {canTransitionCustomerVehicleMatch(match.status, "reviewed") && (
          <button
            type="button"
            className="secondaryButton"
            disabled={changingStatus}
            onClick={() => onChangeStatus?.(match, "reviewed")}
          >
            Zkontrolováno
          </button>
        )}
        {canTransitionCustomerVehicleMatch(match.status, "contacted") && (
          <button
            type="button"
            className="primaryButton"
            disabled={changingStatus}
            onClick={() => onChangeStatus?.(match, "contacted")}
          >
            Kontaktováno
          </button>
        )}
        {canTransitionCustomerVehicleMatch(match.status, "dismissed") && (
          <button
            type="button"
            className="outlineDanger"
            disabled={changingStatus}
            onClick={() => onChangeStatus?.(match, "dismissed")}
          >
            Zamítnout
          </button>
        )}
      </div>
    </article>
  )
}
