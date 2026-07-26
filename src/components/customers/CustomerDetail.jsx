import { useState } from "react"
import CustomerDemandList from "./CustomerDemandList.jsx"
import CustomerRecommendedVehicles from "./CustomerRecommendedVehicles.jsx"

const statusLabels = {
  active: "Aktivní",
  inactive: "Neaktivní",
  archived: "Archivovaný",
}

const tabs = [
  { id: "overview", label: "Přehled" },
  { id: "demands", label: "Poptávky" },
  { id: "recommended", label: "Doporučené vozy" },
  { id: "history", label: "Historie komunikace" },
]

function formatDate(value) {
  if (!value) return "Neuvedeno"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Neuvedeno"

  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date)
}

function formatContactDate(value) {
  if (!value) return "Neuvedeno"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Neuvedeno"

  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "long",
  }).format(date)
}

function getCustomerName(customer) {
  return [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim()
    || customer.email
    || customer.phone
    || "Zákazník bez jména"
}

export default function CustomerDetail({
  customer,
  onBack,
  onEdit,
  onOpenVehicle,
  onDemandMatchSync,
  onMatchesChanged,
}) {
  const [activeTab, setActiveTab] = useState("overview")

  return (
    <section className="crmPage" aria-labelledby="crmCustomerDetailTitle">
      <div className="crmPageHeader">
        <div>
          <button type="button" className="backButton" onClick={onBack}>
            ← Zpět na seznam
          </button>
          <h1 id="crmCustomerDetailTitle">{getCustomerName(customer)}</h1>
          <span className={`crmStatusBadge crmStatusBadge-${customer.status}`}>
            {statusLabels[customer.status] || customer.status}
          </span>
        </div>

        <button type="button" className="primaryButton" onClick={onEdit}>
          Upravit
        </button>
      </div>

      <nav className="crmTabs" aria-label="Detail zákazníka">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? "active" : ""}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "overview" ? (
        <div className="crmOverview">
          <div className="crmOverviewGrid">
            <div>
              <small>Jméno</small>
              <strong>{customer.firstName || "Neuvedeno"}</strong>
            </div>
            <div>
              <small>Příjmení</small>
              <strong>{customer.lastName || "Neuvedeno"}</strong>
            </div>
            <div>
              <small>Telefon</small>
              {customer.phone ? (
                <a href={`tel:${customer.phone}`}>{customer.phone}</a>
              ) : (
                <strong>Neuvedeno</strong>
              )}
            </div>
            <div>
              <small>E-mail</small>
              {customer.email ? (
                <a href={`mailto:${customer.email}`}>{customer.email}</a>
              ) : (
                <strong>Neuvedeno</strong>
              )}
            </div>
            <div>
              <small>Poslední kontakt</small>
              <strong>{formatContactDate(customer.lastContactAt)}</strong>
            </div>
            <div>
              <small>Kontaktovat znovu</small>
              <strong>{formatContactDate(customer.nextContactAt)}</strong>
            </div>
            <div>
              <small>Vytvořeno</small>
              <strong>{formatDate(customer.createdAt)}</strong>
            </div>
            <div>
              <small>Poslední úprava</small>
              <strong>{formatDate(customer.updatedAt)}</strong>
            </div>
          </div>

          <div className="crmNotesPanel">
            <small>Poznámky</small>
            <p>{customer.notes || "Bez poznámek."}</p>
          </div>
        </div>
      ) : activeTab === "demands" ? (
        <CustomerDemandList
          customerId={customer.id}
          onDemandMatchSync={onDemandMatchSync}
          onOpenVehicle={onOpenVehicle}
          onMatchesChanged={onMatchesChanged}
        />
      ) : activeTab === "recommended" ? (
        <CustomerRecommendedVehicles
          customerId={customer.id}
          onOpenVehicle={onOpenVehicle}
          onMatchesChanged={onMatchesChanged}
        />
      ) : (
        <div className="crmStateMessage">
          {activeTab === "history"
            && "Historie komunikace bude doplněna v další fázi CRM."}
        </div>
      )}
    </section>
  )
}
