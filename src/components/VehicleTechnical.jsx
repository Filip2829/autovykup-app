export default function VehicleTechnical({
  selectedCar,
  updateCar,
  analyzeVehicleTechnicalData,
  technicalAiLoading,
  moduleContentRef,
}) {
  function updateTechnicalParam(key, value) {
    if (!selectedCar) return;

    updateCar({
      ...selectedCar,
      technicalParams: {
        ...selectedCar.technicalParams,
        [key]: value,
      },
    });
  }

  function getTechnicalParam(key) {
    return selectedCar?.technicalParams?.[key] || "";
  }

  return (
    <div className="card decision" ref={moduleContentRef}>
      <h2>Technické parametry vozidla</h2>

      <button
        className="primary"
        onClick={analyzeVehicleTechnicalData}
        disabled={technicalAiLoading}
      >
        {technicalAiLoading
          ? "AI doplňuje technická data..."
          : "AI doplnit technická data"}
      </button>

      {selectedCar.aiDocumentReport && (
        <div className="aiReport">
          <h3>AI poznámka k technickým datům</h3>
          <pre>{selectedCar.aiDocumentReport}</pre>
        </div>
      )}

      <h3>Identifikace</h3>
      <div className="formGrid">
        <div>
          <p className="label">Značka</p>
          <input
            placeholder="Značka"
            value={getTechnicalParam("brand")}
            onChange={(event) =>
              updateTechnicalParam("brand", event.target.value)
            }
          />
        </div>

        <div>
          <p className="label">Model</p>
          <input
            placeholder="Model"
            value={getTechnicalParam("model")}
            onChange={(event) =>
              updateTechnicalParam("model", event.target.value)
            }
          />
        </div>

        <div>
          <p className="label">Verze / výbavový stupeň</p>
          <input
            placeholder="Verze / výbavový stupeň"
            value={getTechnicalParam("version")}
            onChange={(event) =>
              updateTechnicalParam("version", event.target.value)
            }
          />
        </div>

        <div>
          <p className="label">Výbava</p>
          <input
            placeholder="Výbava"
            value={getTechnicalParam("equipmentLevel")}
            onChange={(event) =>
              updateTechnicalParam("equipmentLevel", event.target.value)
            }
          />
        </div>

        <div>
          <p className="label">Kategorie / typ vozu</p>
          <input
            placeholder="Kategorie / typ vozu, např. SUV, kombi, hatchback"
            value={getTechnicalParam("bodyType")}
            onChange={(event) =>
              updateTechnicalParam("bodyType", event.target.value)
            }
          />
        </div>
      </div>

      <h3>Motor a pohon</h3>
      <div className="formGrid">
        <div>
          <p className="label">Palivo</p>
          <input
            placeholder="Palivo"
            value={getTechnicalParam("fuel")}
            onChange={(event) =>
              updateTechnicalParam("fuel", event.target.value)
            }
          />
        </div>

        <div>
          <p className="label">Objem motoru</p>
          <input
            placeholder="Objem motoru"
            value={getTechnicalParam("engine")}
            onChange={(event) =>
              updateTechnicalParam("engine", event.target.value)
            }
          />
        </div>

        <div>
          <p className="label">Výkon kW</p>
          <input
            placeholder="Výkon kW"
            value={getTechnicalParam("powerKw")}
            onChange={(event) =>
              updateTechnicalParam("powerKw", event.target.value)
            }
          />
        </div>

        <div>
          <p className="label">Převodovka</p>
          <input
            placeholder="Převodovka"
            value={getTechnicalParam("transmission")}
            onChange={(event) =>
              updateTechnicalParam("transmission", event.target.value)
            }
          />
        </div>

        <div>
          <p className="label">Pohon</p>
          <input
            placeholder="Pohon, např. přední, 4x4"
            value={getTechnicalParam("drive")}
            onChange={(event) =>
              updateTechnicalParam("drive", event.target.value)
            }
          />
        </div>
      </div>

      <h3>Karoserie</h3>
      <div className="formGrid">
        <div>
          <p className="label">Počet dveří</p>
          <input
            placeholder="Počet dveří"
            value={getTechnicalParam("doors")}
            onChange={(event) =>
              updateTechnicalParam("doors", event.target.value)
            }
          />
        </div>

        <div>
          <p className="label">Počet sedadel</p>
          <input
            placeholder="Počet míst / sedadel"
            value={getTechnicalParam("seats")}
            onChange={(event) =>
              updateTechnicalParam("seats", event.target.value)
            }
          />
        </div>

        <div>
          <p className="label">Barva</p>
          <input
            placeholder="Barva"
            value={getTechnicalParam("color")}
            onChange={(event) =>
              updateTechnicalParam("color", event.target.value)
            }
          />
        </div>
      </div>

      <h3>Registrace a nájezd</h3>
      <div className="formGrid">
        <div>
          <p className="label">První registrace</p>
          <input
            placeholder="První registrace"
            value={getTechnicalParam("firstRegistration")}
            onChange={(event) =>
              updateTechnicalParam("firstRegistration", event.target.value)
            }
          />
        </div>

        <div>
          <p className="label">Rok výroby</p>
          <input
            placeholder="Rok výroby"
            value={getTechnicalParam("productionYear")}
            onChange={(event) =>
              updateTechnicalParam("productionYear", event.target.value)
            }
          />
        </div>

        <div>
          <p className="label">Platnost STK / STK do</p>
          <input
            type="date"
            placeholder="STK do"
            value={getTechnicalParam("stkValidUntil")}
            onChange={(event) =>
              updateTechnicalParam("stkValidUntil", event.target.value)
            }
          />
        </div>
      </div>
    </div>
  );
}
