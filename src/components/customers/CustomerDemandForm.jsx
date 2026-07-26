import { useState } from "react"
import {
  customerDemandPriorities,
  customerDemandStatuses,
  validateCustomerDemand,
} from "../../services/customerDemands.js"

const emptyDemandForm = {
  title: "",
  status: "active",
  priority: "normal",
  notes: "",
  minPrice: "",
  maxPrice: "",
  makes: "",
  models: "",
  bodyTypes: "",
  fuelTypes: "",
  transmissions: "",
  drivetrains: "",
  minYear: "",
  maxYear: "",
  maxMileage: "",
  minPowerKw: "",
  maxPowerKw: "",
  requiredEquipment: "",
  preferredEquipment: "",
  preferredColors: "",
  excludedColors: "",
}

const arrayInputs = [
  { field: "makes", label: "Značky", placeholder: "Škoda, Toyota" },
  { field: "models", label: "Modely", placeholder: "Kodiaq, RAV4" },
  { field: "bodyTypes", label: "Karoserie", placeholder: "SUV, kombi" },
  { field: "fuelTypes", label: "Paliva", placeholder: "Benzín, hybrid" },
  {
    field: "transmissions",
    label: "Převodovky",
    placeholder: "Automatická",
  },
  { field: "drivetrains", label: "Pohony", placeholder: "4x4, přední" },
]

const preferenceInputs = [
  {
    field: "requiredEquipment",
    label: "Povinná výbava",
    placeholder: "Tažné zařízení, klimatizace",
  },
  {
    field: "preferredEquipment",
    label: "Preferovaná výbava",
    placeholder: "Vyhřívaná sedadla",
  },
  {
    field: "preferredColors",
    label: "Preferované barvy",
    placeholder: "Modrá, černá",
  },
  {
    field: "excludedColors",
    label: "Vyloučené barvy",
    placeholder: "Bílá",
  },
]

function listToInput(value) {
  return Array.isArray(value) ? value.join(", ") : value || ""
}

function getInitialForm(demand) {
  if (!demand) return emptyDemandForm

  return {
    ...emptyDemandForm,
    ...demand,
    minPrice: demand.minPrice ?? "",
    maxPrice: demand.maxPrice ?? "",
    minYear: demand.minYear ?? "",
    maxYear: demand.maxYear ?? "",
    maxMileage: demand.maxMileage ?? "",
    minPowerKw: demand.minPowerKw ?? "",
    maxPowerKw: demand.maxPowerKw ?? "",
    makes: listToInput(demand.makes),
    models: listToInput(demand.models),
    bodyTypes: listToInput(demand.bodyTypes),
    fuelTypes: listToInput(demand.fuelTypes),
    transmissions: listToInput(demand.transmissions),
    drivetrains: listToInput(demand.drivetrains),
    requiredEquipment: listToInput(demand.requiredEquipment),
    preferredEquipment: listToInput(demand.preferredEquipment),
    preferredColors: listToInput(demand.preferredColors),
    excludedColors: listToInput(demand.excludedColors),
  }
}

export default function CustomerDemandForm({ demand, onSave, onCancel }) {
  const [form, setForm] = useState(() => getInitialForm(demand))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (saving) return

    const validation = validateCustomerDemand(form)
    if (!validation.valid) {
      setError(validation.error)
      return
    }

    setSaving(true)
    setError("")

    try {
      await onSave(form)
    } catch (saveError) {
      setError(saveError.message || "Poptávku se nepodařilo uložit.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="crmForm crmDemandForm" onSubmit={handleSubmit}>
      <div className="crmDemandSection">
        <div className="crmDemandSectionHeading">
          <h3>Základní informace</h3>
          <p>Název, stav, priorita a interní upřesnění poptávky.</p>
        </div>

        <div className="crmFormGrid">
          <label className="crmFormFullWidth">
            Název poptávky
            <input
              value={form.title}
              onChange={(event) => updateField("title", event.target.value)}
              placeholder="Například rodinné SUV do 500 000 Kč"
              required
            />
          </label>

          <label>
            Stav
            <select
              value={form.status}
              onChange={(event) => updateField("status", event.target.value)}
            >
              {customerDemandStatuses.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Priorita
            <select
              value={form.priority}
              onChange={(event) => updateField("priority", event.target.value)}
            >
              {customerDemandPriorities.map((priority) => (
                <option key={priority.value} value={priority.value}>
                  {priority.label}
                </option>
              ))}
            </select>
          </label>

          <label className="crmFormFullWidth">
            Poznámka
            <textarea
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              rows={4}
              placeholder="Doplňující informace k požadavkům zákazníka"
            />
          </label>
        </div>
      </div>

      <div className="crmDemandSection">
        <div className="crmDemandSectionHeading">
          <h3>Cena a základní parametry</h3>
          <p>Prázdná pole nejsou pro vyhledávání vozidla omezující.</p>
        </div>

        <div className="crmFormGrid">
          <label>
            Minimální cena
            <input
              type="number"
              min="0"
              step="1"
              value={form.minPrice}
              onChange={(event) => updateField("minPrice", event.target.value)}
            />
          </label>

          <label>
            Maximální cena
            <input
              type="number"
              min="0"
              step="1"
              value={form.maxPrice}
              onChange={(event) => updateField("maxPrice", event.target.value)}
            />
          </label>

          <label>
            Minimální rok
            <input
              type="number"
              min="0"
              step="1"
              value={form.minYear}
              onChange={(event) => updateField("minYear", event.target.value)}
            />
          </label>

          <label>
            Maximální rok
            <input
              type="number"
              min="0"
              step="1"
              value={form.maxYear}
              onChange={(event) => updateField("maxYear", event.target.value)}
            />
          </label>

          <label>
            Maximální nájezd (km)
            <input
              type="number"
              min="0"
              step="1"
              value={form.maxMileage}
              onChange={(event) =>
                updateField("maxMileage", event.target.value)
              }
            />
          </label>

          <span aria-hidden="true" className="crmDemandGridSpacer" />

          <label>
            Minimální výkon (kW)
            <input
              type="number"
              min="0"
              step="1"
              value={form.minPowerKw}
              onChange={(event) =>
                updateField("minPowerKw", event.target.value)
              }
            />
          </label>

          <label>
            Maximální výkon (kW)
            <input
              type="number"
              min="0"
              step="1"
              value={form.maxPowerKw}
              onChange={(event) =>
                updateField("maxPowerKw", event.target.value)
              }
            />
          </label>
        </div>
      </div>

      <div className="crmDemandSection">
        <div className="crmDemandSectionHeading">
          <h3>Požadované vozidlo</h3>
          <p>Více hodnot oddělte čárkou, středníkem nebo novým řádkem.</p>
        </div>

        <div className="crmFormGrid">
          {arrayInputs.map((input) => (
            <label key={input.field}>
              {input.label}
              <textarea
                value={form[input.field]}
                onChange={(event) =>
                  updateField(input.field, event.target.value)
                }
                rows={2}
                placeholder={input.placeholder}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="crmDemandSection">
        <div className="crmDemandSectionHeading">
          <h3>Výbava a barvy</h3>
          <p>Duplicity a prázdné hodnoty budou při uložení odstraněny.</p>
        </div>

        <div className="crmFormGrid">
          {preferenceInputs.map((input) => (
            <label key={input.field}>
              {input.label}
              <textarea
                value={form[input.field]}
                onChange={(event) =>
                  updateField(input.field, event.target.value)
                }
                rows={2}
                placeholder={input.placeholder}
              />
            </label>
          ))}
        </div>
      </div>

      {error && (
        <div className="crmFormError" role="alert">
          {error}
        </div>
      )}

      <div className="crmFormActions">
        <button
          type="button"
          className="secondaryButton"
          onClick={onCancel}
          disabled={saving}
        >
          Zrušit
        </button>
        <button type="submit" className="primaryButton" disabled={saving}>
          {saving
            ? "Ukládám…"
            : demand
              ? "Uložit změny"
              : "Vytvořit poptávku"}
        </button>
      </div>
    </form>
  )
}
