import { useEffect, useMemo, useState } from "react";
import {
  createTireSet,
  deleteTireSetPhoto,
  filterTireSets,
  formatTireAge,
  loadTireSetPhotos,
  loadTireSets,
  MAX_TIRE_PHOTOS,
  retireTireSet,
  tireAssemblyTypes,
  tireSeasons,
  tireSetStatuses,
  updateTireSet,
  uploadTireSetPhoto,
  validateTireSet,
} from "../../services/tireSets.js";
import TirePhotoIntake from "./TirePhotoIntake.jsx";
import "./tires.css";

const emptyTireSet = {
  storageNumber: "",
  name: "",
  tireSize: "",
  treadDepthMm: "",
  dotCode: "",
  season: "winter",
  assemblyType: "tires_only",
  boltPattern: "",
  et: "",
  quantity: 4,
  status: "in_stock",
  notes: "",
};

function labelFor(options, value) {
  return options.find((option) => option.value === value)?.label || value;
}

function findFreeStorageNumber(items) {
  const occupied = new Set(
    items
      .filter((item) => item.status !== "retired")
      .map((item) => Number(item.storageNumber))
  );
  for (let number = 1; number <= 100; number += 1) {
    if (!occupied.has(number)) return number;
  }
  return "";
}

function TireSetForm({ tireSet, allSets, onSaved, onCancel }) {
  const [form, setForm] = useState(tireSet || emptyTireSet);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const editing = Boolean(tireSet?.id);
  const hasWheels = ["steel_wheels", "alloy_wheels"].includes(form.assemblyType);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;
    const validation = validateTireSet(form, allSets);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const saved = editing
        ? await updateTireSet(form.id, form)
        : await createTireSet(form);
      onSaved(saved);
    } catch (saveError) {
      setError(saveError.message || "Sadu se nepodařilo uložit.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="tireForm" onSubmit={handleSubmit}>
      <div className="tireFormHeader">
        <div>
          <h2>{editing ? "Upravit sadu" : "Přidat sadu"}</h2>
          <p>Číslo označuje fyzickou sadu ve skladu.</p>
        </div>
        <button type="button" className="secondaryButton" onClick={onCancel}>
          Zavřít
        </button>
      </div>

      {(form.analysisSummary || form.analysisWarnings?.length > 0) && (
        <div className="tireAnalysisResult" role="status">
          <strong>Výsledek rozpoznání fotografií</strong>
          {form.analysisSummary && <p>{form.analysisSummary}</p>}
          {form.analysisWarnings?.length > 0 && (
            <ul>
              {form.analysisWarnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          )}
          <p>Než sadu uložíte, zkontrolujte všechny předvyplněné údaje.</p>
        </div>
      )}

      <div className="tireFormGrid">
        <label>
          Skladové číslo 1–100
          <input
            type="number"
            min="1"
            max="100"
            required
            value={form.storageNumber}
            onChange={(event) => updateField("storageNumber", event.target.value)}
          />
        </label>
        <label>
          Název pneumatik
          <input
            type="text"
            required
            placeholder="Např. Continental WinterContact"
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
          />
        </label>
        <label>
          Rozměr
          <input
            type="text"
            placeholder="Např. 205/55 R16"
            value={form.tireSize}
            onChange={(event) => updateField("tireSize", event.target.value)}
          />
        </label>
        <label>
          Vzorek přibližně (mm)
          <input
            type="number"
            min="0"
            step="0.1"
            placeholder="Např. 6,5"
            value={form.treadDepthMm}
            onChange={(event) => updateField("treadDepthMm", event.target.value)}
          />
        </label>
        <label>
          DOT (týden a rok výroby)
          <input
            type="text"
            inputMode="numeric"
            maxLength="4"
            placeholder="Např. 2321"
            value={form.dotCode}
            onChange={(event) => updateField("dotCode", event.target.value)}
          />
          <small>
            {form.dotCode
              ? formatTireAge(form.dotCode)
              : "Pokud DOT na fotografii není čitelný, ponechte pole prázdné."}
          </small>
        </label>
        <label>
          Sezóna
          <select value={form.season} onChange={(event) => updateField("season", event.target.value)}>
            {!form.season && <option value="">Vyberte sezónu</option>}
            {tireSeasons.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          Provedení
          <select
            value={form.assemblyType}
            onChange={(event) => updateField("assemblyType", event.target.value)}
          >
            {!form.assemblyType && <option value="">Vyberte provedení</option>}
            {tireAssemblyTypes.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        {hasWheels && (
          <>
            <label>
              Rozteč
              <input
                type="text"
                placeholder="Např. 5×112"
                value={form.boltPattern}
                onChange={(event) => updateField("boltPattern", event.target.value)}
              />
            </label>
            <label>
              ET
              <input
                type="number"
                step="1"
                placeholder="Např. 45"
                value={form.et}
                onChange={(event) => updateField("et", event.target.value)}
              />
            </label>
          </>
        )}
        <label>
          Počet kusů
          <input
            type="number"
            min="1"
            max="20"
            required
            value={form.quantity}
            onChange={(event) => updateField("quantity", event.target.value)}
          />
        </label>
        <label>
          Stav
          <select value={form.status} onChange={(event) => updateField("status", event.target.value)}>
            {tireSetStatuses
              .filter((option) => option.value !== "retired")
              .map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
          </select>
        </label>
      </div>

      <label className="tireNotesField">
        Poznámka
        <textarea
          rows="4"
          placeholder="Stav, umístění ve skladu nebo další informace"
          value={form.notes}
          onChange={(event) => updateField("notes", event.target.value)}
        />
      </label>

      {error && <p className="tireError" role="alert">{error}</p>}
      <div className="tireFormActions">
        <button type="submit" className="primaryButton" disabled={saving}>
          {saving ? "Ukládám…" : "Uložit sadu"}
        </button>
      </div>
    </form>
  );
}

export default function TireInventory({ onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("active");
  const [season, setSeason] = useState("all");
  const [assemblyType, setAssemblyType] = useState("all");
  const [editing, setEditing] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [photoBusySetId, setPhotoBusySetId] = useState(null);
  const [photoIntakeOpen, setPhotoIntakeOpen] = useState(false);
  const [pendingPhotoFiles, setPendingPhotoFiles] = useState([]);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [loadedItems, loadedPhotos] = await Promise.all([
        loadTireSets(),
        loadTireSetPhotos(),
      ]);
      setItems(loadedItems);
      setPhotos(loadedPhotos);
    } catch (loadError) {
      setError(loadError.message || "Pneumatiky se nepodařilo načíst.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    Promise.all([loadTireSets(), loadTireSetPhotos()])
      .then(([loadedItems, loadedPhotos]) => {
        if (active) {
          setItems(loadedItems);
          setPhotos(loadedPhotos);
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError.message || "Pneumatiky se nepodařilo načíst.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredItems = useMemo(
    () =>
      filterTireSets(items, {
        query,
        status: status === "active" ? "all" : status,
        season,
        assemblyType,
      }).filter((item) => status !== "active" || item.status !== "retired"),
    [items, query, status, season, assemblyType]
  );
  const occupiedCount = new Set(
    items.filter((item) => item.status !== "retired").map((item) => item.storageNumber)
  ).size;

  function startNew() {
    setPhotoIntakeOpen(false);
    setPendingPhotoFiles([]);
    setEditing({
      ...emptyTireSet,
      storageNumber: findFreeStorageNumber(items),
    });
  }

  function startPhotoIntake() {
    setEditing(null);
    setPendingPhotoFiles([]);
    setPhotoIntakeOpen(true);
  }

  function handlePhotosAnalyzed(analysis, files) {
    setPendingPhotoFiles(files);
    setPhotoIntakeOpen(false);
    setEditing({
      ...emptyTireSet,
      ...analysis.draft,
      storageNumber: findFreeStorageNumber(items),
      status: "in_stock",
      notes: "",
      analysisSummary: analysis.summary,
      analysisWarnings: analysis.warnings,
    });
  }

  async function handleSaved(saved) {
    setItems((current) => {
      const exists = current.some((item) => item.id === saved.id);
      return exists
        ? current.map((item) => (item.id === saved.id ? saved : item))
        : [...current, saved];
    });
    if (pendingPhotoFiles.length > 0) {
      const uploaded = [];
      try {
        for (const file of pendingPhotoFiles) {
          uploaded.push(await uploadTireSetPhoto(saved.id, file));
        }
        setPhotos((current) => [...current, ...uploaded]);
      } catch (uploadError) {
        setError(
          `Sada byla vytvořena, ale některé fotografie se nepodařilo uložit: ${uploadError.message || "neznámá chyba"}`
        );
        await refresh();
      }
    }
    setPendingPhotoFiles([]);
    setEditing(null);
  }

  async function handleRetire(item) {
    if (!window.confirm(`Vyřadit sadu č. ${item.storageNumber}? Číslo se uvolní pro další sadu.`)) return;
    try {
      const retired = await retireTireSet(item.id);
      setItems((current) => current.map((entry) => (entry.id === retired.id ? retired : entry)));
    } catch (retireError) {
      setError(retireError.message || "Sadu se nepodařilo vyřadit.");
    }
  }

  async function handlePhotoUpload(item, fileList, input) {
    const files = Array.from(fileList || []);
    const existingCount = photos.filter((photo) => photo.tireSetId === item.id).length;
    if (files.length === 0) return;
    if (existingCount + files.length > MAX_TIRE_PHOTOS) {
      setError(`Jedna sada může mít maximálně ${MAX_TIRE_PHOTOS} fotografií.`);
      input.value = "";
      return;
    }

    setPhotoBusySetId(item.id);
    setError("");
    try {
      const uploaded = [];
      for (const file of files) {
        uploaded.push(await uploadTireSetPhoto(item.id, file));
      }
      setPhotos((current) => [...current, ...uploaded]);
    } catch (uploadError) {
      setError(uploadError.message || "Fotografie se nepodařilo nahrát.");
      await refresh();
    } finally {
      input.value = "";
      setPhotoBusySetId(null);
    }
  }

  async function handlePhotoDelete(item, photo) {
    if (!window.confirm(`Smazat fotografii „${photo.fileName}“?`)) return;
    setPhotoBusySetId(item.id);
    setError("");
    try {
      await deleteTireSetPhoto(photo);
      setPhotos((current) => current.filter((entry) => entry.id !== photo.id));
    } catch (deleteError) {
      setError(deleteError.message || "Fotografii se nepodařilo smazat.");
    } finally {
      setPhotoBusySetId(null);
    }
  }

  return (
    <section className="tirePage" aria-labelledby="tireInventoryTitle">
      <div className="tirePageHeader">
        <div>
          <button type="button" className="backButton" onClick={onBack}>← Zpět na rozcestník</button>
          <h1 id="tireInventoryTitle">Pneumatiky a kola</h1>
          <p>Evidence fyzicky označených sad v bazaru.</p>
        </div>
        <div className="tireHeaderActions">
          <button type="button" className="secondaryButton" onClick={startPhotoIntake} disabled={occupiedCount >= 100}>
            Přidat z fotografií
          </button>
          <button type="button" className="primaryButton" onClick={startNew} disabled={occupiedCount >= 100}>
            Přidat ručně
          </button>
        </div>
      </div>

      <div className="tireStats">
        <div><strong>{occupiedCount}</strong><span>obsazených čísel</span></div>
        <div><strong>{100 - occupiedCount}</strong><span>volných čísel</span></div>
        <div><strong>{items.filter((item) => item.status === "reserved").length}</strong><span>rezervovaných</span></div>
      </div>

      {photoIntakeOpen && (
        <TirePhotoIntake
          onAnalyzed={handlePhotosAnalyzed}
          onCancel={() => setPhotoIntakeOpen(false)}
        />
      )}

      {editing && (
        <TireSetForm
          key={editing.id || `new-${editing.storageNumber}`}
          tireSet={editing}
          allSets={items}
          onSaved={handleSaved}
          onCancel={() => {
            setPendingPhotoFiles([]);
            setEditing(null);
          }}
        />
      )}

      <div className="tireFilters">
        <label>Hledat<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Číslo, název, rozměr, DOT nebo rozteč" /></label>
        <label>Stav<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="active">Aktuálně evidované</option><option value="all">Vše včetně historie</option>{tireSetStatuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label>Sezóna<select value={season} onChange={(event) => setSeason(event.target.value)}><option value="all">Všechny</option>{tireSeasons.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label>Provedení<select value={assemblyType} onChange={(event) => setAssemblyType(event.target.value)}><option value="all">Všechna</option>{tireAssemblyTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      </div>

      {error && !loading && (
        <div className="tireState tireError" role="alert">
          <p>{error}</p>
          <button type="button" className="secondaryButton" onClick={refresh}>
            Obnovit přehled
          </button>
        </div>
      )}

      {loading ? (
        <div className="tireState">Načítám pneumatiky…</div>
      ) : filteredItems.length === 0 ? (
        <div className="tireState">Žádná sada neodpovídá zvoleným filtrům.</div>
      ) : (
        <div className="tireList">
          {filteredItems.map((item) => {
            const itemPhotos = photos.filter((photo) => photo.tireSetId === item.id);
            const photoBusy = photoBusySetId === item.id;
            return (
              <article key={item.id} className={`tireCard tireCard-${item.status}`}>
              <div className="tireNumber">{item.storageNumber}</div>
              <div className="tireIdentity">
                <h2>{item.name}</h2>
                <p>{item.tireSize || "Rozměr neuveden"} · {item.quantity} ks</p>
                {item.notes && <small>{item.notes}</small>}
              </div>
              <div className="tireDetails">
                <span><small>Sezóna</small>{labelFor(tireSeasons, item.season)}</span>
                <span><small>Provedení</small>{labelFor(tireAssemblyTypes, item.assemblyType)}</span>
                <span><small>Vzorek</small>{item.treadDepthMm === "" ? "Neuveden" : `${item.treadDepthMm} mm`}</span>
                <span><small>DOT / stáří</small>{item.dotCode ? `${item.dotCode} · ${formatTireAge(item.dotCode)}` : "Nečitelné / neuvedeno"}</span>
                <span><small>Rozteč / ET</small>{item.assemblyType === "tires_only" ? "Bez disků" : `${item.boltPattern || "—"} / ET ${item.et === "" ? "—" : item.et}`}</span>
              </div>
              <div className="tireCardActions">
                <span className={`tireStatus tireStatus-${item.status}`}>{labelFor(tireSetStatuses, item.status)}</span>
                {item.status !== "retired" && <button type="button" className="secondaryButton" onClick={() => setEditing(item)}>Upravit</button>}
                {item.status !== "retired" && <button type="button" className="dangerButton" onClick={() => handleRetire(item)}>Vyřadit</button>}
              </div>

              <div className="tirePhotos">
                <div className="tirePhotosHeader">
                  <strong>Fotografie ({itemPhotos.length}/{MAX_TIRE_PHOTOS})</strong>
                  {item.status !== "retired" && itemPhotos.length < MAX_TIRE_PHOTOS && (
                    <label className={`secondaryButton tirePhotoUpload${photoBusy ? " tirePhotoUpload-disabled" : ""}`}>
                      {photoBusy ? "Nahrávám…" : "Přidat fotky"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        disabled={photoBusy}
                        onChange={(event) =>
                          handlePhotoUpload(item, event.target.files, event.target)
                        }
                      />
                    </label>
                  )}
                </div>
                {itemPhotos.length === 0 ? (
                  <p className="tirePhotosEmpty">Zatím bez fotografií.</p>
                ) : (
                  <div className="tirePhotoGrid">
                    {itemPhotos.map((photo) => (
                      <figure key={photo.id} className="tirePhoto">
                        <a href={photo.signedUrl} target="_blank" rel="noreferrer">
                          <img src={photo.signedUrl} alt={`${item.name} – ${photo.fileName}`} />
                        </a>
                        {item.status !== "retired" && (
                          <button
                            type="button"
                            aria-label={`Smazat fotografii ${photo.fileName}`}
                            disabled={photoBusy}
                            onClick={() => handlePhotoDelete(item, photo)}
                          >
                            ×
                          </button>
                        )}
                      </figure>
                    ))}
                  </div>
                )}
              </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
