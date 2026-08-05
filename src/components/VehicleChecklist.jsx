import AppSelect from "./ui/AppSelect";

export default function VehicleChecklist({
  selectedCar,
  updateCar,
  dealTypeOptions,
  deleteCebiaFile,
  vehicleDocuments,
  vehicleDocumentsLoading,
  openVehicleDocumentModal,
  openVehicleDocument,
  downloadVehicleDocument,
  deleteVehicleDocument,
  formatFileSize,
  analyzeVehicleTechnicalData,
  technicalAiLoading,
  moduleContentRef,
}) {
  return (
    <div className="card decision" ref={moduleContentRef}>
      <h2>Administrativa</h2>

      <div className="fileList">
        {selectedCar.cebiaFiles.map((url, index) => (
          <div key={`cebia-${index}`} className="fileRow">
            <a href={url} target="_blank" rel="noreferrer">
              CEBIA {index + 1}
            </a>

            <button
              className="danger outlineDanger"
              onClick={() => deleteCebiaFile(index)}
            >
              Smazat
            </button>
          </div>
        ))}
      </div>

      <hr />

      <h2>Obchodní informace</h2>

      <div className="formGrid">
        <div>
          <p className="label">Typ obchodu</p>
          <AppSelect
            ariaLabel="Typ obchodu"
            value={selectedCar.dealType || "buyout"}
            options={dealTypeOptions}
            onChange={(value) =>
              updateCar({ ...selectedCar, dealType: value })
            }
          />
        </div>

        <div>
          <p className="label">Prodejce protiúčtu</p>
          <input
            placeholder="Prodejce protiúčtu"
            value={selectedCar.tradeInSource || ""}
            onChange={(event) =>
              updateCar({
                ...selectedCar,
                tradeInSource: event.target.value,
              })
            }
          />
        </div>

        {selectedCar.dealType === "commission" && (
          <div>
            <p className="label">Poznámky ke komisi</p>
            <textarea
              placeholder="Poznámky ke komisi"
              value={selectedCar.commissionNotes || ""}
              onChange={(event) =>
                updateCar({
                  ...selectedCar,
                  commissionNotes: event.target.value,
                })
              }
            />
          </div>
        )}
      </div>

      <hr />

      <h2>Dokumenty vozidla</h2>

      <p>
        Nahrajte CEBIA, technický průkaz nebo další podklady. Stejné dokumenty
        lze následně použít pro AI doplnění technických údajů.
      </p>

      <div className="documentActionRow">
        <button className="primary" onClick={openVehicleDocumentModal}>
          + Přidat dokument
        </button>

        <button
          className="primary outline"
          onClick={analyzeVehicleTechnicalData}
          disabled={technicalAiLoading}
        >
          {technicalAiLoading
            ? "AI načítá technické údaje…"
            : "AI načíst technické údaje"}
        </button>
      </div>

      {vehicleDocumentsLoading && <p>Načítám dokumenty...</p>}

      {!vehicleDocumentsLoading && vehicleDocuments.length === 0 && (
        <p>Zatím nejsou nahrané žádné dokumenty.</p>
      )}

      <div className="fileList">
        {vehicleDocuments.map((document) => (
          <div key={document.id} className="fileRow">
            <div>
              <strong>{document.title}</strong>
              <p className="label">{document.category}</p>
              {document.description && <p>{document.description}</p>}
              {document.fileName && (
                <p className="label">
                  {document.fileName}
                  {document.fileSize
                    ? ` · ${formatFileSize(document.fileSize)}`
                    : ""}
                </p>
              )}
            </div>

            <div className="photoActions">
              <button
                className="primary outline"
                onClick={() => openVehicleDocument(document)}
              >
                Otevřít
              </button>

              <button
                className="primary outline"
                onClick={() => downloadVehicleDocument(document)}
              >
                Stáhnout
              </button>

              <button
                className="danger outlineDanger"
                onClick={() => deleteVehicleDocument(document)}
              >
                Smazat
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
