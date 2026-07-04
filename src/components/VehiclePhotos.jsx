export default function VehiclePhotos({
  selectedCar,
  addPhoto,
  downloadPhoto,
  deletePhoto,
  moduleContentRef,
}) {
  return (
    <div className="card decision" ref={moduleContentRef}>
      <h2>Fotky vozu</h2>

      <label className="uploadBox">
        Začít fotit / nahrát fotky
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={addPhoto}
        />
      </label>

      <div className="photoGrid">
        {selectedCar.photos.map((photo, index) => (
          <div key={index} className="photoItem">
            <img
              src={photo}
              alt={`Fotka vozu ${index + 1}`}
              onClick={() => window.open(photo, "_blank")}
              style={{ cursor: "pointer" }}
            />

            <div className="photoActions">
              <button
                className="primary outline"
                onClick={() => downloadPhoto(photo, index)}
              >
                Stáhnout
              </button>

              <button
                className="danger outlineDanger"
                onClick={() => deletePhoto(index)}
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
