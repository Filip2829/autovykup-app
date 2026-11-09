import { useEffect, useMemo, useState } from "react";

import { supabase } from "../../supabase";

const onlineAdvertisingFields = [
  {
    key: "customerSummary",
    label: "Základní informace o voze",
    placeholder: "Krátký věcný souhrn základních údajů pro zákazníka.",
  },
  {
    key: "equipmentSummary",
    label: "Výbava a praktické informace",
    placeholder: "Stručný výběr důležité výbavy a praktických prvků.",
  },
  {
    key: "suitableFor",
    label: "Pro koho je vůz vhodný",
    placeholder: "Krátce a věcně popiš, pro jaké použití vůz dává smysl.",
  },
  {
    key: "conditionSummary",
    label: "Důležité informace o stavu",
    placeholder: "Pravdivý souhrn známého stavu, vad, oprav nebo historie.",
  },
];

const emptyOnlineSummary = {
  customerSummary: "",
  equipmentSummary: "",
  suitableFor: "",
  conditionSummary: "",
};

function pickFilledObject(value = {}) {
  return Object.fromEntries(
    Object.entries(value || {}).filter(([, item]) => {
      if (item === null || item === undefined) return false;
      if (typeof item === "object") return Object.keys(pickFilledObject(item)).length > 0;
      return String(item).trim() !== "";
    })
  );
}

function getSelectedEquipment(equipment = {}) {
  return Object.entries(equipment || {})
    .filter(([, selected]) => Boolean(selected))
    .map(([label]) => label)
    .slice(0, 30);
}

function buildPublicVehiclePayload(car) {
  return {
    name: car?.name || "",
    year: car?.year || "",
    km: car?.km || "",
    status: car?.status || "",
    technicalParams: pickFilledObject(car?.technicalParams || {}),
    equipment: getSelectedEquipment(car?.equipment),
    checklist: pickFilledObject(car?.checklist || {}),
    damageReport: pickFilledObject(car?.damageReport || {}),
    cebiaHistory: pickFilledObject(car?.cebiaHistory || {}),
    aiCebiaReport: car?.aiCebiaReport || "",
    advertisingData: {
      highlights: car?.advertisingData?.highlights || "",
      defects: car?.advertisingData?.defects || "",
      repairs: car?.advertisingData?.repairs || "",
      listingNote: car?.advertisingData?.listingNote || "",
    },
  };
}

function normalizeOnlineSummary(value = {}) {
  return {
    customerSummary: value.customerSummary || "",
    equipmentSummary: value.equipmentSummary || "",
    suitableFor: value.suitableFor || "",
    conditionSummary: value.conditionSummary || "",
  };
}

function hasAnyText(value = {}) {
  return Object.values(normalizeOnlineSummary(value)).some((item) =>
    String(item || "").trim()
  );
}

export default function OnlineAdvertisingAi({ selectedCar, updateCar }) {
  const storedAdvertisingData = selectedCar?.advertisingData || {};
  const storedSummary = useMemo(
    () => normalizeOnlineSummary(storedAdvertisingData),
    [storedAdvertisingData]
  );
  const [form, setForm] = useState(storedSummary);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(storedSummary);
    setError("");
  }, [selectedCar?.id, storedSummary]);

  function updateField(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function generateSummary() {
    if (!selectedCar || loading) return;

    if (hasAnyText(form)) {
      const confirmed = window.confirm(
        "Některá pole už obsahují text. AI návrh je přepíše pouze v editoru, uloží se až po kliknutí na Uložit. Pokračovat?"
      );

      if (!confirmed) return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        "generate-online-advertising-summary",
        {
          body: {
            vehicle: buildPublicVehiclePayload(selectedCar),
          },
        }
      );

      if (invokeError) {
        console.error(invokeError);
        setError("AI souhrn se nepodařilo vygenerovat.");
        return;
      }

      const summary = normalizeOnlineSummary(data?.summary || data || {});

      if (!hasAnyText(summary)) {
        setError("AI nevrátila žádný použitelný text.");
        return;
      }

      setForm(summary);
    } catch (err) {
      console.error(err);
      setError("Při generování AI souhrnu došlo k chybě.");
    } finally {
      setLoading(false);
    }
  }

  async function saveSummary() {
    if (!selectedCar || saving) return;

    setSaving(true);
    setError("");

    try {
      await updateCar({
        ...selectedCar,
        advertisingData: {
          ...storedAdvertisingData,
          ...form,
        },
      });
    } catch (err) {
      console.error(err);
      setError("Uložení AI informací se nepodařilo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="onlineAdvertisingAiPanel">
      <div className="sectionHeader">
        <div>
          <p className="label">Marketing Engine</p>
          <h2>AI informace pro online inzerci</h2>
        </div>
      </div>

      <div className="formGrid">
        {onlineAdvertisingFields.map((field) => (
          <div key={field.key}>
            <p className="label">{field.label}</p>
            <textarea
              placeholder={field.placeholder}
              value={form[field.key] || ""}
              onChange={(event) => updateField(field.key, event.target.value)}
            />
          </div>
        ))}
      </div>

      {error && <p className="badText">{error}</p>}

      <div className="buttonRow">
        <button
          className="primary"
          type="button"
          onClick={generateSummary}
          disabled={loading || saving}
        >
          {loading ? "Generuji AI souhrn..." : "Vygenerovat AI souhrn"}
        </button>
        <button
          className="success"
          type="button"
          onClick={saveSummary}
          disabled={loading || saving}
        >
          {saving ? "Ukládám..." : "Uložit"}
        </button>
      </div>
    </div>
  );
}
