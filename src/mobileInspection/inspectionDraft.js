import { changedFormFields, readInspectionForm } from './inspectionModel.js';

export const inspectionDraftKey = userId => `autovykup.mobile-inspection.v1.${userId}`;

export function readInspectionDraft(storage, key) {
  try {
    const draft = JSON.parse(storage.getItem(key));
    if (draft?.version !== 1 || !draft.form || !draft.baseline || typeof draft.creationKey !== 'string') return null;
    const keys = Object.keys(readInspectionForm());
    const pick = values => Object.fromEntries(keys.filter(k => typeof values[k] === 'string').map(k => [k, values[k]]));
    return { ...draft, form: { ...readInspectionForm(), ...pick(draft.form) }, baseline: { ...readInspectionForm(), ...pick(draft.baseline) } };
  } catch { return null; }
}

export function writeInspectionDraft(storage, key, draft) {
  try { storage.setItem(key, JSON.stringify({ ...draft, version: 1 })); return true; }
  catch { return false; }
}

export function reconcileSavedForm(current, submitted, saved) {
  return { ...saved, ...changedFormFields(current, submitted) };
}
