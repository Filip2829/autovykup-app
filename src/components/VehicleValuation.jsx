export default function VehicleValuation({
  selectedCar,
  setSelectedCar,
  setCars,
  supabase,
  prepareCar,
  calculateStatus,
  toNullableNumber,
  currentUsername,
  moduleContentRef,
}) {
  function updateValuationField(key, value) {
    if (!selectedCar) return;

    const updatedCar = {
      ...selectedCar,
      [key]: value,
    };

    setSelectedCar(updatedCar);
    setCars((currentCars) =>
      currentCars.map((car) => (car.id === updatedCar.id ? updatedCar : car))
    );
  }

  function updateValuationPrice(key, value) {
    updateValuationField(key, value === "" ? "" : Number(value));
  }

  async function saveValuation() {
    if (!selectedCar) return;

    const valuationDate = selectedCar.valuationDate || "";
    const customerExpectedPrice = toNullableNumber(
      selectedCar.customerExpectedPrice
    );
    const buyEstimate = toNullableNumber(selectedCar.buyEstimate);
    const saleEstimate = toNullableNumber(selectedCar.saleEstimate);
    const approvedPrice = toNullableNumber(selectedCar.approvedPrice);

    const updatedCar = {
      ...selectedCar,
      valuationDate,
      customerExpectedPrice: customerExpectedPrice ?? "",
      buyEstimate: buyEstimate ?? "",
      saleEstimate: saleEstimate ?? "",
      approvedPrice: approvedPrice ?? "",
    };
    const status = calculateStatus(updatedCar);

    const valuationPayload = {
      valuation_date: valuationDate || null,
      customer_expected_price: customerExpectedPrice,
      buy_estimate: buyEstimate,
      sale_estimate: saleEstimate,
      approved_price: approvedPrice,
      status,
      updated_by: currentUsername,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("cars")
      .update(valuationPayload)
      .eq("id", selectedCar.id)
      .select()
      .single();

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    const savedCar = prepareCar(data || { ...updatedCar, ...valuationPayload });

    setSelectedCar(savedCar);
    setCars((currentCars) =>
      currentCars.map((car) =>
        car.id === savedCar.id ? { ...car, ...savedCar } : car
      )
    );

    alert("Nacenění uloženo.");
  }

  return (
    <div className="card decision" ref={moduleContentRef}>
      <h2>Nacenění vozu</h2>

      <div className="formGrid">
        <div>
          <p className="label">Datum nacenění</p>
          <input
            type="date"
            value={selectedCar.valuationDate || ""}
            onChange={(event) =>
              updateValuationField("valuationDate", event.target.value)
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
            value={selectedCar.buyEstimate ?? ""}
            onChange={(event) =>
              updateValuationPrice("buyEstimate", event.target.value)
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
            value={selectedCar.customerExpectedPrice ?? ""}
            onChange={(event) =>
              updateValuationPrice(
                "customerExpectedPrice",
                event.target.value
              )
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
            value={selectedCar.saleEstimate ?? ""}
            onChange={(event) =>
              updateValuationPrice("saleEstimate", event.target.value)
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
            value={selectedCar.approvedPrice ?? ""}
            onChange={(event) =>
              updateValuationPrice("approvedPrice", event.target.value)
            }
            style={{ width: "100%" }}
          />
        </div>
      </div>

      <button className="success" onClick={saveValuation}>
        Uložit nacenění
      </button>
    </div>
  );
}
