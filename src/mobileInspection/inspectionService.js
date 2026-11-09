import { validatePriceRecommendationOutput } from "../services/priceRecommendationCore.js";
import { createPriceRecommendationSnapshotStore } from "../services/priceRecommendationSnapshots.js";
import {
  buildFormPatch, buildMarketPayload, buildNewInspection, canonicalIdentity,
  changedFormFields, damageAreas, priceFields, text,
} from "./inspectionModel.js";

export class DuplicateInspectionError extends Error {
  constructor(car) {
    super(`V evidenci už je ${car.name || "vůz"} se stejným VIN nebo SPZ. Můžeš otevřít jeho kartu.`);
    this.name = "DuplicateInspectionError";
    this.car = car;
  }
}
async function functionResult(client, name, body) {
  const { data, error } = await client.functions.invoke(name, { body });
  if (error || data?.error) {
    let detail = data?.detail || data?.error || error?.message;
    try { const response = await error?.context?.json(); detail = response?.detail || response?.error || detail; } catch { /* use known error */ }
    throw new Error(detail || "Služba neodpověděla. Zkus to znovu.");
  }
  if (!data || typeof data !== "object") throw new Error("Služba vrátila neplatnou odpověď.");
  return data;
}

export function createInspectionService({ client, username, now = () => new Date().toISOString(), uuid = () => crypto.randomUUID(), snapshots } = {}) {
  const history = snapshots || createPriceRecommendationSnapshotStore(client);
  async function get(id) {
    const { data, error } = await client.from("cars").select("*").eq("id", id).single();
    if (error || !data) throw new Error("Kartu se nepodařilo načíst. Mohla být smazána nebo nemáš přístup.");
    return data;
  }
  async function list() {
    const { data, error } = await client.from("cars").select("*")
      .contains("technical_params", { mobileInspection: { version: 1 } })
      .order("updated_at", { ascending: false }).limit(50);
    if (error) throw error;
    return data || [];
  }
  async function create(form, creationKey) {
    const payload = buildNewInspection(form, { username, creationKey, now: now() });
    const { data: candidates, error: readError } = await client.from("cars").select("id,name,vin,spz,technical_params");
    if (readError) throw readError;
    const existing = (candidates || []).find(car =>
      (text(form.vin) && canonicalIdentity(form.vin) === canonicalIdentity(car.vin)) ||
      (text(form.spz) && canonicalIdentity(form.spz) === canonicalIdentity(car.spz)) ||
      car.technical_params?.mobileInspection?.creationKey === creationKey
    );
    if (existing) {
      if (existing.technical_params?.mobileInspection?.creationKey === creationKey) return get(existing.id);
      throw new DuplicateInspectionError(existing);
    }
    const { data, error } = await client.from("cars").insert(payload).select("*").single();
    if (error || !data) throw error || new Error("Vůz se nepodařilo založit.");
    return data;
  }
  async function patch(id, makePatch) {
    const latest = await get(id);
    const changes = makePatch(latest);
    let request = client.from("cars").update({ ...changes, updated_by: username, updated_at: now() }).eq("id", id);
    request = latest.updated_at == null ? request.is("updated_at", null) : request.eq("updated_at", latest.updated_at);
    const { data, error } = await request.select("*").maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Kartu mezitím změnil kolega. Načti aktuální údaje a zkus to znovu. Rozepsané změny zůstaly zachované.");
    return data;
  }
  async function saveForm(id, form, baseline) {
    const changes = changedFormFields(form, baseline);
    if (!Object.keys(changes).length) return get(id);
    return patch(id, latest => {
      const update = buildFormPatch(latest, changes, baseline);
      if (!latest.valuation_date && text(form.valuationDate) && priceFields.some(([key]) => key in changes)) update.valuation_date = form.valuationDate;
      return update;
    });
  }
  async function addNote(id, body, noteKey = uuid()) {
    if (!text(body)) throw new Error("Nejdřív napiš poznámku.");
    return patch(id, latest => {
      const mobile = latest.technical_params?.mobileInspection || {};
      if ((mobile.noteKeys || []).includes(noteKey)) return {};
      return {
        notes: [...(latest.notes || []), `${text(body)} (${username}, ${new Date(now()).toLocaleString("cs-CZ", { timeZone: "Europe/Prague" })})`],
        technical_params: { ...latest.technical_params, mobileInspection: { ...mobile, noteKeys: [...(mobile.noteKeys || []), noteKey] } },
      };
    });
  }
  async function upload(id, file, { kind, description = "", area = "exterior", attachmentId = uuid() } = {}) {
    if (!["tp", "vehicle", "damage"].includes(kind)) throw new Error("Neznámý druh fotografie.");
    if (!file || !['image/jpeg','image/png','image/webp','image/heic','image/heif'].includes(file.type)) throw new Error("Vyber fotografii JPEG, PNG, WebP nebo HEIC.");
    if (file.size > 20 * 1024 * 1024) throw new Error("Fotografie je příliš velká. Zkus menší soubor (nejvýše 20 MB).");
    if (kind === "damage" && (!text(description) || !damageAreas.some(([key]) => key === area))) throw new Error("K poškození doplň místo a krátký popis.");
    const current = await get(id); // Do not upload against a deleted or inaccessible card.
    if (!/^[a-f0-9-]{36}$/i.test(attachmentId)) throw new Error("Neplatný identifikátor fotografie.");
    const extension = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif" })[file.type] || "jpg";
    const bucket = kind === "tp" ? "vehicle-documents" : "car-photos";
    const objectPath = kind === "tp" ? `${id}/${attachmentId}.${extension}` : `vehicle-photos/${id}-${kind}-${attachmentId}.${extension}`;
    const url = kind === 'tp' ? null : client.storage.from(bucket).getPublicUrl(objectPath).data?.publicUrl;
    async function attached() {
      if (kind !== 'tp') {
        const car = await get(id);
        return (car.photos || []).includes(url) ? car : null;
      }
      const { data, error } = await client.from('vehicle_documents').select('car_id,file_path').eq('id', attachmentId).maybeSingle();
      if (error) throw error;
      if (data && (String(data.car_id) !== String(id) || data.file_path !== objectPath)) throw new Error('Dokument je přiřazen jinému vozu.');
      return data ? get(id) : null;
    }
    const prior = await attached();
    if (prior) return prior;
    const { error: uploadError } = await client.storage.from(bucket).upload(objectPath, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      // A response can be lost after Storage has saved the object. Only reuse it
      // if the bytes match; never overwrite another upload on a retry.
      const { data: existing, error } = await client.storage.from(bucket).download(objectPath);
      if (error || !existing) throw uploadError;
      const [a,b] = await Promise.all([file.arrayBuffer(), existing.arrayBuffer()]);
      const bytes = new Uint8Array(a), saved = new Uint8Array(b);
      if (a.byteLength !== b.byteLength || bytes.some((v,i) => v !== saved[i])) throw uploadError;
    }
    try {
      if (kind === "tp") {
        const { error } = await client.from("vehicle_documents").insert({ id: attachmentId, car_id: id, title: "Technický průkaz · mobilní prohlídka", category: "Technický průkaz", description: "Fotografie TP z mobilní prohlídky", file_path: objectPath, file_name: file.name || `TP.${extension}`, file_size: file.size, mime_type: file.type, uploaded_by: username });
        if (error) throw error;
        return await get(id).catch(() => current);
      }
      if (!url) throw new Error("Nahranou fotografii se nepodařilo připojit ke kartě.");
      return await patch(id, latest => {
        const changes = { photos: [...(latest.photos || []), url] };
        if (kind === "damage") {
          const report = latest.damage_report || {};
          changes.damage_report = {
            ...report,
            [area]: [text(report[area]), text(description)].filter(Boolean).join("\n"),
            inspectionPhotos: [...(report.inspectionPhotos || []), { id: attachmentId, url, description: text(description), area, createdAt: now(), createdBy: username }],
          };
        }
        return changes;
      });
    } catch (error) {
      // Re-read after an uncertain response. Never delete an object that may
      // already be attached. Keep an unattached file available for the same retry.
      const recovered = await attached().catch(() => null);
      if (recovered) return recovered;
      throw error;
    }
  }
  async function documents(id) {
    const { data, error } = await client.from("vehicle_documents").select("*").eq("car_id", id).order("created_at");
    if (error) throw error;
    return Promise.all((data || []).filter(doc => (doc.category === 'Technický průkaz' || doc.title?.startsWith("Technický průkaz")) && doc.mime_type?.startsWith("image/")).map(async doc => {
      const { data: signed, error: signingError } = await client.storage.from("vehicle-documents").createSignedUrl(doc.file_path, 3600);
      if (signingError) throw signingError;
      return { ...doc, url: signed.signedUrl };
    }));
  }
  async function extract(id, source) {
    const current = await get(id);
    if (source === "registry") {
      if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(text(current.vin))) throw new Error("Pro načtení z registru doplň a ulož platný VIN.");
      return functionResult(client, "fetch-vehicle-registry-data", { vin: current.vin });
    }
    const photos = await documents(id);
    if (!photos.length && !(current.technical_card_photos || []).length) throw new Error("Nejdřív vyfoť nebo přidej technický průkaz.");
    return functionResult(client, "analyze-vehicle-technical-data", {
      car: { ...current, technicalParams: current.technical_params },
      technicalCardPhotos: [...photos.map(doc => doc.url), ...(current.technical_card_photos || [])].slice(0, 10),
      cebiaFiles: [], vehiclePhotos: [],
    });
  }
  async function applyExtraction(id, result) {
    return patch(id, latest => {
      const params = { ...latest.technical_params };
      const allowed = ["brand", "model", "version", "fuel", "engine", "powerKw", "transmission", "drive", "bodyType", "color", "seats", "doors", "firstRegistration", "stkValidUntil", "productionYear", "registrationInCzechia", "ownersCount", "operatorsCount", "displacement"];
      for (const key of allowed) if (!text(params[key]) && text(result.technicalParams?.[key])) params[key] = text(result.technicalParams[key]);
      const changes = { technical_params: params, ai_technical_report: [text(latest.ai_technical_report), text(result.report)].filter(Boolean).join("\n\n") };
      if (!text(latest.year)) {
        const year = text(params.productionYear) || text(params.firstRegistration).match(/(?:19|20)\d{2}/)?.[0];
        if (/^\d{4}$/.test(year)) changes.year = year;
      }
      if (!text(latest.vin) && /^[A-HJ-NPR-Z0-9]{17}$/.test(text(result.technicalParams?.vin).toUpperCase())) changes.vin = text(result.technicalParams.vin).toUpperCase();
      const history = { ...latest.cebia_history };
      for (const [key, value] of Object.entries(result.cebiaHistory || {})) if (!text(history[key])) history[key] = value;
      changes.cebia_history = history;
      return changes;
    });
  }
  async function estimate(id, force = false) {
    const current = await get(id);
    const payload = buildMarketPayload(current);
    if (!force) {
      const cached = await history.findFresh(id, payload);
      if (cached) return { ...cached, cached: true };
    }
    const data = await functionResult(client, "estimate-vehicle-market-price", payload);
    const output = validatePriceRecommendationOutput(data.output || data, payload.preparationCosts, payload.vehicle);
    return { ...await history.save(id, payload, output), cached: false };
  }
  async function complete(id) {
    return patch(id, latest => ({ technical_params: { ...latest.technical_params, mobileInspection: { ...latest.technical_params?.mobileInspection, version: 1, completedAt: now() } } }));
  }
  return { get, list, create, saveForm, addNote, upload, documents, extract, applyExtraction, estimate, complete };
}
