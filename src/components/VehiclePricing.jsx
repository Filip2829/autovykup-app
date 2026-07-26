import { useEffect, useMemo, useState } from "react";

function getPricingForm(car) {
  return {
    valuationDate: car?.valuationDate ?? "",
    customerExpectedPrice: car?.customerExpectedPrice ?? "",
    buyEstimate: car?.buyEstimate ?? "",
    saleEstimate: car?.saleEstimate ?? "",
    approvedPrice: car?.approvedPrice ?? "",
  };
}

export default function VehiclePricing({
  selectedCar,
  setSelectedCar,
  setCars,
  supabase,
  prepareCar,
  toNullableNumber,
  currentUsername,
  moduleContentRef,
  onSaved,
  validateBeforeSave,
}) {
  const [form, setForm] = useState(() => getPricingForm(selectedCar));
  const [savedForm, setSavedForm] = useState(() => getPricingForm(selectedCar));
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const nextForm = getPricingForm(selectedCar);
    setForm(nextForm);
    setSavedForm(nextForm);
    setSuccessMessage("");
    setErrorMessage("");
  }, [
    selectedCar?.id,
    selectedCar?.valuationDate,
    selectedCar?.customerExpectedPrice,
    selectedCar?.buyEstimate,
    selectedCar?.saleEstimate,
    selectedCar?.approvedPrice,
  ]);

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(savedForm),
    [form, savedForm]
  );

  function updatePricingField(key, value) {
    setForm((currentForm) => ({
      ...currentForm,
      [key]: value,
    }));
    setSuccessMessage("");
    setErrorMessage("");
  }

  function updatePricingPrice(key, value) {
    updatePricingField(key, value);
  }

  async function savePricing() {
    if (!selectedCar) return;
    if (validateBeforeSave && !validateBeforeSave(selectedCar)) return;

    setIsSaving(true);
    setSuccessMessage("");
    setErrorMessage("");

    const valuationDate = form.valuationDate || "";
    const customerExpectedPrice = toNullableNumber(form.customerExpectedPrice);
    const buyEstimate = toNullableNumber(form.buyEstimate);
    const saleEstimate = toNullableNumber(form.saleEstimate);
    const approvedPrice = toNullableNumber(form.approvedPrice);

    const updatedCar = {
      ...selectedCar,
      valuationDate,
      customerExpectedPrice: customerExpectedPrice ?? "",
      buyEstimate: buyEstimate ?? "",
      saleEstimate: saleEstimate ?? "",
      approvedPrice: approvedPrice ?? "",
    };
    const pricingPayload = {
      valuation_date: valuationDate || null,
      customer_expected_price: customerExpectedPrice,
      buy_estimate: buyEstimate,
      sale_estimate: saleEstimate,
      approved_price: approvedPrice,
      updated_by: currentUsername,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("cars")
      .update(pricingPayload)
      .eq("id", selectedCar.id)
      .select()
      .single();

    setIsSaving(false);

    if (error) {
      console.error(error);
      setErrorMessage(`Nacenění se nepodařilo uložit: ${error.message}`);
      return;
    }

    const savedCar = prepareCar(data || { ...updatedCar, ...pricingPayload });
    const nextForm = getPricingForm(savedCar);

    setSelectedCar(savedCar);
    setCars((currentCars) =>
      currentCars.map((car) =>
        car.id === savedCar.id ? { ...car, ...savedCar } : car
      )
    );
    setForm(nextForm);
    setSavedForm(nextForm);
    setSuccessMessage("Nacenění uloženo.");

    try {
      await onSaved?.(selectedCar, savedCar);
    } catch (syncError) {
      console.error("Automatická aktualizace shod vozidla selhala:", syncError);
    }
  }

  return (
    <div className="card decision" ref={moduleContentRef}>
      <h2>Nacenění vozu</h2>

      <div className="formGrid">
        <div>
          <p className="label">Datum nacenění</p>
          <input
            type="date"
            value={form.valuationDate || ""}
            onChange={(event) =>
              updatePricingField("valuationDate", event.target.value)
            }
            style={{ width: "100%" }}
          />
        </div>

        <div>
          <p className="label">Návrh výkupní ceny</p>
          <input
            type="number"
            min="0"
            step="1"
            placeholder="Návrh výkupní ceny"
            value={form.buyEstimate ?? ""}
            onChange={(event) =>
              updatePricingPrice("buyEstimate", event.target.value)
            }
            style={{ width: "100%" }}
          />
        </div>

        <div>
          <p className="label">Představa zákazníka</p>
          <input
            type="number"
            min="0"
            step="1"
            placeholder="Představa zákazníka"
            value={form.customerExpectedPrice ?? ""}
            onChange={(event) =>
              updatePricingPrice("customerExpectedPrice", event.target.value)
            }
            style={{ width: "100%" }}
          />
        </div>

        <div>
          <p className="label">Návrh prodejní ceny</p>
          <input
            type="number"
            min="0"
            step="1"
            placeholder="Návrh prodejní ceny"
            value={form.saleEstimate ?? ""}
            onChange={(event) =>
              updatePricingPrice("saleEstimate", event.target.value)
            }
            style={{ width: "100%" }}
          />
        </div>

        <div>
          <p className="label">Potvrzená výkupní cena</p>
          <input
            type="number"
            min="0"
            step="1"
            placeholder="Potvrzená výkupní cena"
            value={form.approvedPrice ?? ""}
            onChange={(event) =>
              updatePricingPrice("approvedPrice", event.target.value)
            }
            style={{ width: "100%" }}
          />
        </div>
      </div>

      {hasUnsavedChanges && (
        <p className="badText">Máte neuložené změny v nacenění.</p>
      )}
      {successMessage && <p className="okText">{successMessage}</p>}
      {errorMessage && <p className="badText">{errorMessage}</p>}

      <button className="success" onClick={savePricing} disabled={isSaving}>
        {isSaving ? "Ukládám…" : "Uložit nacenění"}
      </button>
    </div>
  );
}
