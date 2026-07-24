export default function VehicleChecklist({
  selectedCar,
  deleteCebiaFile,
  vehicleDocuments,
  vehicleDocumentsLoading,
  openVehicleDocumentModal,
  openVehicleDocument,
  downloadVehicleDocument,
  deleteVehicleDocument,
  formatFileSize,
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

      <h2>Dokumenty vozidla</h2>

      <button className="primary" onClick={openVehicleDocumentModal}>
        + Přidat dokument
      </button>

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
