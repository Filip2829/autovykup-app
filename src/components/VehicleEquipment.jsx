import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase.js";
import { readCebiaEquipment } from "../services/cebiaEquipment.js";
import { buildEquipmentDetailsUpdate, equipmentGroups, equipmentLabels, getEquipmentDetails, normalizeEquipment } from "../utils/vehicleEquipment.js";
import "./VehicleEquipment.css";

export default function VehicleEquipment({ selectedCar, updateCar, moduleContentRef, vehicleDocuments = [], vehicleDocumentsLoading = false }) {
  const [query, setQuery] = useState("");
  const [filling, setFilling] = useState(false);
  const [fillStatus, setFillStatus] = useState("");
  const taskRef = useRef(0);
  const busyRef = useRef(false);
  useEffect(() => () => { taskRef.current += 1; }, []);
  const equipment = normalizeEquipment(selectedCar.equipment);
  const details = getEquipmentDetails(selectedCar);
  const twoKeys = details.twoKeys ?? (selectedCar.checklist?.["Počet klíčů 2x"] === true ? "yes" : "");
  const search = query.trim().toLocaleLowerCase("cs-CZ");
  const groups = equipmentGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => `${group.title} ${equipmentLabels[item] || item}`.toLocaleLowerCase("cs-CZ").includes(search)),
  })).filter((group) => group.items.length > 0);

  function updateDetail(field, value) {
    updateCar(buildEquipmentDetailsUpdate(selectedCar, field, value));
  }

  async function fillEquipment() {
    if (busyRef.current || vehicleDocumentsLoading) return;
    busyRef.current = true;
    const task = ++taskRef.current;
    setFilling(true);
    setFillStatus("");
    try {
      const result = await readCebiaEquipment({
        car: selectedCar, documents: vehicleDocuments,
        invoke: (name, options) => supabase.functions.invoke(name, options),
        createSignedUrl: async (filePath) => {
          const { data, error } = await supabase.storage.from("vehicle-documents").createSignedUrl(filePath, 600);
          if (error) throw new Error("Dokument CEBIA se nepodařilo načíst. Zkuste to znovu.");
          return data?.signedUrl || "";
        },
      });
      if (task !== taskRef.current) return;
      if (!result.addedCount) {
        setFillStatus("V podkladech nejsou další potvrzené položky k doplnění. Ručně zadaná výbava zůstává zachována.");
        return;
      }
      const saved = await updateCar(result.car);
      if (task !== taskRef.current) return;
      if (saved === false) throw new Error("Výbavu se nepodařilo uložit. Zkuste to znovu.");
      setFillStatus(`Doplněno položek výbavy z CEBIA a fotografií: ${result.addedCount}. Výsledek prosím zkontrolujte.`);
    } catch (error) {
      if (task === taskRef.current) setFillStatus(error instanceof Error ? error.message : "Výbavu se nepodařilo doplnit.");
    } finally {
      busyRef.current = false;
      if (task === taskRef.current) setFilling(false);
    }
  }

  return (
    <div className="card decision vehicleEquipment" ref={moduleContentRef}>
      <h2>Výbava vozu</h2>
      <button type="button" className="primary" onClick={fillEquipment} disabled={filling || vehicleDocumentsLoading}>
        {filling ? "Načítám výbavu z CEBIA a fotografií…" : "Doplnit výbavu z CEBIA a fotografií"}
      </button>
      <p>Spustí se až po kliknutí. Přečte i anglické specifikace v Informacích o vozidle z CEBIA a jasně viditelnou výbavu na fotografiích.</p>
      <p>Pokud nahraný protokol neobsahuje sekci Informace o vozidle, přiložte i její snímek jako dokument CEBIA.</p>
      <p role="status" aria-live="polite">{fillStatus}</p>
      <fieldset disabled={filling} className="vehicleEquipmentForm">
      <section aria-labelledby="equipmentDetailsTitle">
        <h3 id="equipmentDetailsTitle">Klíče, kola a záruka</h3>
        <div className="vehicleEquipmentDetails">
          <label>2× klíč
            <select value={twoKeys} onChange={(event) => updateDetail("twoKeys", event.target.value)}>
              <option value="">Neuvedeno</option><option value="yes">Ano</option><option value="no">Ne</option>
            </select>
          </label>
          <label>Druhá sada kol
            <select value={details.secondWheelSet || ""} onChange={(event) => updateDetail("secondWheelSet", event.target.value)}>
              <option value="">Neuvedeno</option><option value="yes">Ano</option><option value="no">Ne</option>
            </select>
          </label>
          <label>Záruka do data
            <input type="date" value={details.warrantyUntil || ""} onChange={(event) => updateDetail("warrantyUntil", event.target.value)} />
          </label>
          <label>Záruka do nájezdu (km)
            <input type="number" min="0" step="1" value={details.warrantyKm ?? ""} onChange={(event) => updateDetail("warrantyKm", event.target.value)} />
          </label>
        </div>
        <label className="vehicleEquipmentNote">Poznámky k výbavě a záruce
          <textarea rows={2} value={details.notes || ""} onChange={(event) => updateDetail("notes", event.target.value)} placeholder="Doplňující informace k výbavě, kolům nebo záruce" />
        </label>
      </section>
      <label className="vehicleEquipmentSearch">Vyhledat výbavu
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Např. klimatizace, kamera, USB…" />
      </label>
      <p>Vybráno: {Object.values(equipment).filter((value) => value === true).length}</p>
      <div className="vehicleEquipmentGroups">
        {groups.map((group) => (
          <fieldset key={group.title}>
            <legend>{group.title}</legend>
            {group.items.map((item) => (
              <label key={item} className="checkItem">
                <input type="checkbox" checked={equipment[item] === true} onChange={(event) => updateCar({ ...selectedCar, equipment: { ...equipment, [item]: event.target.checked } })} />
                {equipmentLabels[item] || item}
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      {groups.length === 0 && <p>Žádná výbava neodpovídá hledání.</p>}
      </fieldset>
    </div>
  );
}
