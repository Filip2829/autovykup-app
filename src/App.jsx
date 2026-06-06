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
  "Servisní historie": false,
  "Provedeno čištění": false,
  "Počet klíčů 2x": false,
  "Kontrola CEBIA / CarVertical": false,
  "Mechanická prohlídka + diagnostika": false,
  "Platnost STK": "",
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

const STATUS = {
  MISSING_DOCS: "Chybí podklady",
  READY_FOR_VALUATION: "Připraveno k nacenění",
  VALUATED: "Nacenění hotové",
  APPROVED: "Výkupní cena potvrzena",
};

function getUsername(user) {
  return user?.email ? user.email.replace("@autovykup.local", "") : "";
}

function clone(value, fallback) {
  try {
    return JSON.parse(JSON.stringify(value ?? fallback));
  } catch {
    return fallback;
  }
}

function normalizeArray(value) {
  return Array.isArray(value) ? [...value] : [];
}

function hasFilledValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function isValuationComplete(car) {
  return (
    hasFilledValue(car?.valuationDate ?? car?.valuation_date) &&
    hasFilledValue(car?.buyEstimate ?? car?.buy_estimate) &&
    hasFilledValue(car?.saleEstimate ?? car?.sale_estimate)
  );
}

function getDateValue(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function formatDate(value, includeTime = false) {
  const date = getDateValue(value);
  if (!date) return "—";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  if (!includeTime) return `${day}.${month}.${year}`;

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

function getCaseAgeClass(createdAt) {
  const date = getDateValue(createdAt);
  if (!date) return "caseAgeNeutral";

  const ageInDays = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
  );

  if (ageInDays <= 7) return "caseAgeFresh";
  if (ageInDays <= 14) return "caseAgeWarning";
  return "caseAgeDanger";
}

function prepareCar(car) {
  return {
    ...car,
    photos: normalizeArray(car.photos),
    technicalCardPhotos: normalizeArray(car.technical_card_photos),
    cebiaFiles: normalizeArray(car.cebia_files),
    checklist:
      car.checklist && typeof car.checklist === "object"
        ? clone({ ...emptyChecklist, ...car.checklist }, { ...emptyChecklist })
        : { ...emptyChecklist },
    equipment:
      car.equipment && typeof car.equipment === "object"
        ? clone(car.equipment, {})
        : {},
    notes: normalizeArray(car.notes),
    technicalParams:
      car.technical_params && typeof car.technical_params === "object"
        ? clone(car.technical_params, {})
        : {},
    aiRiskFlags: normalizeArray(car.ai_risk_flags),
    cebiaHistory:
      car.cebia_history && typeof car.cebia_history === "object"
        ? clone(car.cebia_history, {})
        : {},
    valuationDate: car.valuation_date || "",
    saleEstimate: car.sale_estimate || "",
    buyEstimate: car.buy_estimate || "",
    approvedPrice: car.approved_price || "",
    aiTechnicalReport: car.ai_technical_report || "",
    aiDocumentReport: car.ai_document_report || "",
    aiCebiaReport: car.ai_cebia_report || "",
  };
}

function isChecklistComplete(checklist = {}) {
  return (
    Boolean(checklist["Servisní historie"]) &&
    Boolean(checklist["Provedeno čištění"]) &&
    Boolean(checklist["Počet klíčů 2x"]) &&
    Boolean(checklist["Kontrola CEBIA / CarVertical"]) &&
    Boolean(checklist["Mechanická prohlídka + diagnostika"]) &&
    Boolean(checklist["Platnost STK"])
  );
}

function calculateStatus(car) {
  const hasPhotos = Array.isArray(car.photos) && car.photos.length > 0;
  const checklistComplete = isChecklistComplete(car.checklist);
  const hasValuation = isValuationComplete(car);
  const hasApprovedPrice = hasFilledValue(car.approvedPrice ?? car.approved_price);

  if (hasApprovedPrice) return STATUS.APPROVED;
  if (hasValuation) return STATUS.VALUATED;
  if (hasPhotos && checklistComplete) return STATUS.READY_FOR_VALUATION;
  return STATUS.MISSING_DOCS;
}

function getWorkflow(car) {
  const hasPhotos = Array.isArray(car.photos) && car.photos.length > 0;
  const checklistComplete = isChecklistComplete(car.checklist);
  const hasValuation = isValuationComplete(car);
  const hasApprovedPrice = hasFilledValue(car.approvedPrice ?? car.approved_price);

  return [
    { label: "Podklady", done: checklistComplete },
    { label: "Fotky", done: hasPhotos },
    { label: "Nacenění", done: hasValuation },
    { label: "Schválení", done: hasApprovedPrice },
  ];
}

export default function App() {

  const [cars, setCars] = useState([]);
  const [query, setQuery] = useState("");
  const [selectedCar, setSelectedCar] = useState(null);
  const selectedEquipment = equipmentItems.filter(
  (item) => selectedCar?.equipment?.[item]
);

const remainingEquipment = equipmentItems.filter(
  (item) => !selectedCar?.equipment?.[item]
);
  const [view, setView] = useState("home");
  const [module, setModule] = useState("overview");
  const [noteText, setNoteText] = useState("");
  const [problemText, setProblemText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [documentAiLoading, setDocumentAiLoading] = useState(false);
  const [technicalAiLoading, setTechnicalAiLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [fullscreenPhoto, setFullscreenPhoto] = useState(null);

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
    setView("home");
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
    setSelectedCar((currentSelected) => {
      if (!currentSelected) return loadedCars[0] || null;
      return loadedCars.find((car) => car.id === currentSelected.id) || loadedCars[0] || null;
    });
  }

  const currentUsername = getUsername(user) || username;

  const filteredCars = useMemo(() => {
    return cars.filter((car) =>
      `${car.name || ""} ${car.vin || ""} ${car.spz || ""}`
        .toLowerCase()
        .includes(query.toLowerCase())
    );
  }, [cars, query]);

  function selectCar(car) {
    setSelectedCar(prepareCar(car));
    setView("detail");
    setModule("overview");
    setEditMode(false);
    setNoteText("");
    setProblemText("");
  }

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
      status: calculateStatus(updated),
      updated_by: currentUsername,
    };

    setSelectedCar(updatedWithUser);

    setCars((currentCars) =>
      currentCars.map((car) =>
        car.id === updatedWithUser.id ? updatedWithUser : car
      )
    );

    const { error } = await supabase
      .from("cars")
      .update({
        status: updatedWithUser.status,
        checklist: updatedWithUser.checklist || {},
        equipment: updatedWithUser.equipment || {},
        notes: updatedWithUser.notes || [],
        photos: updatedWithUser.photos || [],
        technical_params: updatedWithUser.technicalParams || {},
        technical_card_photos: updatedWithUser.technicalCardPhotos || [],
        cebia_files: updatedWithUser.cebiaFiles || [],
        valuation_date: updatedWithUser.valuationDate || null,
        sale_estimate: updatedWithUser.saleEstimate || null,
        buy_estimate: updatedWithUser.buyEstimate || null,
        approved_price: updatedWithUser.approvedPrice || null,
        ai_technical_report: updatedWithUser.aiTechnicalReport || null,
        ai_document_report: updatedWithUser.aiDocumentReport || null,
        ai_cebia_report: updatedWithUser.aiCebiaReport || null,
        cebia_history: updatedWithUser.cebiaHistory || {},
        ai_risk_flags: updatedWithUser.aiRiskFlags || [],
        updated_by: currentUsername,
        updated_at: new Date().toISOString(),
      })
      .eq("id", updatedWithUser.id);

    if (error) {
      console.error(error);
      alert(error.message);
    }
  }

  async function createCar() {
    const carToInsert = {
      name: newCarForm.name.trim(),
      year: newCarForm.year.trim(),
      km: Number(newCarForm.km) || 0,
      vin: newCarForm.vin.trim(),
      spz: newCarForm.spz.trim(),
      status: STATUS.MISSING_DOCS,
      created_by: currentUsername,
      updated_by: currentUsername,
      checklist: { ...emptyChecklist },
      equipment: {},
      notes: [],
      photos: [],
      technical_params: {},
      technical_card_photos: [],
      cebia_files: [],
      valuation_date: null,
      sale_estimate: null,
      buy_estimate: null,
      approved_price: null,
      ai_technical_report: null,
      ai_document_report: null,
      ai_cebia_report: null,
      cebia_history: {},
      ai_risk_flags: [],
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

    setSelectedCar(updated);
    setCars((currentCars) =>
      currentCars.map((car) => (car.id === updated.id ? updated : car))
    );
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

  async function uploadFile(file, folder = "vehicle-photos") {
    if (!file || !selectedCar) return null;

    const safeName = file.name.replace(/\s+/g, "-");
    const fileName = `${folder}/${selectedCar.id}-${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("car-photos")
      .upload(fileName, file);

    if (uploadError) {
      alert(uploadError.message);
      return null;
    }

    const { data } = supabase.storage.from("car-photos").getPublicUrl(fileName);
    return data.publicUrl;
  }
  async function downloadPhoto(url, index) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();

    const objectUrl = window.URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `${selectedCar?.name || "auto"}-foto-${index + 1}.jpg`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.URL.revokeObjectURL(objectUrl);
  } catch (error) {
    console.error(error);
    window.open(url, "_blank");
  }

  }

  async function deletePhoto(indexToDelete) {
    if (!selectedCar) return;

    const confirmDelete = window.confirm("Opravdu chceš smazat tuto fotku?");
    if (!confirmDelete) return;

    const updatedPhotos = selectedCar.photos.filter(
      (_photo, index) => index !== indexToDelete
    );

    await updateCar({
      ...selectedCar,
      photos: updatedPhotos,
    });
  }

  async function deleteTechnicalCard(indexToDelete) {
    if (!selectedCar) return;

    const confirmDelete = window.confirm("Opravdu chceš smazat tento TP / doklad?");
    if (!confirmDelete) return;

    const updatedFiles = selectedCar.technicalCardPhotos.filter(
      (_file, index) => index !== indexToDelete
    );

    await updateCar({
      ...selectedCar,
      technicalCardPhotos: updatedFiles,
    });
  }

  async function deleteCebiaFile(indexToDelete) {
    if (!selectedCar) return;

    const confirmDelete = window.confirm("Opravdu chceš smazat tento CEBIA dokument?");
    if (!confirmDelete) return;

    const updatedFiles = selectedCar.cebiaFiles.filter(
      (_file, index) => index !== indexToDelete
    );

    await updateCar({
      ...selectedCar,
      cebiaFiles: updatedFiles,
      checklist: {
        ...selectedCar.checklist,
        "Kontrola CEBIA / CarVertical": updatedFiles.length > 0,
      },
    });
  }

  async function addPhoto(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length || !selectedCar) return;

    const urls = [];

    for (const file of files) {
      const url = await uploadFile(file, "vehicle-photos");
      if (url) urls.push(url);
    }

    if (urls.length > 0) {
      await updateCar({
        ...selectedCar,
        photos: [...selectedCar.photos, ...urls],
      });
    }

    event.target.value = "";
  }

  async function addTechnicalCardPhoto(event) {
    const file = event.target.files?.[0];
    const url = await uploadFile(file, "technical-card");

    if (url) {
      await updateCar({
        ...selectedCar,
        technicalCardPhotos: [...selectedCar.technicalCardPhotos, url],
      });
    }

    event.target.value = "";
  }

  async function addCebiaFile(event) {
    const file = event.target.files?.[0];
    const url = await uploadFile(file, "cebia");

    if (url) {
      await updateCar({
        ...selectedCar,
        cebiaFiles: [...selectedCar.cebiaFiles, url],
        checklist: {
          ...selectedCar.checklist,
          "Kontrola CEBIA / CarVertical": true,
        },
      });
    }

    event.target.value = "";
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

  function updateStk(value) {
    if (!selectedCar) return;

    updateCar({
      ...selectedCar,
      checklist: {
        ...selectedCar.checklist,
        "Platnost STK": value,
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

  function updateValuationField(key, value) {
    if (!selectedCar) return;

    updateCar({
      ...selectedCar,
      [key]: value,
    });
  }

  function updateValuationPrice(key, value) {
    updateValuationField(key, value === "" ? "" : Number(value));
  }

  async function analyzeVehicleTechnicalData() {
    if (!selectedCar) return;

    const hasTechnicalCard =
      Array.isArray(selectedCar.technicalCardPhotos) &&
      selectedCar.technicalCardPhotos.length > 0;

    const hasCebia =
      Array.isArray(selectedCar.cebiaFiles) &&
      selectedCar.cebiaFiles.length > 0;

    if (!hasTechnicalCard && !hasCebia) {
      alert("Nejdřív nahraj CEBIA nebo TP do Administrativy.");
      return;
    }

    setTechnicalAiLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "analyze-vehicle-technical-data",
        {
          body: {
            car: selectedCar,
            technicalCardPhotos: selectedCar.technicalCardPhotos || [],
            cebiaFiles: selectedCar.cebiaFiles || [],
          },
        }
      );

      if (error) {
        console.error(error);
        alert("AI doplnění technických dat selhalo.");
        return;
      }

      const extractedParams = data?.technicalParams || {};
      const cebiaHistory = data?.cebiaHistory || {};
      const extractedEquipment = Array.isArray(data?.equipment)
        ? data.equipment
        : [];

      const updatedEquipment = { ...selectedCar.equipment };

      for (const item of extractedEquipment) {
        if (equipmentItems.includes(item)) {
          updatedEquipment[item] = true;
        }
      }

      const report =
        data?.report || "AI zpracovala technické údaje bez textového výstupu.";

      await updateCar({
        ...selectedCar,
        technicalParams: {
          ...selectedCar.technicalParams,
          ...extractedParams,
        },
        cebiaHistory: {
          ...selectedCar.cebiaHistory,
          ...cebiaHistory,
        },
        equipment: updatedEquipment,
        aiDocumentReport: report,
        aiCebiaReport: selectedCar.aiCebiaReport || report,
      });

      alert("AI doplnila technická data. Prosím zkontroluj je.");
    } catch (err) {
      console.error(err);
      alert("Chyba při AI doplnění technických dat.");
    } finally {
      setTechnicalAiLoading(false);
    }
  }

  async function analyzeDocuments() {
    if (!selectedCar) return;

    if (!selectedCar.cebiaFiles || selectedCar.cebiaFiles.length === 0) {
      alert("Nejdřív nahraj CEBIA PDF do Administrativy.");
      return;
    }

    setDocumentAiLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "analyze-cebia-history",
        {
          body: {
            car: selectedCar,
            cebiaFiles: selectedCar.cebiaFiles || [],
          },
        }
      );

      if (error) {
        console.error(error);
        alert("AI vyhodnocení CEBIA selhalo.");
        return;
      }

      const extractedParams = data?.technicalParams || {};
      const cebiaHistory = data?.cebiaHistory || {};
      const report = data?.report || "AI CEBIA zpracovala bez textového výstupu.";

      await updateCar({
        ...selectedCar,
        technicalParams: {
          ...selectedCar.technicalParams,
          ...extractedParams,
        },
        cebiaHistory: {
          ...selectedCar.cebiaHistory,
          ...cebiaHistory,
        },
        aiCebiaReport: report,
        aiDocumentReport: report,
      });

      alert("AI vyhodnotila CEBIA. Zkontroluj Historii CEBIA a technické parametry.");
      setModule("cebiaHistory");
    } catch (err) {
      console.error(err);
      alert("Chyba při AI vyhodnocení CEBIA.");
    } finally {
      setDocumentAiLoading(false);
    }
  }

  function addNote() {
    if (!noteText.trim() || !selectedCar) return;

    updateCar({
      ...selectedCar,
      notes: [...selectedCar.notes, `${currentUsername}: ${noteText.trim()}`],
    });

    setNoteText("");
  }

  async function analyzeTechnicalProblem() {
    if (!problemText.trim() || !selectedCar) {
      alert("Popiš závadu.");
      return;
    }

    setAiLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "analyze-technical-problem",
        {
          body: {
            car: selectedCar,
            problem: problemText,
          },
        }
      );

      if (error) {
        console.error(error);
        alert("AI analýza selhala.");
        return;
      }

      updateCar({
        ...selectedCar,
        aiTechnicalReport: data?.report || "AI nevrátila žádný výsledek.",
      });
    } catch (err) {
      console.error(err);
      alert("Chyba AI.");
    } finally {
      setAiLoading(false);
    }
  }

  if (!user) {
    return (
      <div className="app">
        <div className="card authCard">
          <h1>AutoVýkup Login</h1>

          <input
            placeholder="Uživatelské jméno"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />

          <input
            type="password"
            placeholder="Heslo"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
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

  const checklistComplete = selectedCar && isChecklistComplete(selectedCar.checklist);
  const valuationComplete = selectedCar && isValuationComplete(selectedCar);

  return (
    <div className="app">
      <header className="header">
        <div>
          <p className="label">Interní výkupní aplikace</p>
          <h1>AutoVýkup</h1>
          <p>Přihlášen: {currentUsername}</p>
        </div>

        <div className="headerActions">
          <button className="primary" onClick={() => setView("new")}>
            <Plus size={18} />
            Nový výkup
          </button>

          <button className="back" onClick={signOut}>
            Odhlásit
          </button>
        </div>
      </header>

      {view === "home" && (
        <section className="homeMenu">
          <div className="card decision">
            <h2>Rozcestník AutoVýkup</h2>
            <p>Vyber, s čím chceš pracovat.</p>

            <div className="grid">
              <div className="module">
                <Plus />
                <h3>Přidat nový výkup</h3>
                <button onClick={() => setView("new")}>Otevřít</button>
              </div>

              <div className="module">
                <Search />
                <h3>Aktuální evidence vozidel</h3>
                <p>{cars.length} záznamů</p>
                <button onClick={() => setView("list")}>Otevřít</button>
              </div>

              <div className="module">
                <MessageCircle />
                <h3>Seznam zákazníků</h3>
                <p>Zatím připravujeme</p>
                <button onClick={() => alert("Seznam zákazníků doprogramujeme v další fázi.")}>
                  Otevřít
                </button>
              </div>

              <div className="module">
                <ShieldCheck />
                <h3>Vykoupená vozidla</h3>
                <p>Zatím připravujeme</p>
                <button onClick={() => alert("Přehled vykoupených vozidel doprogramujeme v další fázi.")}>
                  Otevřít
                </button>
              </div>

              <div className="module">
                <CheckCircle />
                <h3>Prodané vozy</h3>
                <p>Zatím připravujeme</p>
                <button onClick={() => alert("Přehled prodaných vozů doprogramujeme v další fázi.")}>
                  Otevřít
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {view === "new" && (
        <div className="card newCarCard">
          <h2>Nový výkup</h2>

          <div className="formGrid">
            <input
              placeholder="Název vozu *"
              value={newCarForm.name}
              onChange={(event) =>
                setNewCarForm({ ...newCarForm, name: event.target.value })
              }
            />

            <input
              placeholder="Rok *"
              value={newCarForm.year}
              onChange={(event) =>
                setNewCarForm({ ...newCarForm, year: event.target.value })
              }
            />

            <input
              placeholder="Km *"
              value={newCarForm.km}
              onChange={(event) =>
                setNewCarForm({ ...newCarForm, km: event.target.value })
              }
            />

            <input
              placeholder="VIN *"
              value={newCarForm.vin}
              onChange={(event) =>
                setNewCarForm({ ...newCarForm, vin: event.target.value })
              }
            />

            <input
              placeholder="SPZ *"
              value={newCarForm.spz}
              onChange={(event) =>
                setNewCarForm({ ...newCarForm, spz: event.target.value })
              }
            />
          </div>

          <button className="success" onClick={createCar}>
            Vytvořit výkup
          </button>

          <button className="back" onClick={() => setView("home")}>
            Zpět na rozcestník
          </button>
        </div>
      )}

      {view === "list" && (
        <>
          <button className="back bigBack" onClick={() => setView("home")}>
            ← Zpět na rozcestník
          </button>

          <div className="search">
            <Search size={18} />

            <input
              placeholder="Hledat auto"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <section className="cars">
            {filteredCars.map((car) => (
              <article
                key={car.id}
                className="card carListCard"
                onClick={() => selectCar(car)}
              >
                {car.photos?.[0] && (
                  <img
                    src={car.photos[0]}
                    alt="Náhled vozu"
                    className="carPreview"
                    onClick={(event) => {
                      event.stopPropagation();
                      window.open(car.photos[0], "_blank");
                    }}
                    style={{ cursor: "pointer" }}
                  />
                )}

                <div className="cardTop">
                  <h2>{car.name}</h2>
                  <div className="carListMeta">
                    <div className={`caseAge ${getCaseAgeClass(car.created_at)}`}>
                      <p>Přidáno: {formatDate(car.created_at)}</p>
                      <p>Upraveno: {formatDate(car.updated_at, true)}</p>
                    </div>
                    <span>{car.status}</span>
                  </div>
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
          <button className="back bigBack" onClick={() => setView("list")}>
            ← Zpět
          </button>

          <div className="card carHero">
            <div className="carHeroTop">
              <div>
                <h2>{selectedCar.name}</h2>
                <p>
                  {selectedCar.year} ·{" "}
                  {selectedCar.km?.toLocaleString("cs-CZ")} km
                </p>
              </div>

              <span
                className={`statusBadge ${
                  selectedCar.status === STATUS.MISSING_DOCS
                    ? "statusDanger"
                    : selectedCar.status === STATUS.APPROVED
                    ? "statusSuccess"
                    : "statusWarning"
                }`}
              >
                {selectedCar.status}
              </span>
            </div>

            <div className="carHeroBody">
              <div className="carInfoGrid">
                <div>
                  <strong>VIN:</strong>
                  <p>{selectedCar.vin || "—"}</p>
                </div>

                <div>
                  <strong>SPZ:</strong>
                  <p>{selectedCar.spz || "—"}</p>
                </div>

                <div>
                  <strong>Vytvořil:</strong>
                  <p>{selectedCar.created_by || "—"}</p>
                </div>

                <div>
                  <strong>Poslední úprava:</strong>
                  <p>{selectedCar.updated_by || "—"}</p>
                </div>
              </div>

              <div className="heroActions">
                <button
                  className="primary outline"
                  onClick={() => setEditMode(true)}
                >
                  <Edit size={18} />
                  Upravit údaje
                </button>

                <button className="danger outlineDanger" onClick={deleteCar}>
                  <Trash2 size={18} />
                  Smazat záznam
                </button>
              </div>
            </div>
          </div>

          <div className="workflowPanel">
            {getWorkflow(selectedCar).map((step, index) => (
              <div
                key={step.label}
                className={`workflowStep ${step.done ? "done" : "missing"}`}
              >
                <div className="workflowCircle">{index + 1}</div>
                <h4>{step.label}</h4>
                <p>{step.done ? "Hotovo" : index < 2 ? "Chybí" : "Čeká se"}</p>
              </div>
            ))}
          </div>

          {editMode && (
            <div className="card decision">
              <h2>Upravit údaje vozu</h2>

              <div className="formGrid">
                <input
                  placeholder="Název vozu *"
                  value={selectedCar.name || ""}
                  onChange={(event) =>
                    setSelectedCar({ ...selectedCar, name: event.target.value })
                  }
                />

                <input
                  placeholder="Rok *"
                  value={selectedCar.year || ""}
                  onChange={(event) =>
                    setSelectedCar({ ...selectedCar, year: event.target.value })
                  }
                />

                <input
                  placeholder="Km *"
                  value={selectedCar.km || ""}
                  onChange={(event) =>
                    setSelectedCar({
                      ...selectedCar,
                      km: Number(event.target.value) || 0,
                    })
                  }
                />

                <input
                  placeholder="VIN *"
                  value={selectedCar.vin || ""}
                  onChange={(event) =>
                    setSelectedCar({ ...selectedCar, vin: event.target.value })
                  }
                />

                <input
                  placeholder="SPZ *"
                  value={selectedCar.spz || ""}
                  onChange={(event) =>
                    setSelectedCar({ ...selectedCar, spz: event.target.value })
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
              <ClipboardList />
              <h3>Technické parametry</h3>
              <button onClick={() => setModule("technical")}>Otevřít</button>
            </div>

            <div className="module">
              <Camera />
              <h3>Fotky vozu</h3>
              <button onClick={() => setModule("photos")}>Otevřít</button>
            </div>

            <div className="module">
              <ClipboardList />
              <h3>Administrativa</h3>
              <p className={checklistComplete ? "okText" : "badText"}>
                {checklistComplete ? "Hotovo" : "Není hotovo"}
              </p>
              <button onClick={() => setModule("checklist")}>Otevřít</button>
            </div>

            <div className="module">
              <ShieldCheck />
              <h3>Historie CEBIA</h3>
              <p className={selectedCar.aiCebiaReport ? "okText" : ""}>
                {selectedCar.aiCebiaReport ? "Vyhodnoceno" : "Zatím nevyhodnoceno"}
              </p>
              <button onClick={() => setModule("cebiaHistory")}>Otevřít</button>
            </div>

            <div className="module">
              <Star />
              <h3>Výbava</h3>
              <button onClick={() => setModule("equipment")}>Otevřít</button>
            </div>

            <div className="module">
              <MessageCircle />
              <h3>Poznámky + AI</h3>
              <button onClick={() => setModule("notes")}>Otevřít</button>
            </div>

            <div className="module">
              <ShieldCheck />
              <h3>Nacenění</h3>
              <p className={valuationComplete ? "okText" : ""}>
                {valuationComplete ? "Hotovo" : "Zatím neprovedeno"}
              </p>
              <button onClick={() => setModule("valuation")}>Otevřít</button>
            </div>
          </div>

          {module === "technical" && (
            <div className="card decision">
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
                <input
                  placeholder="Značka"
                  value={getTechnicalParam("brand")}
                  onChange={(event) =>
                    updateTechnicalParam("brand", event.target.value)
                  }
                />

                <input
                  placeholder="Model"
                  value={getTechnicalParam("model")}
                  onChange={(event) =>
                    updateTechnicalParam("model", event.target.value)
                  }
                />

                <input
                  placeholder="Verze / výbavový stupeň"
                  value={getTechnicalParam("version")}
                  onChange={(event) =>
                    updateTechnicalParam("version", event.target.value)
                  }
                />

                <input
                  placeholder="Výbava"
                  value={getTechnicalParam("equipmentLevel")}
                  onChange={(event) =>
                    updateTechnicalParam("equipmentLevel", event.target.value)
                  }
                />

                <input
                  placeholder="Kategorie / typ vozu, např. SUV, kombi, hatchback"
                  value={getTechnicalParam("bodyType")}
                  onChange={(event) =>
                    updateTechnicalParam("bodyType", event.target.value)
                  }
                />
              </div>

              <h3>Motor a pohon</h3>
              <div className="formGrid">
                <input
                  placeholder="Palivo"
                  value={getTechnicalParam("fuel")}
                  onChange={(event) =>
                    updateTechnicalParam("fuel", event.target.value)
                  }
                />

                <input
                  placeholder="Objem motoru"
                  value={getTechnicalParam("engine")}
                  onChange={(event) =>
                    updateTechnicalParam("engine", event.target.value)
                  }
                />

                <input
                  placeholder="Výkon kW"
                  value={getTechnicalParam("powerKw")}
                  onChange={(event) =>
                    updateTechnicalParam("powerKw", event.target.value)
                  }
                />

                <input
                  placeholder="Převodovka"
                  value={getTechnicalParam("transmission")}
                  onChange={(event) =>
                    updateTechnicalParam("transmission", event.target.value)
                  }
                />

                <input
                  placeholder="Pohon, např. přední, 4x4"
                  value={getTechnicalParam("drive")}
                  onChange={(event) =>
                    updateTechnicalParam("drive", event.target.value)
                  }
                />

              </div>

              <h3>Karoserie</h3>
              <div className="formGrid">
                <div>
                  <input
                    placeholder="Počet dveří"
                    value={getTechnicalParam("doors")}
                    onChange={(event) =>
                      updateTechnicalParam("doors", event.target.value)
                    }
                  />
                  {getTechnicalParam("doors") && (
                    <p className="label">Počet dveří: {getTechnicalParam("doors")}</p>
                  )}
                </div>

                <div>
                  <input
                    placeholder="Počet míst / sedadel"
                    value={getTechnicalParam("seats")}
                    onChange={(event) =>
                      updateTechnicalParam("seats", event.target.value)
                    }
                  />
                  {getTechnicalParam("seats") && (
                    <p className="label">Počet sedadel: {getTechnicalParam("seats")}</p>
                  )}
                </div>

                <input
                  placeholder="Barva"
                  value={getTechnicalParam("color")}
                  onChange={(event) =>
                    updateTechnicalParam("color", event.target.value)
                  }
                />
              </div>

              <h3>Registrace a nájezd</h3>
              <div className="formGrid">
                <input
                  placeholder="První registrace"
                  value={getTechnicalParam("firstRegistration")}
                  onChange={(event) =>
                    updateTechnicalParam(
                      "firstRegistration",
                      event.target.value
                    )
                  }
                />

                <input
                  placeholder="Rok výroby"
                  value={getTechnicalParam("productionYear")}
                  onChange={(event) =>
                    updateTechnicalParam("productionYear", event.target.value)
                  }
                />

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
          )}

          {module === "photos" && (
            <div className="card decision">
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
          )}

          {module === "checklist" && (
            <div className="card decision">
              <h2>Administrativa vozu</h2>

              {Object.keys(emptyChecklist)
                .filter((item) => item !== "Platnost STK")
                .map((item) => (
                  <label key={item} className="checkItem">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedCar.checklist[item])}
                      onChange={() => toggleChecklist(item)}
                    />
                    {item}
                  </label>
                ))}

              <div className="stkBox">
                <label>Platnost STK</label>
                <input
                  type="date"
                  value={selectedCar.checklist["Platnost STK"] || ""}
                  onChange={(event) => updateStk(event.target.value)}
                />
              </div>

              <h3>TP / doklad</h3>
              <input type="file" accept="image/*,.pdf" onChange={addTechnicalCardPhoto} />

              <h3>CEBIA / CarVertical</h3>
              <input type="file" accept="image/*,.pdf" onChange={addCebiaFile} />


           

              <div className="fileList">
                {selectedCar.technicalCardPhotos.map((url, index) => (
                  <div key={`tp-${index}`} className="fileRow">
                    <a href={url} target="_blank" rel="noreferrer">
                      TP {index + 1}
                    </a>

                    <button
                      className="danger outlineDanger"
                      onClick={() => deleteTechnicalCard(index)}
                    >
                      Smazat
                    </button>
                  </div>
                ))}

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
            </div>
          )}

          {module === "cebiaHistory" && (
            <div className="card decision">
              <h2>Historie CEBIA</h2>

              <div className="formGrid">
                <input
                  placeholder="Počet majitelů"
                  value={selectedCar.cebiaHistory?.owners || ""}
                  onChange={(event) =>
                    updateCar({
                      ...selectedCar,
                      cebiaHistory: {
                        ...selectedCar.cebiaHistory,
                        owners: event.target.value,
                      },
                    })
                  }
                />

                <input
                  placeholder="Země původu"
                  value={selectedCar.cebiaHistory?.countryOfOrigin || ""}
                  onChange={(event) =>
                    updateCar({
                      ...selectedCar,
                      cebiaHistory: {
                        ...selectedCar.cebiaHistory,
                        countryOfOrigin: event.target.value,
                      },
                    })
                  }
                />

                <input
                  placeholder="Financování / leasing"
                  value={selectedCar.cebiaHistory?.financing || ""}
                  onChange={(event) =>
                    updateCar({
                      ...selectedCar,
                      cebiaHistory: {
                        ...selectedCar.cebiaHistory,
                        financing: event.target.value,
                      },
                    })
                  }
                />

                <input
                  placeholder="Taxi / půjčovna"
                  value={selectedCar.cebiaHistory?.taxiOrRental || ""}
                  onChange={(event) =>
                    updateCar({
                      ...selectedCar,
                      cebiaHistory: {
                        ...selectedCar.cebiaHistory,
                        taxiOrRental: event.target.value,
                      },
                    })
                  }
                />

                <input
                  placeholder="Dovoz / import"
                  value={selectedCar.cebiaHistory?.importInfo || ""}
                  onChange={(event) =>
                    updateCar({
                      ...selectedCar,
                      cebiaHistory: {
                        ...selectedCar.cebiaHistory,
                        importInfo: event.target.value,
                      },
                    })
                  }
                />
              </div>

              <h3>Historie škod</h3>
              <textarea
                placeholder="Škody / pojistné události"
                value={selectedCar.cebiaHistory?.damageHistory || ""}
                onChange={(event) =>
                  updateCar({
                    ...selectedCar,
                    cebiaHistory: {
                      ...selectedCar.cebiaHistory,
                      damageHistory: event.target.value,
                    },
                  })
                }
              />

              <h3>Historie kilometrů</h3>
              <textarea
                placeholder="Historie kilometrů"
                value={selectedCar.cebiaHistory?.mileageHistory || ""}
                onChange={(event) =>
                  updateCar({
                    ...selectedCar,
                    cebiaHistory: {
                      ...selectedCar.cebiaHistory,
                      mileageHistory: event.target.value,
                    },
                  })
                }
              />

              <h3>Podezření na stočení km</h3>
              <textarea
                placeholder="Podezření / nesrovnalosti v km"
                value={selectedCar.cebiaHistory?.mileageSuspicion || ""}
                onChange={(event) =>
                  updateCar({
                    ...selectedCar,
                    cebiaHistory: {
                      ...selectedCar.cebiaHistory,
                      mileageSuspicion: event.target.value,
                    },
                  })
                }
              />

              <h3>Rizikové poznámky</h3>
              <textarea
                placeholder="Rizika z CEBIA"
                value={selectedCar.cebiaHistory?.riskNotes || ""}
                onChange={(event) =>
                  updateCar({
                    ...selectedCar,
                    cebiaHistory: {
                      ...selectedCar.cebiaHistory,
                      riskNotes: event.target.value,
                    },
                  })
                }
              />

              {selectedCar.aiCebiaReport && (
                <div className="aiReport">
                  <h3>AI shrnutí CEBIA</h3>
                  <pre>{selectedCar.aiCebiaReport}</pre>
                </div>
              )}
            </div>
          )}

          {module === "equipment" && (
            <div className="card decision">
              <h2>Výbava vozu</h2>

              <h3>Zjištěná výbava</h3>

              {[...selectedEquipment]
                .sort((a, b) => a.localeCompare(b, "cs"))
                .map((item) => (
                  <label key={item} className="checkItem">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedCar.equipment?.[item])}
                      onChange={() => toggleEquipment(item)}
                    />
                    {item}
                  </label>
                ))}

              <h3 style={{ marginTop: "20px" }}>Další výbava k doplnění</h3>

              {[...remainingEquipment]
                .sort((a, b) => a.localeCompare(b, "cs"))
                .map((item) => (
                  <label key={item} className="checkItem">
                    <input
                      type="checkbox"
                      checked={false}
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
                onChange={(event) => setNoteText(event.target.value)}
              />

              <button className="primary" onClick={addNote}>
                Přidat poznámku
              </button>

              {selectedCar.notes.map((note, index) => (
                <p key={index}>• {note}</p>
              ))}

              <hr />

              <h2>AI technický poradce</h2>

              <textarea
                placeholder="Např. vůz táhne doprava, vibruje volant při brzdění..."
                value={problemText}
                onChange={(event) => setProblemText(event.target.value)}
              />

              <button
                className="primary"
                onClick={analyzeTechnicalProblem}
                disabled={aiLoading}
              >
                {aiLoading ? "AI analyzuje..." : "Vyhodnotit závadu AI"}
              </button>

              {selectedCar.aiTechnicalReport && (
                <div className="aiReport">
                  <h3>AI technické zhodnocení</h3>
                  <pre>{selectedCar.aiTechnicalReport}</pre>
                </div>
              )}
            </div>
          )}

          {module === "valuation" && (
            <div className="card decision">
              <h2>Nacenění vozu</h2>

              <div className="formGrid">
                <div>
                  <p className="label">Datum nacenění</p>
                  <input
                    type="date"
                    value={selectedCar.valuationDate || ""}
                    onChange={(event) =>
                      updateValuationField("valuationDate", event.target.value)
                    }
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <p className="label">Návrh výkupní ceny</p>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Návrh výkupní ceny"
                    value={selectedCar.buyEstimate ?? ""}
                    onChange={(event) =>
                      updateValuationPrice("buyEstimate", event.target.value)
                    }
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <p className="label">Návrh prodejní ceny</p>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Návrh prodejní ceny"
                    value={selectedCar.saleEstimate ?? ""}
                    onChange={(event) =>
                      updateValuationPrice("saleEstimate", event.target.value)
                    }
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <p className="label">Potvrzená výkupní cena</p>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Potvrzená výkupní cena"
                    value={selectedCar.approvedPrice ?? ""}
                    onChange={(event) =>
                      updateValuationPrice("approvedPrice", event.target.value)
                    }
                    style={{ width: "100%" }}
                  />
                </div>
              </div>
            </div>
          )}
        </section>
      )}
      {fullscreenPhoto && (
        <div
          className="fullscreenOverlay"
          onClick={() => setFullscreenPhoto(null)}
        >
          <img
            src={fullscreenPhoto}
            className="fullscreenImage"
            alt="Fotka vozu v plném rozlišení"
            onClick={(event) => event.stopPropagation()}
          />

          <button
            className="closeFullscreen"
            onClick={(event) => {
              event.stopPropagation();
              setFullscreenPhoto(null);
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
