import { useEffect, useState } from "react"
import {
  loadCustomerVehicleMatches,
  updateCustomerVehicleMatchStatus,
} from "../../services/customerVehicleMatches.js"
import CustomerVehicleMatchCard from "./CustomerVehicleMatchCard.jsx"
import "./CustomerVehicleMatches.css"

export default function CustomerRecommendedVehicles({
  customerId,
  customerDemandId,
  onOpenVehicle,
  onMatchesChanged,
}) {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [changingMatchId, setChangingMatchId] = useState(null)

  async function loadMatches() {
    setLoading(true)
    setError("")

    try {
      const loadedMatches = await loadCustomerVehicleMatches({
        customerId,
        customerDemandId,
      })
      setMatches(loadedMatches)
    } catch (loadError) {
      setError(
        loadError.message || "Doporučené vozy se nepodařilo načíst."
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMatches()
  }, [customerId, customerDemandId])

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

  if (loading) {
    return <div className="crmStateMessage">Načítám doporučené vozy…</div>
  }

  if (error) {
    return (
      <div className="crmStateMessage crmStateMessageError" role="alert">
        <p>{error}</p>
        <button type="button" className="secondaryButton" onClick={loadMatches}>
          Zkusit znovu
        </button>
      </div>
    )
  }

  if (matches.length === 0) {
    return (
      <div className="crmStateMessage">
        Pro aktivní poptávky zákazníka nejsou uložené žádné aktuální shody.
      </div>
    )
  }

  return (
    <div className="crmMatchList">
      {matches.map((match) => (
        <CustomerVehicleMatchCard
          key={match.id}
          match={match}
          showCustomer={false}
          changingStatus={changingMatchId === match.id}
          onOpenVehicle={onOpenVehicle}
          onChangeStatus={changeStatus}
        />
      ))}
    </div>
  )
}
