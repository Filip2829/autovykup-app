import { supabase } from "../supabase.js";
import { parseDotCode, validateTirePhotoFile } from "./tireSets.js";

const FUNCTION_NAME = "analyze-tire-set-photos";
const DEFAULT_TIMEOUT_MS = 45000;
export const MAX_TIRE_ANALYSIS_PHOTOS = 6;
const MAX_IMAGE_EDGE = 1800;
const JPEG_QUALITY = 0.88;

const fieldDefinitions = {
  name: { kind: "text", label: "název pneumatiky", allowEstimate: false },
  tireSize: { kind: "text", label: "rozměr pneumatiky", allowEstimate: false },
  treadDepthMm: { kind: "number", label: "hloubka vzorku", allowEstimate: true },
  dotCode: { kind: "text", label: "DOT", allowEstimate: false },
  season: { kind: "text", label: "sezóna", allowEstimate: false },
  assemblyType: { kind: "text", label: "provedení sady", allowEstimate: false },
  boltPattern: { kind: "text", label: "rozteč", allowEstimate: false },
  et: { kind: "number", label: "ET", allowEstimate: false },
  quantity: { kind: "number", label: "počet kusů", allowEstimate: false },
};

const allowedStatuses = new Set(["confirmed", "estimated", "unreadable"]);
const allowedSeasons = new Set(["summer", "winter", "all_season"]);
const allowedAssemblyTypes = new Set(["tires_only", "steel_wheels", "alloy_wheels"]);

function text(value, limit = 300) {
  return value === null || value === undefined
    ? ""
    : String(value).trim().slice(0, limit);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Fotografii se nepodařilo načíst."));
    reader.readAsDataURL(file);
  });
}

async function prepareImage(file) {
  if (typeof createImageBitmap !== "function") return readFileAsDataUrl(file);

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return readFileAsDataUrl(file);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } finally {
    bitmap.close();
  }
}

function validateField(field, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { value: null, status: "unreadable", evidence: "Údaj nebyl vrácen." };
  }
  const status = allowedStatuses.has(value.status) ? value.status : "unreadable";
  const definition = fieldDefinitions[field];
  let normalizedValue;
  if (definition.kind === "number") {
    const number = Number(value.value);
    normalizedValue = Number.isFinite(number) && number >= 0 ? number : null;
  } else {
    normalizedValue = text(value.value, 120) || null;
  }
  return {
    value: normalizedValue,
    status,
    evidence: text(value.evidence, 300),
  };
}

export function validateTirePhotoAnalysisOutput(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AI analýza vrátila neplatnou odpověď.");
  }
  const fields = {};
  for (const field of Object.keys(fieldDefinitions)) {
    fields[field] = validateField(field, value.fields?.[field]);
  }
  return {
    fields,
    summary: text(value.summary, 500),
    warnings: (Array.isArray(value.warnings) ? value.warnings : [])
      .map((warning) => text(warning, 300))
      .filter(Boolean)
      .slice(0, 12),
  };
}

export function buildTireSetDraftFromAnalysis(analysis) {
  const warnings = [...analysis.warnings];
  const draft = {};

  for (const [field, definition] of Object.entries(fieldDefinitions)) {
    const result = analysis.fields[field];
    const usable =
      result.status === "confirmed" ||
      (definition.allowEstimate && result.status === "estimated");
    draft[field] = usable && result.value !== null ? result.value : "";

    if (result.status === "estimated") {
      warnings.push(
        `${definition.label}: pouze orientační odhad${result.evidence ? ` – ${result.evidence}` : ""}.`
      );
    } else if (result.status === "unreadable") {
      warnings.push(
        `${definition.label}: z fotografií nelze spolehlivě určit${result.evidence ? ` – ${result.evidence}` : ""}.`
      );
    }
  }

  if (draft.dotCode && !parseDotCode(draft.dotCode)) {
    draft.dotCode = "";
    warnings.push("DOT nebyl ve validním čtyřmístném formátu a nebyl předvyplněn.");
  }
  if (draft.season && !allowedSeasons.has(draft.season)) draft.season = "";
  if (draft.assemblyType && !allowedAssemblyTypes.has(draft.assemblyType)) {
    draft.assemblyType = "";
  }

  return {
    draft,
    summary: analysis.summary,
    warnings: [...new Set(warnings)],
  };
}

async function getInvocationErrorMessage(error) {
  if (error?.context && typeof error.context.clone === "function") {
    try {
      const body = await error.context.clone().json();
      return text(body?.detail || body?.error, 500);
    } catch {
      // Fallback below.
    }
  }
  return text(error?.message, 500) || "AI analýza fotografií není dostupná.";
}

export async function analyzeTirePhotos(
  files,
  { invoke, timeoutMs = DEFAULT_TIMEOUT_MS } = {}
) {
  const selectedFiles = Array.from(files || []);
  if (selectedFiles.length === 0) throw new Error("Vyberte alespoň jednu fotografii.");
  if (selectedFiles.length > MAX_TIRE_ANALYSIS_PHOTOS) {
    throw new Error(`Pro jednu analýzu lze použít nejvýše ${MAX_TIRE_ANALYSIS_PHOTOS} fotografií.`);
  }
  for (const file of selectedFiles) {
    const validation = validateTirePhotoFile(file);
    if (!validation.valid) throw new Error(validation.error);
  }

  const images = await Promise.all(selectedFiles.map(prepareImage));
  const invokeFunction =
    invoke ||
    ((body) => supabase.functions.invoke(FUNCTION_NAME, { body }));
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error("AI analýza překročila časový limit. Zkuste ji spustit znovu.")),
      timeoutMs
    );
  });

  try {
    const response = await Promise.race([invokeFunction({ images }), timeout]);
    if (response?.error) throw new Error(await getInvocationErrorMessage(response.error));
    if (response?.data?.error) {
      throw new Error(text(response.data.detail || response.data.error, 500));
    }
    return buildTireSetDraftFromAnalysis(
      validateTirePhotoAnalysisOutput(response?.data?.output ?? response?.data)
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export const tirePhotoAnalysisConstants = {
  functionName: FUNCTION_NAME,
  maxPhotos: MAX_TIRE_ANALYSIS_PHOTOS,
};
