import { useEffect, useMemo, useState } from "react"
import {
  loadCustomerVehicleMatches,
  updateCustomerVehicleMatchStatus,
} from "../../services/customerVehicleMatches.js"
import { syncAllCustomerVehicleMatches } from "../../services/customerVehicleMatchSync.js"
import CustomerVehicleMatchCard from "./CustomerVehicleMatchCard.jsx"
import "./CustomerVehicleMatches.css"

const filters = [
  { value: "new", label: "Nové" },
  { value: "reviewed", label: "Zkontrolované" },
  { value: "contacted", label: "Kontaktované" },
  { value: "all", label: "Vše aktivní" },
]

export default function CustomerVehicleMatchesOverview({
  onBack,
  onOpenCustomer,
  onOpenVehicle,
  onMatchesChanged,
}) {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [filter, setFilter] = useState("new")
  const [changingMatchId, setChangingMatchId] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState("")

  async function loadMatches() {
    setLoading(true)
    setError("")

    try {
      const loadedMatches = await loadCustomerVehicleMatches()
      setMatches(loadedMatches)
    } catch (loadError) {
      setError(loadError.message || "Uložené shody se nepodařilo načíst.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMatches()
  }, [])

  const visibleMatches = useMemo(
    () =>
      filter === "all"
        ? matches
        : matches.filter((match) => match.status === filter),
    [filter, matches]
  )

  async function changeStatus(match, nextStatus) {
    if (changingMatchId) return
    setChangingMatchId(match.id)
    setError("")

    try {
      const updatedMatch = await updateCustomerVehicleMatchStatus(
        match.id,
        match.status,
        nextStatus
      )
      setMatches((current) =>
        current.map((item) =>
          item.id === match.id
            ? {
                ...item,
                ...updatedMatch,
                customer: updatedMatch.customer || item.customer,
                demand: updatedMatch.demand || item.demand,
                car: updatedMatch.car || item.car,
              }
            : item
        )
      )
      await onMatchesChanged?.()
    } catch (statusError) {
      setError(statusError.message || "Stav shody se nepodařilo změnit.")
    } finally {
      setChangingMatchId(null)
    }
  }

  async function syncAll() {
    if (syncing) return
    setSyncing(true)
    setError("")
    setSyncResult("")

    try {
      const result = await syncAllCustomerVehicleMatches()
      setSyncResult(
        `Synchronizace dokončena: ${result.createdCount} nových, `
          + `${result.updatedCount} aktualizovaných a `
          + `${result.removedCount} odstraněných shod.`
      )
      await loadMatches()
      await onMatchesChanged?.()
    } catch (syncError) {
      setError(syncError.message || "Synchronizace shod se nepodařila.")
    } finally {
      setSyncing(false)
    }
  }

  return (
    <section className="crmPage" aria-labelledby="crmMatchesTitle">
      <div className="crmMatchOverviewHeader">
        <div>
          <button type="button" className="backButton" onClick={onBack}>
            ← Zpět
          </button>
          <h1 id="crmMatchesTitle">Nové shody</h1>
          <p>
            Uložené výsledky párování aktivních poptávek s dostupnými vozidly.
          </p>
        </div>
        <div className="crmMatchHeaderActions">
          <button
            type="button"
            className="secondaryButton"
            disabled={syncing}
            onClick={syncAll}
          >
            {syncing ? "Synchronizuji…" : "Synchronizovat všechny shody"}
          </button>
        </div>
      </div>

      <div className="crmMatchFilters" aria-label="Filtr stavu shod">
        {filters.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`secondaryButton ${filter === option.value ? "active" : ""}`}
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {syncResult && (
        <div className="crmMatchSyncResult" role="status">
          {syncResult}
        </div>
      )}

      {error && (
        <div className="crmStateMessage crmStateMessageError" role="alert">
          <p>{error}</p>
          <button type="button" className="secondaryButton" onClick={loadMatches}>
            Zkusit znovu
          </button>
        </div>
      )}

      {loading ? (
        <div className="crmStateMessage">Načítám uložené shody…</div>
      ) : !error && visibleMatches.length === 0 ? (
        <div className="crmStateMessage">
          Pro vybraný stav nejsou evidované žádné shody.
        </div>
      ) : !error ? (
        <div className="crmMatchList">
          {visibleMatches.map((match) => (
            <CustomerVehicleMatchCard
              key={match.id}
              match={match}
              changingStatus={changingMatchId === match.id}
              onOpenCustomer={onOpenCustomer}
              onOpenVehicle={onOpenVehicle}
              onChangeStatus={changeStatus}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}
