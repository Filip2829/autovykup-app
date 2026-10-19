import { useEffect, useMemo, useState } from "react";
import {
  buildVehiclePriceRangePayload,
  readPriceRange,
  validateVehiclePriceRanges,
  vehiclePriceRangeFields,
} from "../utils/vehiclePriceRange.js";

function getPricingForm(car) {
  const priceValues = Object.fromEntries(
    vehiclePriceRangeFields.flatMap((field) => {
      const range = readPriceRange(car, field);
      return [
        [field.key, range.min ?? ""],
        [field.maxKey, range.max ?? ""],
      ];
    })
  );
  return {
    valuationDate: car?.valuationDate ?? car?.valuation_date ?? "",
    ...priceValues,
  };
}

export default function VehiclePricing({
  selectedCar,
  setSelectedCar,
  setCars,
  supabase,
  prepareCar,
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
    selectedCar?.customerExpectedPriceMax,
    selectedCar?.buyEstimate,
    selectedCar?.buyEstimateMax,
    selectedCar?.saleEstimate,
    selectedCar?.saleEstimateMax,
    selectedCar?.approvedPrice,
    selectedCar?.approvedPriceMax,
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

  async function savePricing() {
    if (!selectedCar) return;
    if (validateBeforeSave && !validateBeforeSave(selectedCar)) return;

    const validationError = validateVehiclePriceRanges(form);
    if (validationError) {
      setErrorMessage(validationError);
      setSuccessMessage("");
      return;
    }

    setIsSaving(true);
    setSuccessMessage("");
    setErrorMessage("");

    const valuationDate = form.valuationDate || "";
    const pricePayload = buildVehiclePriceRangePayload(form);

    const updatedCar = {
      ...selectedCar,
      valuationDate,
      ...Object.fromEntries(
        vehiclePriceRangeFields.flatMap((field) => [
          [field.key, pricePayload[field.dbKey] ?? ""],
          [field.maxKey, pricePayload[field.dbMaxKey] ?? ""],
        ])
      ),
    };
    const pricingPayload = {
      valuation_date: valuationDate || null,
      ...pricePayload,
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

        {vehiclePriceRangeFields.map((field) => (
          <div key={field.key}>
            <p className="label">{field.label}</p>
            <div className="priceRangeInputs">
              <label>
                <span>Od</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Jedna cena nebo od"
                  value={form[field.key] ?? ""}
                  onChange={(event) =>
                    updatePricingField(field.key, event.target.value)
                  }
                />
              </label>
              <span className="priceRangeSeparator">–</span>
              <label>
                <span>Do <small>(volitelné)</small></span>
                <input
                  type="number"
                  min={form[field.key] || "0"}
                  step="1"
                  placeholder="Horní hranice"
                  value={form[field.maxKey] ?? ""}
                  onChange={(event) =>
                    updatePricingField(field.maxKey, event.target.value)
                  }
                />
              </label>
              <span className="priceRangeCurrency">Kč</span>
            </div>
          </div>
        ))}
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
