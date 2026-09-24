import { useState } from "react";
import {
  analyzeTirePhotos,
  MAX_TIRE_ANALYSIS_PHOTOS,
} from "../../services/tirePhotoAnalysis.js";

export default function TirePhotoIntake({ onAnalyzed, onCancel }) {
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleAnalyze() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const analysis = await analyzeTirePhotos(files);
      onAnalyzed(analysis, files);
    } catch (analysisError) {
      setError(analysisError.message || "Fotografie se nepodařilo analyzovat.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="tirePhotoIntake" aria-labelledby="tirePhotoIntakeTitle">
      <div className="tireFormHeader">
        <div>
          <h2 id="tirePhotoIntakeTitle">Nová sada z fotografií</h2>
          <p>AI předvyplní pouze čitelné údaje. Nejasné hodnoty zůstanou prázdné.</p>
        </div>
        <button type="button" className="secondaryButton" onClick={onCancel} disabled={busy}>
          Zavřít
        </button>
      </div>

      <label className="tireAnalysisUpload">
        Fotografie pneumatik a disků
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={busy}
          onChange={(event) => {
            setFiles(Array.from(event.target.files || []).slice(0, MAX_TIRE_ANALYSIS_PHOTOS));
            setError("");
          }}
        />
        <small>
          Nahrajte detail bočnice, DOT, vzorku s měrkou a označení disku. Maximálně {MAX_TIRE_ANALYSIS_PHOTOS} fotografií.
        </small>
      </label>

      {files.length > 0 && (
        <p className="tireAnalysisFiles">Vybráno: {files.map((file) => file.name).join(", ")}</p>
      )}
      {error && <p className="tireError" role="alert">{error}</p>}
      <div className="tireFormActions">
        <button type="button" className="primaryButton" onClick={handleAnalyze} disabled={busy || files.length === 0}>
          {busy ? "Analyzuji fotografie…" : "Analyzovat a předvyplnit"}
        </button>
      </div>
    </section>
  );
}
