import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  CheckCircle,
  ClipboardList,
  MessageCircle,
  Plus,
  Search,
  ShieldCheck,
  Star,
} from "lucide-react";

import "./App.css";
import { supabase } from "./supabase";
import VehicleTechnical from "./components/VehicleTechnical";
import VehiclePricing from "./components/VehiclePricing";
import VehicleChecklist from "./components/VehicleChecklist";
import VehiclePhotos from "./components/VehiclePhotos";
import VehicleNotes from "./components/VehicleNotes";
import VehicleHeader from "./components/VehicleHeader";
import VehiclePurchase from "./components/VehiclePurchase";
import VehicleDamage from "./components/VehicleDamage";
import AppSelect from "./components/ui/AppSelect";
import AppModal from "./components/ui/AppModal";

const emptyChecklist = {
  "Servisní historie": false,
  "Provedeno čištění": false,
  "Počet klíčů 2x": false,
  "Kontrola CEBIA / CarVertical": false,
  "Mechanická prohlídka + diagnostika": false,
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

const vehicleDocumentCategories = [
  "Servisní knížka",
  "Faktura",
  "Servisní zakázka",
  "Diagnostika",
  "STK",
  "CEBIA",
  "Kupní smlouva",
  "Jiný dokument",
];

const dealTypeOptions = [
  { value: "buyout", label: "Výkup" },
  { value: "trade_in", label: "Protiúčet" },
  { value: "commission", label: "Komise" },
];

const emptyVehicleDocumentForm = {
  category: "Servisní knížka",
  title: "",
  description: "",
};

const emptyDamageReport = {
  exterior: "",
  interior: "",
  technical: "",
  tiresBrakes: "",
  glassLights: "",
  otherDamage: "",
  serviceCost: null,
  bodyPaintCost: null,
  cleaningCost: null,
  tiresCost: null,
  stkRegistrationCost: null,
  otherCost: null,
  note: "",
  recommendation: "",
};

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

function toNullableNumber(value) {
  if (value === "" || value === null || value === undefined) return null;

  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? null : numberValue;
}

function normalizePostPurchaseCosts(costs = {}) {
  return {
    service: toNullableNumber(costs.service),
    cleaning: toNullableNumber(costs.cleaning),
    bodyPaint: toNullableNumber(costs.bodyPaint),
    registration: toNullableNumber(costs.registration),
    other: toNullableNumber(costs.other),
    note: costs.note || "",
  };
}

function normalizeDamageReport(report = {}) {
  return {
    exterior: report.exterior || "",
    interior: report.interior || "",
    technical: report.technical || "",
    tiresBrakes: report.tiresBrakes || "",
    glassLights: report.glassLights || "",
    otherDamage: report.otherDamage || "",
    serviceCost: toNullableNumber(report.serviceCost),
    bodyPaintCost: toNullableNumber(report.bodyPaintCost),
    cleaningCost: toNullableNumber(report.cleaningCost),
    tiresCost: toNullableNumber(report.tiresCost),
    stkRegistrationCost: toNullableNumber(report.stkRegistrationCost),
    otherCost: toNullableNumber(report.otherCost),
    note: report.note || "",
    recommendation: report.recommendation || "",
  };
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
    valuationDate: car.valuation_date ?? "",
    saleEstimate: car.sale_estimate ?? "",
    buyEstimate: car.buy_estimate ?? "",
    customerExpectedPrice: car.customer_expected_price ?? "",
    approvedPrice: car.approved_price ?? "",
    dealType: car.deal_type || "buyout",
    tradeInSource: car.trade_in_source || "",
    commissionNotes: car.commission_notes || "",
    purchaseDate: car.purchase_date ?? "",
    purchasePrice: car.purchase_price ?? "",
    expectedSalePrice: car.expected_sale_price ?? "",
    postPurchaseCosts:
      car.post_purchase_costs && typeof car.post_purchase_costs === "object"
        ? clone(car.post_purchase_costs, {})
        : {},
    damageReport:
      car.damage_report && typeof car.damage_report === "object"
        ? clone(
            { ...emptyDamageReport, ...car.damage_report },
            { ...emptyDamageReport }
          )
        : { ...emptyDamageReport },
    purchasedStatus: car.purchased_status ?? "",
    lifecycleStage: car.lifecycleStage ?? car.lifecycle_stage ?? "valuation",
    soldPrice: car.sold_price ?? "",
    soldDate: car.sold_date ?? "",
    aiTechnicalReport: car.ai_technical_report || "",
    aiDocumentReport: car.ai_document_report || "",
    aiCebiaReport: car.ai_cebia_report || "",
  };
}

function prepareVehicleDocument(document) {
  return {
    ...document,
    documentDate: document.document_date || "",
    filePath: document.file_path || "",
    fileName: document.file_name || "",
    fileSize: document.file_size || 0,
    mimeType: document.mime_type || "",
    uploadedBy: document.uploaded_by || "",
    createdAt: document.created_at || "",
    aiSummary: document.ai_summary || "",
    aiProcessed: Boolean(document.ai_processed),
    isVisibleToCustomer: Boolean(document.is_visible_to_customer),
  };
}

function formatFileSize(size) {
  const bytes = Number(size) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isChecklistComplete(checklist = {}) {
  return (
    Boolean(checklist["Servisní historie"]) &&
    Boolean(checklist["Provedeno čištění"]) &&
    Boolean(checklist["Počet klíčů 2x"]) &&
    Boolean(checklist["Kontrola CEBIA / CarVertical"]) &&
    Boolean(checklist["Mechanická prohlídka + diagnostika"])
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
  const [listMode, setListMode] = useState("valuation");
  const [module, setModule] = useState("overview");
  const moduleContentRef = useRef(null);
  const [noteText, setNoteText] = useState("");
  const [problemText, setProblemText] = useState("");
  const [vehicleDocuments, setVehicleDocuments] = useState([]);
  const [vehicleDocumentsLoading, setVehicleDocumentsLoading] = useState(false);
  const [vehicleDocumentForm, setVehicleDocumentForm] = useState({
    ...emptyVehicleDocumentForm,
  });
  const [vehicleDocumentFile, setVehicleDocumentFile] = useState(null);
  const [isVehicleDocumentModalOpen, setIsVehicleDocumentModalOpen] =
    useState(false);
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

  function openModule(nextModule) {
    setModule(nextModule);

    requestAnimationFrame(() => {
      const element = moduleContentRef.current;
      if (!element) return;

      const top = element.getBoundingClientRect().top + window.scrollY - 16;
      window.scrollTo({ top, behavior: "smooth" });
    });
  }

  function resetVehicleDocumentForm() {
    setVehicleDocumentForm({ ...emptyVehicleDocumentForm });
    setVehicleDocumentFile(null);
  }

  function openVehicleDocumentModal() {
    resetVehicleDocumentForm();
    setIsVehicleDocumentModalOpen(true);
  }

  function closeVehicleDocumentModal() {
    resetVehicleDocumentForm();
    setIsVehicleDocumentModalOpen(false);
  }

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

  useEffect(() => {
    if (view === "detail" && selectedCar?.id) {
      loadVehicleDocuments(selectedCar.id);
    } else {
      setVehicleDocuments([]);
    }
  }, [selectedCar?.id, view]);

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

  const valuationCars = useMemo(
    () => filteredCars.filter((car) => car.lifecycleStage !== "purchased"),
    [filteredCars]
  );

  const purchasedCars = useMemo(
    () => filteredCars.filter((car) => car.lifecycleStage === "purchased"),
    [filteredCars]
  );

  const visibleCars = listMode === "purchased" ? purchasedCars : valuationCars;
  const visibleListTitle =
    listMode === "purchased" ? "Vykoupená auta" : "Aktuální nacenění";
  const visibleEmptyText =
    listMode === "purchased"
      ? "Žádná vykoupená auta."
      : "Žádná aktuální nacenění.";

  function openVehicleList(nextListMode) {
    setListMode(nextListMode);
    setView("list");
  }

  function selectCar(car) {
    setSelectedCar(prepareCar(car));
    setView("detail");
    setModule("overview");
    setEditMode(false);
    setNoteText("");
    setProblemText("");
    setVehicleDocumentForm({ ...emptyVehicleDocumentForm });
    setVehicleDocumentFile(null);
    setIsVehicleDocumentModalOpen(false);
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
      lifecycleStage: updated.lifecycleStage || "valuation",
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
        sale_estimate: toNullableNumber(updatedWithUser.saleEstimate),
        buy_estimate: toNullableNumber(updatedWithUser.buyEstimate),
        customer_expected_price: toNullableNumber(
          updatedWithUser.customerExpectedPrice
        ),
        approved_price: toNullableNumber(updatedWithUser.approvedPrice),
        deal_type: updatedWithUser.dealType || null,
        trade_in_source: updatedWithUser.tradeInSource || null,
        commission_notes: updatedWithUser.commissionNotes || null,
        purchase_date: updatedWithUser.purchaseDate || null,
        purchase_price: toNullableNumber(updatedWithUser.purchasePrice),
        expected_sale_price: toNullableNumber(
          updatedWithUser.expectedSalePrice
        ),
        post_purchase_costs: normalizePostPurchaseCosts(
          updatedWithUser.postPurchaseCosts
        ),
        damage_report: normalizeDamageReport(updatedWithUser.damageReport),
        purchased_status: updatedWithUser.purchasedStatus || null,
        lifecycle_stage: updatedWithUser.lifecycleStage,
        sold_price: toNullableNumber(updatedWithUser.soldPrice),
        sold_date: updatedWithUser.soldDate || null,
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
      customer_expected_price: null,
      approved_price: null,
      deal_type: "buyout",
      trade_in_source: null,
      commission_notes: null,
      lifecycle_stage: "valuation",
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

  async function moveSelectedCarToPurchased() {
    if (!selectedCar) return;

    const confirmMove = window.confirm(
      `Přesunout ${selectedCar.name} do vykoupených vozů?`
    );

    if (!confirmMove) return;

    await updateCar({
      ...selectedCar,
      lifecycleStage: "purchased",
    });
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

  async function loadVehicleDocuments(carId) {
    if (!carId) return;

    setVehicleDocumentsLoading(true);

    const { data, error } = await supabase
      .from("vehicle_documents")
      .select("*")
      .eq("car_id", carId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert(error.message);
      setVehicleDocumentsLoading(false);
      return;
    }

    setVehicleDocuments((data || []).map(prepareVehicleDocument));
    setVehicleDocumentsLoading(false);
  }

  async function addVehicleDocument(event) {
    event.preventDefault();
    const formElement = event.currentTarget;

    if (!selectedCar || !vehicleDocumentFile) {
      alert("Vyber dokument k nahrání.");
      return;
    }

    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowedTypes.includes(vehicleDocumentFile.type)) {
      alert("Povolené jsou pouze PDF, JPG, JPEG a PNG soubory.");
      return;
    }

    const extension =
      vehicleDocumentFile.name.split(".").pop()?.toLowerCase() || "file";
    const documentId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const filePath = `${selectedCar.id}/${documentId}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("vehicle-documents")
      .upload(filePath, vehicleDocumentFile);

    if (uploadError) {
      alert(uploadError.message);
      return;
    }

    const { data, error } = await supabase
      .from("vehicle_documents")
      .insert([
        {
          car_id: selectedCar.id,
          title: vehicleDocumentForm.title.trim() || vehicleDocumentFile.name,
          category: vehicleDocumentForm.category,
          description: vehicleDocumentForm.description.trim() || null,
          file_path: filePath,
          file_name: vehicleDocumentFile.name,
          file_size: vehicleDocumentFile.size,
          mime_type: vehicleDocumentFile.type || null,
          uploaded_by: currentUsername,
          ai_summary: null,
          ai_processed: false,
          is_visible_to_customer: false,
        },
      ])
      .select()
      .single();

    if (error) {
      await supabase.storage.from("vehicle-documents").remove([filePath]);
      alert(error.message);
      return;
    }

    setVehicleDocuments((currentDocuments) => [
      prepareVehicleDocument(data),
      ...currentDocuments,
    ]);
    setVehicleDocumentForm({ ...emptyVehicleDocumentForm });
    setVehicleDocumentFile(null);
    setIsVehicleDocumentModalOpen(false);
    formElement.reset();
  }

  async function openVehicleDocument(document) {
    const { data, error } = await supabase.storage
      .from("vehicle-documents")
      .createSignedUrl(document.filePath, 60);

    if (error) {
      alert(error.message);
      return;
    }

    window.open(data.signedUrl, "_blank");
  }

  async function downloadVehicleDocument(document) {
    const { data, error } = await supabase.storage
      .from("vehicle-documents")
      .download(document.filePath);

    if (error) {
      alert(error.message);
      return;
    }

    const objectUrl = window.URL.createObjectURL(data);
    const link = window.document.createElement("a");
    link.href = objectUrl;
    link.download = document.fileName || document.title || "dokument";
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
    window.URL.revokeObjectURL(objectUrl);
  }

  async function deleteVehicleDocument(document) {
    const confirmDelete = window.confirm(
      `Opravdu chceš smazat dokument ${document.title || document.fileName}?`
    );
    if (!confirmDelete) return;

    const { error } = await supabase
      .from("vehicle_documents")
      .delete()
      .eq("id", document.id);

    if (error) {
      alert(error.message);
      return;
    }

    await supabase.storage.from("vehicle-documents").remove([document.filePath]);
    setVehicleDocuments((currentDocuments) =>
      currentDocuments.filter((item) => item.id !== document.id)
    );
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
                <p>{valuationCars.length} záznamů</p>
                <button onClick={() => openVehicleList("valuation")}>Otevřít</button>
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
                <p>{purchasedCars.length} záznamů</p>
                <button onClick={() => openVehicleList("purchased")}>
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
            <div>
              <h2>{visibleListTitle}</h2>

              <div className="cars">
                {visibleCars.map((car) => (
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

                {visibleCars.length === 0 && (
                  <div className="card">
                    <p>{visibleEmptyText}</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      {view === "detail" && selectedCar && (
        <section>
          <VehicleHeader
            selectedCar={selectedCar}
            statusClassName={
              selectedCar.status === STATUS.MISSING_DOCS
                ? "statusDanger"
                : selectedCar.status === STATUS.APPROVED
                ? "statusSuccess"
                : "statusWarning"
            }
            onBack={() => setView("list")}
            onEdit={() => setEditMode(true)}
            onDelete={deleteCar}
            formatDate={formatDate}
          />

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

          {selectedCar.lifecycleStage !== "purchased" && (
            <div className="card decision">
              <h2>Přesun do vykoupených vozů</h2>
              <p>
                Auto zůstane ve stejném záznamu a přesune se ze sekce
                aktuálních nacenění do vykoupených aut.
              </p>

              <button className="success" onClick={moveSelectedCarToPurchased}>
                Přesunout do vykoupených vozů
              </button>
            </div>
          )}

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
              <button onClick={() => openModule("technical")}>Otevřít</button>
            </div>

            <div className="module">
              <Camera />
              <h3>Fotky vozu</h3>
              <button onClick={() => openModule("photos")}>Otevřít</button>
            </div>

            <div className="module">
              <ClipboardList />
              <h3>Administrativa</h3>
              <p className={checklistComplete ? "okText" : "badText"}>
                {checklistComplete ? "Hotovo" : "Není hotovo"}
              </p>
              <button onClick={() => openModule("checklist")}>Otevřít</button>
            </div>

            <div className="module">
              <ShieldCheck />
              <h3>Historie CEBIA</h3>
              <p className={selectedCar.aiCebiaReport ? "okText" : ""}>
                {selectedCar.aiCebiaReport ? "Vyhodnoceno" : "Zatím nevyhodnoceno"}
              </p>
              <button onClick={() => openModule("cebiaHistory")}>Otevřít</button>
            </div>

            <div className="module">
              <Star />
              <h3>Výbava</h3>
              <button onClick={() => openModule("equipment")}>Otevřít</button>
            </div>

            <div className="module">
              <ShieldCheck />
              <h3>Poškození a opravy</h3>
              <button onClick={() => openModule("damage")}>Otevřít</button>
            </div>

            <div className="module">
              <MessageCircle />
              <h3>Poznámky + AI</h3>
              <button onClick={() => openModule("notes")}>Otevřít</button>
            </div>

            <div className="module">
              <ShieldCheck />
              <h3>Nacenění</h3>
              <p className={valuationComplete ? "okText" : ""}>
                {valuationComplete ? "Hotovo" : "Zatím neprovedeno"}
              </p>
              <button onClick={() => openModule("valuation")}>Otevřít</button>
            </div>

            {selectedCar.lifecycleStage !== "purchased" && (
              <div className="module">
                <ShieldCheck />
                <h3>Výkup vozidla</h3>
                <p className={selectedCar.purchaseDate || selectedCar.purchasePrice ? "okText" : ""}>
                  {selectedCar.purchaseDate || selectedCar.purchasePrice
                    ? "Zahájeno"
                    : "Zatím nevyplněno"}
                </p>
                <button onClick={() => openModule("purchase")}>Otevřít</button>
              </div>
            )}
          </div>

          {module === "technical" && (
            <VehicleTechnical
              selectedCar={selectedCar}
              updateCar={updateCar}
              analyzeVehicleTechnicalData={analyzeVehicleTechnicalData}
              technicalAiLoading={technicalAiLoading}
              moduleContentRef={moduleContentRef}
            />
          )}

          {module === "photos" && (
            <VehiclePhotos
              selectedCar={selectedCar}
              addPhoto={addPhoto}
              downloadPhoto={downloadPhoto}
              deletePhoto={deletePhoto}
              moduleContentRef={moduleContentRef}
            />
          )}

          {module === "checklist" && (
            <VehicleChecklist
              selectedCar={selectedCar}
              checklistItems={Object.keys(emptyChecklist)}
              toggleChecklist={toggleChecklist}
              addTechnicalCardPhoto={addTechnicalCardPhoto}
              deleteTechnicalCard={deleteTechnicalCard}
              deleteCebiaFile={deleteCebiaFile}
              vehicleDocuments={vehicleDocuments}
              vehicleDocumentsLoading={vehicleDocumentsLoading}
              openVehicleDocumentModal={openVehicleDocumentModal}
              openVehicleDocument={openVehicleDocument}
              downloadVehicleDocument={downloadVehicleDocument}
              deleteVehicleDocument={deleteVehicleDocument}
              formatFileSize={formatFileSize}
              moduleContentRef={moduleContentRef}
            />
          )}

          <AppModal
            isOpen={isVehicleDocumentModalOpen}
            title="Přidat dokument"
            onClose={closeVehicleDocumentModal}
          >
            <form onSubmit={addVehicleDocument}>
              <div className="formGrid">
                <div>
                  <p className="label">Kategorie</p>
                  <AppSelect
                    ariaLabel="Kategorie dokumentu"
                    value={vehicleDocumentForm.category}
                    options={vehicleDocumentCategories.map((category) => ({
                      value: category,
                      label: category,
                    }))}
                    onChange={(value) =>
                      setVehicleDocumentForm({
                        ...vehicleDocumentForm,
                        category: value,
                      })
                    }
                  />
                </div>

                <div>
                  <p className="label">Název</p>
                  <input
                    placeholder="Název dokumentu"
                    value={vehicleDocumentForm.title}
                    onChange={(event) =>
                      setVehicleDocumentForm({
                        ...vehicleDocumentForm,
                        title: event.target.value,
                      })
                    }
                  />
                </div>

              </div>

              <textarea
                placeholder="Popis"
                value={vehicleDocumentForm.description}
                onChange={(event) =>
                  setVehicleDocumentForm({
                    ...vehicleDocumentForm,
                    description: event.target.value,
                  })
                }
              />

              <label className="uploadBox">
                Vybrat PDF / JPG / JPEG / PNG
                <input
                  type="file"
                  accept=".pdf,image/jpeg,image/png"
                  onChange={(event) =>
                    setVehicleDocumentFile(event.target.files?.[0] || null)
                  }
                />
              </label>

              {vehicleDocumentFile && (
                <p>
                  {vehicleDocumentFile.name} ·{" "}
                  {formatFileSize(vehicleDocumentFile.size)}
                </p>
              )}

              <div className="appModalActions">
                <button
                  className="primary outline"
                  type="button"
                  onClick={closeVehicleDocumentModal}
                >
                  Zrušit
                </button>

                <button className="primary" type="submit">
                  Přidat dokument
                </button>
              </div>
            </form>
          </AppModal>

          {module === "cebiaHistory" && (
            <div className="card decision" ref={moduleContentRef}>
              <h2>Historie CEBIA</h2>

              <div className="formGrid">
                <div>
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
                  <p className="label">Počet majitelů / provozovatelů</p>
                </div>

                <div>
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
                  <p className="label">Země původu</p>
                </div>

                <div>
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
                  <p className="label">Financování</p>
                </div>

                <div>
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
                  <p className="label">Taxi / půjčovna</p>
                </div>

                <div>
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
                  <p className="label">Import / registrace</p>
                </div>
              </div>

              <h3>Historie škod</h3>
              <div>
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
                <p className="label">Historie poškození</p>
              </div>

              <h3>Historie kilometrů</h3>
              <div>
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
                <p className="label">Historie tachometru</p>
              </div>

              <h3>Podezření na stočení km</h3>
              <div>
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
                <p className="label">Podezření na stav km</p>
              </div>

              <h3>Rizikové poznámky</h3>
              <div>
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
                <p className="label">Rizikové poznámky</p>
              </div>

              {selectedCar.aiCebiaReport && (
                <div className="aiReport">
                  <h3>AI shrnutí CEBIA</h3>
                  <pre>{selectedCar.aiCebiaReport}</pre>
                </div>
              )}
            </div>
          )}

          {module === "equipment" && (
            <div className="card decision" ref={moduleContentRef}>
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
            <div className="card decision" ref={moduleContentRef}>
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

              <VehicleNotes
                selectedCar={selectedCar}
                noteText={noteText}
                setNoteText={setNoteText}
                addNote={addNote}
                problemText={problemText}
                setProblemText={setProblemText}
                analyzeTechnicalProblem={analyzeTechnicalProblem}
                aiLoading={aiLoading}
              />
            </div>
          )}

          {module === "valuation" && (
            <VehiclePricing
              selectedCar={selectedCar}
              setSelectedCar={setSelectedCar}
              setCars={setCars}
              supabase={supabase}
              prepareCar={prepareCar}
              calculateStatus={calculateStatus}
              toNullableNumber={toNullableNumber}
              currentUsername={currentUsername}
              moduleContentRef={moduleContentRef}
            />
          )}

          {module === "damage" && (
            <VehicleDamage
              selectedCar={selectedCar}
              updateCar={updateCar}
              moduleContentRef={moduleContentRef}
            />
          )}

          {module === "purchase" && (
            <VehiclePurchase
              selectedCar={selectedCar}
              updateCar={updateCar}
              moduleContentRef={moduleContentRef}
            />
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
