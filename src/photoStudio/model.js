export const angles = {
  frontLeft: "Zepředu zleva (45°)", frontRight: "Zepředu zprava (45°)",
  rearLeft: "Zezadu zleva (45°)", rearRight: "Zezadu zprava (45°)",
  front: "Zepředu", rear: "Zezadu", left: "Levý bok", right: "Pravý bok",
  interior: "Interiér", detail: "Detail / poškození",
};
export function needsPlateUpdate(item) { return item.ready && item.maskVersion !== 2; }
export function canExportPhoto(item) { return item.ready && item.approved && item.plateVerified && item.maskVersion === 2; }
export const backgroundOptions = {
  opportunityDarkTiles: { label: "Opportunity · tmavá dlažba", description: "Světlá stěna, logo Opportunity a antracitová dlažba", image: "/photo-studio/opportunity-dark-tiles.png" },
  opportunityWorkshop: { label: "Opportunity Dílna", description: "Podle vašich inzerátů: světlá stěna, dlažba a vrata", image: "/photo-studio/opportunity-workshop.png" },
  opportunityWhite: { label: "Opportunity White", description: "Světlé studio s firemním označením", image: "/photo-studio/opportunity-white.png" },
  opportunityGraphite: { label: "Opportunity Graphite", description: "Antracitová stěna a světelné linie", image: "/photo-studio/opportunity-graphite.png" },
  opportunityShowroom: { label: "Opportunity Showroom", description: "Prosvětlený showroom s dlažbou", image: "/photo-studio/opportunity-showroom.png" },
  opportunityConcrete: { label: "Opportunity Concrete", description: "Jemný beton a přirozené světlo", image: "/photo-studio/opportunity-concrete.png" },
  gray: { label: "Světle šedé studio", description: "Neutrální pozadí bez loga", image: null },
  white: { label: "Bílé studio", description: "Čisté bílé pozadí bez loga", image: null },
};
export const backgrounds = Object.fromEntries(Object.entries(backgroundOptions).map(([key, value]) => [key, value.label]));
export function backgroundReference(angle, background) {
  if (!Object.hasOwn(angles, angle) || !Object.hasOwn(backgroundOptions, background)) throw new Error("Neplatný pohled nebo pozadí.");
  return angle === "interior" || angle === "detail" ? null : backgroundOptions[background].image;
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
