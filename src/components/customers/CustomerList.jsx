import { useMemo, useState } from "react"
import { customerStatuses, filterCustomers } from "../../services/customers"
import "./customers.css"

const statusLabels = {
  active: "Aktivní",
  inactive: "Neaktivní",
  archived: "Archivovaný",
}

function formatDate(value) {
  if (!value) return "Neuvedeno"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Neuvedeno"

  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

function getCustomerName(customer) {
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim()
  return name || "Bez jména"
}

export default function CustomerList({
  customers,
  loading,
  error,
  onRetry,
  onBack,
  onNew,
  onSelect,
}) {
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("active")

  const filteredCustomers = useMemo(
    () => filterCustomers(customers, { query, status }),
    [customers, query, status],
  )

  return (
    <section className="crmPage" aria-labelledby="crmCustomerListTitle">
      <div className="crmPageHeader">
        <div>
          <button type="button" className="backButton" onClick={onBack}>
            ← Zpět na rozcestník
          </button>
          <h1 id="crmCustomerListTitle">Zákazníci</h1>
          <p>Samostatná evidence kontaktů pro práci se zákazníky.</p>
        </div>

        <button type="button" className="primaryButton" onClick={onNew}>
          Nový zákazník
        </button>
      </div>

      <div className="crmFilters">
        <label>
          Hledat zákazníka
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Jméno, e-mail nebo telefon"
          />
        </label>

        <label>
          Stav
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">Všichni</option>
            {customerStatuses.map((option) => (
              <option key={option.value} value={option.value}>
                {option.value === "archived" ? "Archivovaní" : option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="crmListSummary" aria-live="polite">
        {filteredCustomers.length}{" "}
        {filteredCustomers.length === 1 ? "zákazník" : "zákazníků"}
      </div>

      {loading ? (
        <div className="crmStateMessage">Načítám zákazníky…</div>
      ) : error ? (
        <div className="crmStateMessage crmStateMessageError" role="alert">
          <p>{error}</p>
          <button type="button" className="secondaryButton" onClick={onRetry}>
            Zkusit znovu
          </button>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="crmStateMessage">
          {customers.length === 0
            ? "Zatím nejsou evidováni žádní zákazníci."
            : "Zadanému hledání a filtru neodpovídá žádný zákazník."}
        </div>
      ) : (
        <div className="crmCustomerList">
          {filteredCustomers.map((customer) => (
            <button
              key={customer.id}
              type="button"
              className="crmCustomerCard"
              onClick={() => onSelect(customer)}
            >
              <span className="crmCustomerIdentity">
                <strong>{getCustomerName(customer)}</strong>
                <span>{customer.email || "E-mail neuveden"}</span>
                <span>{customer.phone || "Telefon neuveden"}</span>
              </span>

              <span className={`crmStatusBadge crmStatusBadge-${customer.status}`}>
                {statusLabels[customer.status] || customer.status}
              </span>

              <span className="crmCustomerDates">
                <span>
                  <small>Poslední kontakt</small>
                  {formatDate(customer.lastContactAt)}
                </span>
                <span>
                  <small>Další kontakt</small>
                  {formatDate(customer.nextContactAt)}
                </span>
                <span>
                  <small>Vytvořeno</small>
                  {formatDate(customer.createdAt)}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
