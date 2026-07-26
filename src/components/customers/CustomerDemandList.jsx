import { useEffect, useState } from "react"
import {
  createCustomerDemand,
  customerDemandPriorities,
  customerDemandStatuses,
  deleteCustomerDemand,
  loadCustomerDemands,
  updateCustomerDemand,
} from "../../services/customerDemands.js"
import { syncMatchesForDemand } from "../../services/customerVehicleMatchSync.js"
import CustomerDemandDetail from "./CustomerDemandDetail.jsx"
import CustomerDemandForm from "./CustomerDemandForm.jsx"

const reloadWarningMessage =
  "Změna byla uložena, ale seznam se nepodařilo obnovit. Zkuste stránku načíst znovu."
const matchSyncWarningMessage =
  "Údaje byly uloženy, ale automatická aktualizace shod se nepodařila."

function getLabel(options, value) {
  return options.find((option) => option.value === value)?.label || value
}

function formatPriceRange(minimum, maximum) {
  const formatter = new Intl.NumberFormat("cs-CZ")

  if (minimum == null && maximum == null) return "Cena neuvedena"
  if (minimum == null) return `Do ${formatter.format(maximum)} Kč`
  if (maximum == null) return `Od ${formatter.format(minimum)} Kč`
  return `${formatter.format(minimum)}–${formatter.format(maximum)} Kč`
}

function getDemandSummary(demand) {
  const values = [
    ...demand.makes,
    ...demand.models,
    ...demand.bodyTypes,
    ...demand.fuelTypes,
  ]

  return values.length > 0 ? values.slice(0, 5).join(" • ") : "Bez upřesnění vozu"
}

export default function CustomerDemandList({
  customerId,
  onDemandMatchSync,
  onOpenVehicle,
  onMatchesChanged,
}) {
  const [demands, setDemands] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [view, setView] = useState("list")
  const [selectedDemand, setSelectedDemand] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState("")
  const [reloadWarning, setReloadWarning] = useState("")
  const [matchSyncWarning, setMatchSyncWarning] = useState("")

  useEffect(() => {
    let active = true

    loadCustomerDemands(customerId)
      .then((loadedDemands) => {
        if (!active) return
        setDemands(loadedDemands)
        setError("")
      })
      .catch((loadError) => {
        if (!active) return
        setError(loadError.message || "Poptávky se nepodařilo načíst.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [customerId])

  async function refreshDemands({ afterMutation = false } = {}) {
    setLoading(true)
    setError("")

    try {
      const loadedDemands = await loadCustomerDemands(customerId)
      setDemands(loadedDemands)
      setReloadWarning("")
      return loadedDemands
    } catch (loadError) {
      if (afterMutation) {
        setReloadWarning(reloadWarningMessage)
      } else {
        setError(loadError.message || "Poptávky se nepodařilo načíst.")
      }
      return null
    } finally {
      setLoading(false)
    }
  }

  function openNewDemand() {
    setSelectedDemand(null)
    setActionError("")
    setView("form")
  }

  function openDemand(demand) {
    setSelectedDemand(demand)
    setActionError("")
    setView("detail")
  }

  async function saveDemand(form) {
    const savedDemand = selectedDemand?.id
      ? await updateCustomerDemand(selectedDemand.id, customerId, form)
      : await createCustomerDemand({ ...form, customerId })

    setDemands((current) => [
      savedDemand,
      ...current.filter((demand) => demand.id !== savedDemand.id),
    ])
    setSelectedDemand(savedDemand)
    setActionError("")
    setView("detail")

    try {
      const matchResult = await syncMatchesForDemand(savedDemand)
      setMatchSyncWarning("")
      await onDemandMatchSync?.(savedDemand, matchResult)
    } catch (syncError) {
      console.error("Automatická aktualizace shod poptávky selhala:", syncError)
      setMatchSyncWarning(matchSyncWarningMessage)
    }

    await refreshDemands({ afterMutation: true })
  }

  async function removeDemand() {
    if (!selectedDemand?.id || deleting) return
    if (!window.confirm(`Opravdu smazat poptávku „${selectedDemand.title}“?`)) {
      return
    }

    setDeleting(true)
    setActionError("")

    try {
      await deleteCustomerDemand(selectedDemand.id, customerId)
      setDemands((current) =>
        current.filter((demand) => demand.id !== selectedDemand.id)
      )
      setSelectedDemand(null)
      setView("list")
      try {
        await onMatchesChanged?.()
      } catch (countError) {
        console.error("Počet nových shod se nepodařilo obnovit:", countError)
      }
      await refreshDemands({ afterMutation: true })
    } catch (deleteError) {
      setActionError(deleteError.message || "Poptávku se nepodařilo smazat.")
    } finally {
      setDeleting(false)
    }
  }

  if (view === "form") {
    return (
      <div className="crmDemandModule">
        <div className="crmDemandModuleHeader">
          <div>
            <h2>{selectedDemand ? "Upravit poptávku" : "Nová poptávka"}</h2>
            <p>Požadavky zákazníka na hledané vozidlo.</p>
          </div>
        </div>
        <CustomerDemandForm
          demand={selectedDemand}
          onSave={saveDemand}
          onCancel={() => setView(selectedDemand ? "detail" : "list")}
        />
      </div>
    )
  }

  if (view === "detail" && selectedDemand) {
    return (
      <CustomerDemandDetail
        demand={selectedDemand}
        deleting={deleting}
        error={actionError}
        notice={[reloadWarning, matchSyncWarning].filter(Boolean).join(" ")}
        onBack={() => setView("list")}
        onEdit={() => setView("form")}
        onDelete={removeDemand}
        onOpenVehicle={onOpenVehicle}
        onMatchesChanged={onMatchesChanged}
      />
    )
  }

  return (
    <div className="crmDemandModule">
      <div className="crmDemandModuleHeader">
        <div>
          <h2>Poptávky zákazníka</h2>
          <p>Evidence aktuálních a historických požadavků na vozidlo.</p>
        </div>
        <button type="button" className="primaryButton" onClick={openNewDemand}>
          Nová poptávka
        </button>
      </div>

      {reloadWarning && (
        <div className="crmReloadWarning" role="status">
          {reloadWarning}
        </div>
      )}
      {matchSyncWarning && (
        <div className="crmReloadWarning" role="status">
          {matchSyncWarning}
        </div>
      )}

      {loading ? (
        <div className="crmStateMessage">Načítám poptávky…</div>
      ) : error ? (
        <div className="crmStateMessage crmStateMessageError" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="secondaryButton"
            onClick={() => refreshDemands()}
          >
            Zkusit znovu
          </button>
        </div>
      ) : demands.length === 0 ? (
        <div className="crmStateMessage">
          <p>Zákazník zatím nemá žádnou evidovanou poptávku.</p>
          <button
            type="button"
            className="secondaryButton"
            onClick={openNewDemand}
          >
            Vytvořit první poptávku
          </button>
        </div>
      ) : (
        <>
          <div className="crmListSummary">
            {demands.length} {demands.length === 1 ? "poptávka" : "poptávek"}
          </div>
          <div className="crmDemandList">
            {demands.map((demand) => (
              <button
                key={demand.id}
                type="button"
                className="crmDemandCard"
                onClick={() => openDemand(demand)}
              >
                <span className="crmDemandCardMain">
                  <strong>{demand.title}</strong>
                  <span>{getDemandSummary(demand)}</span>
                </span>

                <span className="crmDemandBadges">
                  <span
                    className={`crmDemandStatus crmDemandStatus-${demand.status}`}
                  >
                    {getLabel(customerDemandStatuses, demand.status)}
                  </span>
                  <span
                    className={`crmDemandPriority crmDemandPriority-${demand.priority}`}
                  >
                    {getLabel(customerDemandPriorities, demand.priority)}
                  </span>
                </span>

                <strong className="crmDemandPrice">
                  {formatPriceRange(demand.minPrice, demand.maxPrice)}
                </strong>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
