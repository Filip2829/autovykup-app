import { useEffect, useMemo, useState } from "react";
import {
  Camera,
  CheckCircle,
  ClipboardList,
  MessageCircle,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";

import "./App.css";
import { supabase } from "./supabase";

const emptyChecklist = {
  "TP nahrán": false,
  "Fotky auta hotové": false,
  "Motor OK": false,
  "Převodovka OK": false,
  "Brzdy OK": false,
  "Karoserie OK": false,
  "Vůz v záruce": false,
  "Poslední servis doložen": false,
};

export default function App() {
  const [cars, setCars] = useState([]);
  const [query, setQuery] = useState("");
  const [selectedCar, setSelectedCar] = useState(null);
  const [view, setView] = useState("list");
  const [module, setModule] = useState("overview");
  const [noteText, setNoteText] = useState("");

  const [newCarForm, setNewCarForm] = useState({
    name: "",
    year: "",
    km: "",
    vin: "",
    spz: "",
  });

  useEffect(() => {
    loadCars();
  }, []);

  async function loadCars() {
    const { data, error } = await supabase
      .from("cars")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Chyba načítání aut:", error);
      return;
    }

    const formattedCars = (data || []).map((car) => ({
      ...car,
      photos: [],
      checklist: { ...emptyChecklist },
      notes: [],
      saleEstimate: "",
      buyEstimate: "",
      approvedPrice: "",
    }));

    setCars(formattedCars);

    if (formattedCars.length > 0) {
      setSelectedCar(formattedCars[0]);
    }
  }

  const filteredCars = useMemo(() => {
    return cars.filter((car) =>
      `${car.name || ""} ${car.vin || ""} ${car.spz || ""}`
        .toLowerCase()
        .includes(query.toLowerCase())
    );
  }, [cars, query]);

  function updateCar(updated) {
    setSelectedCar(updated);
    setCars((currentCars) =>
      currentCars.map((car) => (car.id === updated.id ? updated : car))
    );
  }

  async function createCar() {
    if (!newCarForm.name.trim()) {
      alert("Vyplň název vozu");
      return;
    }

    const carToInsert = {
      name: newCarForm.name,
      year: newCarForm.year,
      km: Number(newCarForm.km) || 0,
      vin: newCarForm.vin,
      spz: newCarForm.spz,
      status: "Rozpracováno",
    };

    const { data, error } = await supabase
      .from("cars")
      .insert([carToInsert])
      .select()
      .single();

    if (error) {
      console.error("Supabase chyba:", error);
      alert(error.message);
      return;
    }

    const fullCar = {
      ...data,
      photos: [],
      checklist: { ...emptyChecklist },
      notes: [],
      saleEstimate: "",
      buyEstimate: "",
      approvedPrice: "",
    };

    setCars((currentCars) => [fullCar, ...currentCars]);
    setSelectedCar(fullCar);
    setView("detail");
    setModule("overview");

    setNewCarForm({
      name: "",
      year: "",
      km: "",
      vin: "",
      spz: "",
    });
  }

  function approvePrice() {
    const price = prompt("Zadej schválenou výkupní cenu");

    if (!price || !selectedCar) return;

    updateCar({
      ...selectedCar,
      approvedPrice: price,
      status: "Výkupní cena potvrzena",
    });
  }

  function addPhoto(event) {
    const file = event.target.files?.[0];

    if (!file || !selectedCar) return;

    const photoUrl = URL.createObjectURL(file);

    updateCar({
      ...selectedCar,
      photos: [...selectedCar.photos, photoUrl],
    });
  }

  function toggleChecklist(item) {
    if (!selectedCar) return;

    updateCar({
      ...selectedCar,
      checklist: {
        ...selectedCar.checklist,
        [item]: !selectedCar.checklist[item],
      },
    });
  }

  function addNote() {
    if (!noteText.trim() || !selectedCar) return;

    updateCar({
      ...selectedCar,
      notes: [...selectedCar.notes, noteText.trim()],
    });

    setNoteText("");
  }

  function recalculatePrice() {
    if (!selectedCar) return;

    updateCar({
      ...selectedCar,
      saleEstimate: 309000,
      buyEstimate: "265 000–270 000 Kč",
      status: "Nacenění hotové",
    });

    alert(`
AI NACENĚNÍ HOTOVO

Odhad prodejní ceny:
309 000 Kč

Doporučený výkup:
265 000–270 000 Kč

Doporučení:
Rychlý prodej do 30 dní.

Silné stránky:
• DSG servis doložen
• Atraktivní konfigurace
• Dobrá likvidita modelu

Rizika:
• Ověřit vibrace brzd
• Lehké kosmetické vady
    `);
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <p className="label">Interní výkupní aplikace</p>
          <h1>AutoVýkup</h1>
        </div>

        <button className="primary" onClick={createCar}>
          <Plus size={18} />
          Nový výkup
        </button>
      </header>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2>Nový výkup</h2>

        <div className="formGrid">
          <input
            placeholder="Název vozu"
            value={newCarForm.name}
            onChange={(e) =>
              setNewCarForm({ ...newCarForm, name: e.target.value })
            }
          />

          <input
            placeholder="Rok"
            value={newCarForm.year}
            onChange={(e) =>
              setNewCarForm({ ...newCarForm, year: e.target.value })
            }
          />

          <input
            placeholder="Km"
            value={newCarForm.km}
            onChange={(e) =>
              setNewCarForm({ ...newCarForm, km: e.target.value })
            }
          />

          <input
            placeholder="VIN"
            value={newCarForm.vin}
            onChange={(e) =>
              setNewCarForm({ ...newCarForm, vin: e.target.value })
            }
          />

          <input
            placeholder="SPZ"
            value={newCarForm.spz}
            onChange={(e) =>
              setNewCarForm({ ...newCarForm, spz: e.target.value })
            }
          />
        </div>
      </div>

      {view === "list" && (
        <>
          <div className="search">
            <Search size={18} />

            <input
              placeholder="Hledat auto, VIN nebo SPZ"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <section className="cars">
            {filteredCars.map((car) => (
              <article
                key={car.id}
                className="card"
                onClick={() => {
                  setSelectedCar(car);
                  setView("detail");
                  setModule("overview");
                }}
              >
                <div className="cardTop">
                  <h2>{car.name}</h2>
                  <span>{car.status}</span>
                </div>

                <p>
                  {car.year} · {car.km?.toLocaleString("cs-CZ")} km
                </p>

                <p>VIN: {car.vin || "—"}</p>
                <p>SPZ: {car.spz || "—"}</p>
              </article>
            ))}
          </section>
        </>
      )}

      {view === "detail" && selectedCar && (
        <section>
          <button className="back" onClick={() => setView("list")}>
            ← Zpět
          </button>

          <div className="card">
            <div className="cardTop">
              <h2>{selectedCar.name}</h2>
              <span>{selectedCar.status}</span>
            </div>

            <p>
              {selectedCar.year} · {selectedCar.km?.toLocaleString("cs-CZ")} km
            </p>

            <p>
              <b>VIN:</b> {selectedCar.vin || "—"}
            </p>

            <p>
              <b>SPZ:</b> {selectedCar.spz || "—"}
            </p>
          </div>

          <div className="grid">
            <div className="module">
              <Camera />
              <h3>TP a fotky</h3>
              <p>Více fotek TP, fotky auta, poškození.</p>
              <button onClick={() => setModule("photos")}>Otevřít</button>
            </div>

            <div className="module">
              <ClipboardList />
              <h3>Checklist</h3>
              <p>Motor, převodovka, servis, záruka.</p>
              <button onClick={() => setModule("checklist")}>Otevřít</button>
            </div>

            <div className="module">
              <MessageCircle />
              <h3>Poznámky</h3>
              <p>AI vytáhne klíčové problémy.</p>
              <button onClick={() => setModule("notes")}>Otevřít</button>
            </div>

            <div className="module">
              <ShieldCheck />
              <h3>Nacenění</h3>
              <p>
                <b>Odhad prodeje:</b>{" "}
                {selectedCar.saleEstimate
                  ? `${selectedCar.saleEstimate.toLocaleString("cs-CZ")} Kč`
                  : "—"}
              </p>
              <p>
                <b>Doporučený výkup:</b> {selectedCar.buyEstimate || "—"}
              </p>
              <button onClick={() => setModule("valuation")}>Otevřít</button>
            </div>
          </div>

          {module === "photos" && (
            <div className="card decision">
              <h2>TP a fotky</h2>

              <input type="file" accept="image/*" onChange={addPhoto} />

              <div className="photoGrid">
                {selectedCar.photos.map((photo, index) => (
                  <img key={index} src={photo} alt={`Foto ${index + 1}`} />
                ))}
              </div>
            </div>
          )}

          {module === "checklist" && (
            <div className="card decision">
              <h2>Checklist</h2>

              {Object.keys(selectedCar.checklist).map((item) => (
                <label key={item} className="checkItem">
                  <input
                    type="checkbox"
                    checked={selectedCar.checklist[item]}
                    onChange={() => toggleChecklist(item)}
                  />
                  {item}
                </label>
              ))}
            </div>
          )}

          {module === "notes" && (
            <div className="card decision">
              <h2>Poznámky</h2>

              <textarea
                placeholder="Poznámka..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />

              <button className="primary" onClick={addNote}>
                Přidat poznámku
              </button>

              {selectedCar.notes.map((note, index) => (
                <p key={index}>• {note}</p>
              ))}
            </div>
          )}

          {module === "valuation" && (
            <div className="card decision">
              <h2>Nacenění vozu</h2>

              <p>
                <b>Odhad prodeje:</b>{" "}
                {selectedCar.saleEstimate
                  ? `${selectedCar.saleEstimate.toLocaleString("cs-CZ")} Kč`
                  : "—"}
              </p>

              <p>
                <b>Doporučený výkup:</b> {selectedCar.buyEstimate || "—"}
              </p>

              <button className="primary" onClick={recalculatePrice}>
                Přepočítat cenu
              </button>
            </div>
          )}

          <div className="card decision">
            <h2>Finální rozhodnutí</h2>

            <p>
              <b>Schválená cena:</b>{" "}
              {selectedCar.approvedPrice || "zatím nepotvrzena"}
            </p>

            <button className="success" onClick={approvePrice}>
              <CheckCircle size={18} />
              Výkupní cena potvrzena
            </button>
          </div>
        </section>
      )}
    </div>
  );
}