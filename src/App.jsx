import { useEffect, useMemo, useState } from "react";
import {
  Camera,
  CheckCircle,
  ClipboardList,
  Edit,
  MessageCircle,
  Plus,
  Search,
  ShieldCheck,
  Star,
  Trash2,
} from "lucide-react";

import "./App.css";
import { supabase } from "./supabase";

const emptyChecklist = {
  "TP k dispozici": false,
  "ORV k dispozici": false,
  "Plná moc podepsána": false,
  "Výkupní smlouva podepsána": false,
  "Přejímací protokol podepsán": false,
  "Servisní historie": false,
  "Počet klíčů 2": false,
  "Provedena technická inspekce": false,
  "Diagnostika": false,
  "Kontrola pneumatik": false,
  "Kontrola karoserie": false,
  "Zkušební jízda provedena": false,
  "Vozidlo pojištěno": false,
  "Přepis zahájen": false,
  "Kontrola leasingu/exekuce": false,
  "Kontrola CEBIA / CarVertical": false,
  "Výkup schválen": false,
  "Výkup proplacen": false,
  "Faktura zaúčtována": false,
  "Vozidlo nafoceno": false,
  "Inzerce připravena": false,
  "Inzerce zveřejněna": false,
  "Vozidlo připraveno k prodeji": false,
};

const equipmentItems = [
  "ABS",
  "Adaptivní tempomat",
  "Airbagy",
  "Alarm",
  "Android Auto",
  "Apple CarPlay",
  "Asistent jízdy v pruzích",
  "Automatická klimatizace",
  "Bezklíčové odemykání",
  "Bezklíčové startování",
  "Bluetooth",
  "Couvací kamera",
  "Digitální kokpit",
  "Elektrická sedadla",
  "Elektrická zrcátka",
  "Elektrické víko kufru",
  "ESP",
  "Head-up display",
  "Hlídání mrtvého úhlu",
  "Isofix",
  "Kožené sedačky",
  "LED světlomety",
  "Masážní sedačky",
  "Matrix LED",
  "Multifunkční volant",
  "Navigace",
  "Nezávislé topení",
  "Panoramatická střecha",
  "Parkovací senzory přední",
  "Parkovací senzory zadní",
  "Prémiové audio",
  "Sedačky s pamětí",
  "Tažné zařízení",
  "Tempomat",
  "Vyhřívaná sedadla",
  "Vyhřívaný volant",
  "Vzduchový podvozek",
];

function getUsername(user) {
  return user?.email ? user.email.replace("@autovykup.local", "") : "";
}

function prepareCar(car) {
  return {
    ...car,
    photos: Array.isArray(car.photos) ? car.photos : [],
    checklist:
      car.checklist && Object.keys(car.checklist).length > 0
        ? car.checklist
        : { ...emptyChecklist },
    equipment:
      car.equipment && Object.keys(car.equipment).length > 0
        ? car.equipment
        : {},
    notes: Array.isArray(car.notes) ? car.notes : [],
    saleEstimate: car.sale_estimate || "",
    buyEstimate: car.buy_estimate || "",
    approvedPrice: car.approved_price || "",
  };
}

export default function App() {
  const [cars, setCars] = useState([]);
  const [query, setQuery] = useState("");
  const [selectedCar, setSelectedCar] = useState(null);
  const [view, setView] = useState("list");
  const [module, setModule] = useState("overview");
  const [noteText, setNoteText] = useState("");
  const [editMode, setEditMode] = useState(false);

  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [newCarForm, setNewCarForm] = useState({
    name: "",
    year: "",
    km: "",
    vin: "",
    spz: "",
  });

  useEffect(() => {
    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);

      if (session?.user) {
        setUsername(getUsername(session.user));
        loadCars();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  function createEmailFromUsername() {
    return `${username}@autovykup.local`;
  }

  async function checkUser() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      setUser(session.user);
      setUsername(getUsername(session.user));
      loadCars();
    }
  }

  async function signUp() {
    if (!username || !password) {
      alert("Vyplň uživatelské jméno a heslo");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: createEmailFromUsername(),
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Účet vytvořen");
  }

  async function signIn() {
    if (!username || !password) {
      alert("Vyplň uživatelské jméno a heslo");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: createEmailFromUsername(),
      password,
    });

    if (error) {
      alert(error.message);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setCars([]);
    setSelectedCar(null);
    setView("list");
  }

  async function loadCars() {
    const { data, error } = await supabase
      .from("cars")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    const loadedCars = (data || []).map(prepareCar);
    setCars(loadedCars);

    if (loadedCars.length > 0) {
      setSelectedCar(loadedCars[0]);
    }
  }

  const currentUsername = getUsername(user) || username;

  const filteredCars = useMemo(() => {
    return cars.filter((car) =>
      `${car.name || ""} ${car.vin || ""} ${car.spz || ""}`
        .toLowerCase()
        .includes(query.toLowerCase())
    );
  }, [cars, query]);

  function validateRequiredCarFields(car) {
    if (!car.name?.trim()) {
      alert("Vyplň název vozu");
      return false;
    }

    if (!car.year?.toString().trim()) {
      alert("Vyplň rok vozu");
      return false;
    }

    if (!car.km || Number(car.km) <= 0) {
      alert("Vyplň nájezd km");
      return false;
    }

    if (!car.vin?.trim()) {
      alert("Vyplň VIN");
      return false;
    }

    if (!car.spz?.trim()) {
      alert("Vyplň SPZ");
      return false;
    }

    return true;
  }

  async function updateCar(updated) {
    const updatedWithUser = {
      ...updated,
      updated_by: currentUsername,
    };

    setSelectedCar(updatedWithUser);

    setCars((currentCars) =>
      currentCars.map((car) =>
        car.id === updatedWithUser.id ? updatedWithUser : car
      )
    );

    await supabase
      .from("cars")
      .update({
        status: updatedWithUser.status,
        checklist: updatedWithUser.checklist || {},
        equipment: updatedWithUser.equipment || {},
        notes: updatedWithUser.notes || [],
        photos: updatedWithUser.photos || [],
        sale_estimate: updatedWithUser.saleEstimate || null,
        buy_estimate: updatedWithUser.buyEstimate || null,
        approved_price: updatedWithUser.approvedPrice || null,
        updated_by: currentUsername,
        updated_at: new Date().toISOString(),
      })
      .eq("id", updatedWithUser.id);
  }

  async function createCar() {
    const carToInsert = {
      name: newCarForm.name.trim(),
      year: newCarForm.year.trim(),
      km: Number(newCarForm.km) || 0,
      vin: newCarForm.vin.trim(),
      spz: newCarForm.spz.trim(),
      status: "Rozpracováno",
      created_by: currentUsername,
      updated_by: currentUsername,
      checklist: { ...emptyChecklist },
      equipment: {},
      notes: [],
      photos: [],
      sale_estimate: null,
      buy_estimate: null,
      approved_price: null,
    };

    if (!validateRequiredCarFields(carToInsert)) return;

    const { data, error } = await supabase
      .from("cars")
      .insert([carToInsert])
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    const fullCar = prepareCar(data);

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

  async function saveCarEdit() {
    if (!selectedCar) return;

    const updated = {
      ...selectedCar,
      name: selectedCar.name?.trim() || "",
      year: selectedCar.year?.toString().trim() || "",
      km: Number(selectedCar.km) || 0,
      vin: selectedCar.vin?.trim() || "",
      spz: selectedCar.spz?.trim() || "",
      updated_by: currentUsername,
    };

    if (!validateRequiredCarFields(updated)) return;

    setSelectedCar(updated);

    setCars((currentCars) =>
      currentCars.map((car) => (car.id === updated.id ? updated : car))
    );

    const { error } = await supabase
      .from("cars")
      .update({
        name: updated.name,
        year: updated.year,
        km: updated.km,
        vin: updated.vin,
        spz: updated.spz,
        updated_by: currentUsername,
        updated_at: new Date().toISOString(),
      })
      .eq("id", updated.id);

    if (error) {
      alert(error.message);
      return;
    }

    setEditMode(false);
  }

  async function deleteCar() {
    if (!selectedCar) return;

    const confirmDelete = window.confirm(
      `Opravdu chceš smazat záznam ${selectedCar.name}?`
    );

    if (!confirmDelete) return;

    const { error } = await supabase
      .from("cars")
      .delete()
      .eq("id", selectedCar.id);

    if (error) {
      alert(error.message);
      return;
    }

    const remainingCars = cars.filter((car) => car.id !== selectedCar.id);

    setCars(remainingCars);
    setSelectedCar(remainingCars[0] || null);
    setEditMode(false);
    setView("list");
  }

  async function addPhoto(event) {
    const file = event.target.files?.[0];

    if (!file || !selectedCar) return;

    const fileName = `${selectedCar.id}-${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("car-photos")
      .upload(fileName, file);

    if (uploadError) {
      alert(uploadError.message);
      return;
    }

    const { data } = supabase.storage
      .from("car-photos")
      .getPublicUrl(fileName);

    const updatedPhotos = [...selectedCar.photos, data.publicUrl];

    updateCar({
      ...selectedCar,
      photos: updatedPhotos,
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

  function toggleEquipment(item) {
    if (!selectedCar) return;

    updateCar({
      ...selectedCar,
      equipment: {
        ...selectedCar.equipment,
        [item]: !selectedCar.equipment?.[item],
      },
    });
  }

  function addNote() {
    if (!noteText.trim() || !selectedCar) return;

    updateCar({
      ...selectedCar,
      notes: [
        ...selectedCar.notes,
        `${currentUsername}: ${noteText.trim()}`,
      ],
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

  function approvePrice() {
    const price = prompt("Zadej schválenou výkupní cenu");

    if (!price || !selectedCar) return;

    updateCar({
      ...selectedCar,
      approvedPrice: price,
      status: "Výkupní cena potvrzena",
    });
  }

  if (!user) {
    return (
      <div className="app">
        <div className="card authCard">
          <h1>AutoVýkup Login</h1>

          <input
            placeholder="Uživatelské jméno"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <input
            type="password"
            placeholder="Heslo"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button className="primary" onClick={signIn}>
            Přihlásit
          </button>

          <button className="primary" onClick={signUp}>
            Registrovat
          </button>
        </div>
      </div>
    );
  }

  const checklistComplete =
    selectedCar &&
    Object.values(selectedCar.checklist || {}).length > 0 &&
    Object.values(selectedCar.checklist || {}).every(Boolean);

  return (
    <div className="app">
      <header className="header">
        <div>
          <p className="label">Interní výkupní aplikace</p>

          <h1>AutoVýkup</h1>

          <p>Přihlášen: {currentUsername}</p>

          <button className="back" onClick={signOut}>
            Odhlásit
          </button>
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
            placeholder="Název vozu *"
            value={newCarForm.name}
            onChange={(e) =>
              setNewCarForm({
                ...newCarForm,
                name: e.target.value,
              })
            }
          />

          <input
            placeholder="Rok *"
            value={newCarForm.year}
            onChange={(e) =>
              setNewCarForm({
                ...newCarForm,
                year: e.target.value,
              })
            }
          />

          <input
            placeholder="Km *"
            value={newCarForm.km}
            onChange={(e) =>
              setNewCarForm({
                ...newCarForm,
                km: e.target.value,
              })
            }
          />

          <input
            placeholder="VIN *"
            value={newCarForm.vin}
            onChange={(e) =>
              setNewCarForm({
                ...newCarForm,
                vin: e.target.value,
              })
            }
          />

          <input
            placeholder="SPZ *"
            value={newCarForm.spz}
            onChange={(e) =>
              setNewCarForm({
                ...newCarForm,
                spz: e.target.value,
              })
            }
          />
        </div>
      </div>

      {view === "list" && (
        <>
          <div className="search">
            <Search size={18} />

            <input
              placeholder="Hledat auto"
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
                  setEditMode(false);
                }}
              >
                {car.photos?.[0] && (
  <img
    src={car.photos[0]}
    alt="Náhled vozu"
    className="carPreview"
  />
)}
                <div className="cardTop">
                  <h2>{car.name}</h2>

                  <span>{car.status}</span>
                </div>

                <p>
                  {car.year} · {car.km?.toLocaleString("cs-CZ")} km
                </p>

                <p>VIN: {car.vin || "—"}</p>
                <p>SPZ: {car.spz || "—"}</p>
                <p>Vytvořil: {car.created_by || "—"}</p>
                <p>Poslední úprava: {car.updated_by || "—"}</p>
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

            <p>
              <b>Vytvořil:</b> {selectedCar.created_by || "—"}
            </p>

            <p>
              <b>Poslední úprava:</b> {selectedCar.updated_by || "—"}
            </p>

            <button className="primary" onClick={() => setEditMode(true)}>
              <Edit size={18} />
              Upravit údaje
            </button>

            <button className="danger" onClick={deleteCar}>
              <Trash2 size={18} />
              Smazat záznam
            </button>
          </div>

          {editMode && (
            <div className="card decision">
              <h2>Upravit údaje vozu</h2>

              <div className="formGrid">
                <input
                  placeholder="Název vozu *"
                  value={selectedCar.name || ""}
                  onChange={(e) =>
                    setSelectedCar({
                      ...selectedCar,
                      name: e.target.value,
                    })
                  }
                />

                <input
                  placeholder="Rok *"
                  value={selectedCar.year || ""}
                  onChange={(e) =>
                    setSelectedCar({
                      ...selectedCar,
                      year: e.target.value,
                    })
                  }
                />

                <input
                  placeholder="Km *"
                  value={selectedCar.km || ""}
                  onChange={(e) =>
                    setSelectedCar({
                      ...selectedCar,
                      km: Number(e.target.value) || 0,
                    })
                  }
                />

                <input
                  placeholder="VIN *"
                  value={selectedCar.vin || ""}
                  onChange={(e) =>
                    setSelectedCar({
                      ...selectedCar,
                      vin: e.target.value,
                    })
                  }
                />

                <input
                  placeholder="SPZ *"
                  value={selectedCar.spz || ""}
                  onChange={(e) =>
                    setSelectedCar({
                      ...selectedCar,
                      spz: e.target.value,
                    })
                  }
                />
              </div>

              <button className="success" onClick={saveCarEdit}>
                Uložit změny
              </button>

              <button className="back" onClick={() => setEditMode(false)}>
                Zrušit
              </button>
            </div>
          )}

          <div className="grid">
            <div className="module">
              <Camera />

              <h3>TP a fotky</h3>

              <button onClick={() => setModule("photos")}>
                Otevřít
              </button>
            </div>

            <div className="module">
              <ClipboardList />

              <h3>Checklist</h3>

              <p style={{ color: checklistComplete ? "#86efac" : "#fca5a5" }}>
                {checklistComplete ? "Checklist hotový" : "Chybí položky"}
              </p>

              <button onClick={() => setModule("checklist")}>
                Otevřít
              </button>
            </div>

            <div className="module">
              <Star />

              <h3>Výbava</h3>

              <button onClick={() => setModule("equipment")}>
                Otevřít
              </button>
            </div>

            <div className="module">
              <MessageCircle />

              <h3>Poznámky</h3>

              <button onClick={() => setModule("notes")}>
                Otevřít
              </button>
            </div>

            <div className="module">
              <ShieldCheck />

              <h3>Nacenění</h3>

              <button onClick={() => setModule("valuation")}>
                Otevřít
              </button>
            </div>
          </div>

          {module === "photos" && (
            <div className="card decision">
              <h2>TP a fotky</h2>

              <input type="file" accept="image/*" onChange={addPhoto} />

              <div className="photoGrid">
                {selectedCar.photos.map((photo, index) => (
                  <img key={index} src={photo} alt="" />
                ))}
              </div>
            </div>
          )}

          {module === "checklist" && (
            <div
              className="card decision"
              style={{
                border: checklistComplete
                  ? "2px solid #22c55e"
                  : "2px solid #ef4444",
              }}
            >
              <h2>Checklist</h2>

              {!checklistComplete && (
                <div
                  style={{
                    background: "#450a0a",
                    border: "1px solid #ef4444",
                    color: "#fecaca",
                    padding: 12,
                    borderRadius: 12,
                    marginBottom: 16,
                  }}
                >
                  <strong>Chybí dokončit:</strong>

                  <ul style={{ marginTop: 8 }}>
                    {Object.entries(selectedCar.checklist || {})
                      .filter(([_, value]) => !value)
                      .map(([key]) => (
                        <li key={key}>{key}</li>
                      ))}
                  </ul>
                </div>
              )}

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

          {module === "equipment" && (
            <div className="card decision">
              <h2>Výbava vozu</h2>

              {equipmentItems.map((item) => (
                <label key={item} className="checkItem">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedCar.equipment?.[item])}
                    onChange={() => toggleEquipment(item)}
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