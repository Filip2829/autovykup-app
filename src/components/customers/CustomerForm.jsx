import { useState } from "react"
import { validateCustomer } from "../../services/customers"

const emptyForm = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  notes: "",
  status: "active",
  lastContactAt: "",
  nextContactAt: "",
}

function toLocalDate(value) {
  if (!value) return ""

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 10)
}

function getInitialForm(customer) {
  if (!customer) return emptyForm

  return {
    firstName: customer.firstName || "",
    lastName: customer.lastName || "",
    phone: customer.phone || "",
    email: customer.email || "",
    notes: customer.notes || "",
    status: customer.status || "active",
    lastContactAt: toLocalDate(customer.lastContactAt),
    nextContactAt: toLocalDate(customer.nextContactAt),
  }
}

export default function CustomerForm({ customer, onSave, onCancel }) {
  const [form, setForm] = useState(() => getInitialForm(customer))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (saving) return

    const validation = validateCustomer(form)
    if (!validation.valid) {
      setError(validation.error)
      return
    }

    setSaving(true)
    setError("")

    try {
      await onSave(form)
    } catch (saveError) {
      setError(saveError.message || "Zákazníka se nepodařilo uložit.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="crmPage crmFormPage" aria-labelledby="crmCustomerFormTitle">
      <div className="crmPageHeader">
        <div>
          <button type="button" className="backButton" onClick={onCancel} disabled={saving}>
            ← Zpět
          </button>
          <h1 id="crmCustomerFormTitle">
            {customer ? "Upravit zákazníka" : "Nový zákazník"}
          </h1>
          <p>Uložení proběhne až po potvrzení formuláře.</p>
        </div>
      </div>

      <form className="crmForm" onSubmit={handleSubmit}>
        <div className="crmFormGrid">
          <label>
            Jméno
            <input
              value={form.firstName}
              onChange={(event) => updateField("firstName", event.target.value)}
              autoComplete="given-name"
            />
          </label>

          <label>
            Příjmení
            <input
              value={form.lastName}
              onChange={(event) => updateField("lastName", event.target.value)}
              autoComplete="family-name"
            />
          </label>

          <label>
            Telefon
            <input
              type="tel"
              value={form.phone}
              onChange={(event) => updateField("phone", event.target.value)}
              autoComplete="tel"
            />
          </label>

          <label>
            E-mail
            <input
              type="email"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              autoComplete="email"
            />
          </label>

          <label>
            Stav
            <select
              value={form.status}
              onChange={(event) => updateField("status", event.target.value)}
            >
              <option value="active">Aktivní</option>
              <option value="inactive">Neaktivní</option>
              <option value="archived">Archivovaný</option>
            </select>
          </label>

          <label>
            Poslední kontakt
            <input
              type="date"
              value={form.lastContactAt}
              onChange={(event) => updateField("lastContactAt", event.target.value)}
            />
          </label>

          <label>
            Kontaktovat znovu
            <input
              type="date"
              value={form.nextContactAt}
              onChange={(event) => updateField("nextContactAt", event.target.value)}
            />
          </label>
        </div>

        <label>
          Poznámky
          <textarea
            className="crmNotesField"
            value={form.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            rows={7}
          />
        </label>

        {error && (
          <div className="crmFormError" role="alert">
            {error}
          </div>
        )}

        <div className="crmFormActions">
          <button type="button" className="secondaryButton" onClick={onCancel} disabled={saving}>
            Zrušit
          </button>
          <button type="submit" className="primaryButton" disabled={saving}>
            {saving
              ? "Ukládám…"
              : customer
                ? "Uložit změny"
                : "Vytvořit zákazníka"}
          </button>
        </div>
      </form>
    </section>
  )
}
