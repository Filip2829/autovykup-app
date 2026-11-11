export const angles = {
  frontLeft: "Zepředu zleva (45°)", frontRight: "Zepředu zprava (45°)",
  rearLeft: "Zezadu zleva (45°)", rearRight: "Zezadu zprava (45°)",
  front: "Zepředu", rear: "Zezadu", left: "Levý bok", right: "Pravý bok",
  interior: "Interiér", detail: "Detail / poškození",
};
export function needsPlateUpdate(item) { return item.ready && item.maskVersion !== 2; }
export function canExportPhoto(item) { return item.ready && item.approved && item.plateVerified && item.maskVersion === 2; }
export const backgroundOptions = {
  opportunityShowroom: { label: "Opportunity Showroom", description: "Prosvětlený showroom s dlažbou", image: "/photo-studio/opportunity-showroom.png" },
};
export const showroomBackground = 'opportunityShowroom';
export function normalizeBackground(background) {
  if (!['opportunityShowroom', 'opportunityDarkTiles', 'opportunityWorkshop', 'opportunityWhite', 'opportunityGraphite', 'opportunityConcrete', 'gray', 'white'].includes(background)) throw new Error('Neplatné pozadí.');
  return showroomBackground;
}
export const backgrounds = Object.fromEntries(Object.entries(backgroundOptions).map(([key, value]) => [key, value.label]));
export function backgroundReference(angle, background) {
  if (!Object.hasOwn(angles, angle)) throw new Error("Neplatný pohled nebo pozadí.");
  const preset = normalizeBackground(background);
  return angle === "interior" || angle === "detail" ? null : backgroundOptions[preset].image;
}
export function validatePhoto(file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Použijte JPG, PNG nebo WebP. HEIC nejprve převeďte do JPG.");
  if (!file.size || file.size > 12 * 1024 * 1024) throw new Error("Fotografie může mít nejvýše 12 MB.");
}
export function exportName(index, angle) {
  return `${String(index + 1).padStart(2, "0")}-${Object.hasOwn(angles, angle) ? angle : "photo"}.jpg`;
}
export function reflectionMode(angle, value = 'off') {
  if (!['off', 'gentle'].includes(value)) throw new Error('Neplatný režim redukce odrazů.');
  if (!Object.hasOwn(angles, angle)) throw new Error('Neplatný pohled.');
  return 'off'; // Legacy clients may send gentle; source pixels must remain unchanged.
}
