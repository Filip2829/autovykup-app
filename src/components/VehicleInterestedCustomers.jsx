import { useEffect, useMemo, useState } from "react"
import {
  loadCustomerVehicleMatches,
  updateCustomerVehicleMatchStatus,
} from "../services/customerVehicleMatches.js"
import CustomerVehicleMatchCard from "./customers/CustomerVehicleMatchCard.jsx"
import "./customers/CustomerVehicleMatches.css"
import "./VehicleInterestedCustomers.css"

export default function VehicleInterestedCustomers({
  selectedCar,
  moduleContentRef,
  onOpenCustomer,
  onMatchesChanged,
}) {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [reloadKey, setReloadKey] = useState(0)
  const [changingMatchId, setChangingMatchId] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError("")

    loadCustomerVehicleMatches({ carId: selectedCar?.id })
      .then((loadedMatches) => {
        if (!active) return
        setMatches(loadedMatches)
      })
      .catch((loadError) => {
        if (!active) return
        setError(
          loadError.message || "Možné zájemce se nepodařilo načíst."
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [selectedCar?.id, reloadKey])

  const summary = useMemo(
    () =>
      matches.reduce(
        (counts, match) => ({
          ...counts,
          [match.level]: (counts[match.level] || 0) + 1,
        }),
        { excellent: 0, good: 0, possible: 0, poor: 0 }
      ),
    [matches]
  )

  function retryLoading() {
    setReloadKey((current) => current + 1)
  }

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
      if (nextStatus === "dismissed") {
        setMatches((current) =>
          current.filter((item) => item.id !== match.id)
        )
      } else {
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
      }
      await onMatchesChanged?.()
    } catch (statusError) {
      setError(statusError.message || "Stav shody se nepodařilo změnit.")
    } finally {
      setChangingMatchId(null)
    }
  }

  return (
    <div
      className="card decision interestedCustomersSection"
      ref={moduleContentRef}
    >
      <div className="interestedCustomersHeader">
        <div>
          <h2>Možní zájemci</h2>
          <p>Uložené výsledky párování vozu s aktivními poptávkami.</p>
        </div>

        {!loading && !error && (
          <div className="interestedCustomersTotal">
            <strong>{matches.length}</strong>
            <span>relevantních zájemců</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="interestedCustomersState">
          Načítám uložené shody…
        </div>
      ) : error ? (
        <div
          className="interestedCustomersState interestedCustomersError"
          role="alert"
        >
          <p>{error}</p>
          <button type="button" className="outline" onClick={retryLoading}>
            Zkusit znovu
          </button>
        </div>
      ) : (
        <>
          <div className="interestedCustomersSummary">
            <span>
              <strong>{summary.excellent}</strong>
              Výborná shoda
            </span>
            <span>
              <strong>{summary.good}</strong>
              Dobrá shoda
            </span>
            <span>
              <strong>{summary.possible}</strong>
              Možná shoda
            </span>
          </div>

          {matches.length === 0 ? (
            <div className="interestedCustomersState">
              Pro tento vůz není uložená žádná odpovídající aktivní shoda.
            </div>
          ) : (
            <div className="crmMatchList">
              {matches.map((match) => (
                <CustomerVehicleMatchCard
                  key={match.id}
                  match={match}
                  showVehicle={false}
                  changingStatus={changingMatchId === match.id}
                  onOpenCustomer={onOpenCustomer}
                  onChangeStatus={changeStatus}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
