export const statuses = { new: 'Nová', in_progress: 'V řešení', awaiting_info: 'Čeká na doplnění', offer_sent: 'Nabídka odeslána', accepted: 'Nabídka přijata', declined: 'Nabídka odmítnuta', closed: 'Uzavřeno' };
export const shots = { front: 'Pohled zepředu', rear: 'Pohled zezadu', left: 'Levý bok', right: 'Pravý bok', interior: 'Interiér', dashboard: 'Tachometr', cabin_dashboard: 'Celá palubní deska', engine: 'Motorový prostor', boot: 'Zavazadlový prostor', seats: 'Sedadla', wheels: 'Kola a pneumatiky', damage: 'Poškození', registration_front: 'Technický průkaz – přední strana', registration_back: 'Technický průkaz – zadní strana', other: 'Další snímky' };
export const questions = { driveable: 'Je vozidlo pojízdné?', stk: 'Má platnou STK?', accident: 'Bylo havarované?', damage: 'Má viditelná poškození?', faults: 'Má známé technické závady?', serviced: 'Bylo pravidelně servisováno?', history: 'Má servisní knihu / elektronickou historii?', first_owner: 'Je po prvním majiteli?', tires: 'Má druhou sadu pneumatik?', keys: 'Má dva klíče?', financed: 'Je zatíženo úvěrem nebo leasingem?', vat: 'Je doložená možnost odpočtu DPH?' };
export const supplementFields = { photos: 'Fotografie', vin: 'VIN', service_history: 'Servisní historie', damage_description: 'Informace o poškození', additional: 'Jiný údaj' };
export const priceFields = { buy_estimate: 'Návrh výkupní ceny od', buy_estimate_max: 'Návrh výkupní ceny do', approved_price: 'Schválená nabídka od / konkrétní cena', approved_price_max: 'Schválená nabídka do (nepovinné)', sale_estimate: 'Předpokládaná prodejní cena', preparation_cost: 'Náklady na přípravu' };
export function textValue(value, max = 2000) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
export function validateVehicle(data, contact = false) {
  const errors = [];
  for (const key of ['brand', 'model']) if (!textValue(data[key], 80)) errors.push('Vyplňte značku a model.');
  if (!textValue(data.spz, 24) || /[<>]/.test(data.spz) || [...String(data.spz||'')].some(c=>c.charCodeAt(0)<32)) errors.push('Vyplňte registrační značku (nejvýše 24 znaků).');
  if (String(data.spz || '').length > 24) errors.push('SPZ je příliš dlouhá.');
  if (!/^[A-HJ-NPR-Z0-9]{17}$/i.test(String(data.vin || '').trim())) errors.push('VIN musí mít 17 znaků bez I, O a Q; případně jej nechte prázdný.');
  if (data.year !== '' && data.year != null && (!Number.isInteger(Number(data.year)) || Number(data.year) < 1886 || Number(data.year) > new Date().getFullYear() + 1)) errors.push('Zkontrolujte rok první registrace.');
  if (data.km !== '' && data.km != null && (!Number.isInteger(Number(data.km)) || Number(data.km) < 0 || Number(data.km) > 5000000)) errors.push('Zkontrolujte nájezd kilometrů.');
  if (data.customer_expected_price !== '' && data.customer_expected_price != null && (!Number.isFinite(Number(data.customer_expected_price)) || Number(data.customer_expected_price) < 0 || Number(data.customer_expected_price) > 100000000)) errors.push('Zkontrolujte cenovou představu.');
  if (contact) {
    if (!textValue(data.full_name, 150)) errors.push('Vyplňte jméno a příjmení.');
    if (!/^\+?[\d\s()-]{7,25}$/.test(data.phone || '') || (data.phone.match(/\d/g) || []).length < 7) errors.push('Zkontrolujte telefon.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || '') || data.email.length > 254) errors.push('Zkontrolujte e-mail.');
    if (!['phone', 'email'].includes(data.preferred_contact)) errors.push('Vyberte preferovaný kontakt.');
  }
  return [...new Set(errors)];
}
export function cleanSubmission(input) {
  const result = {};
  const strings = ['spz','vin','brand','model','fuel','engine','transmission','drive','owner','last_service','full_name','phone','email','preferred_contact','equipment_description','additional','accident_description','damage_description','faults_description'];
  for (const key of strings) result[key] = textValue(input[key], ['equipment_description','additional','accident_description','damage_description','faults_description'].includes(key) ? 2000 : 254);
  result.vin = result.vin.toUpperCase();
  for (const key of ['year','km','customer_expected_price']) result[key] = input[key] === '' || input[key] == null ? null : Number(input[key]);
  for (const key of Object.keys(questions)) result[key] = ['yes','no','unknown'].includes(input[key]) ? input[key] : 'unknown';
  result.marketing_consent = input.marketing_consent === true;
  result.privacy_version = '2026-10-27';
  return result;
}
export function cleanPricing(input) {
  const result = { comment: textValue(input.comment, 4000) };
  for (const key of Object.keys(priceFields)) {
    const value = input[key];
    result[key] = value === '' || value == null ? null : Number(value);
    if (result[key] !== null && (!Number.isFinite(result[key]) || result[key] < 0 || result[key] > 100000000)) throw new Error('Neplatná cena.');
  }
  for (const key of ['buy_estimate', 'approved_price']) if (result[key + '_max'] !== null && (result[key] === null || result[key + '_max'] < result[key])) throw new Error('Horní hranice musí být vyšší nebo stejná jako dolní.');
  return result;
}
export function approvedOffer(pricing, body) {
  const p = cleanPricing(pricing);
  if (p.approved_price === null) throw new Error('Nejprve uložte schválenou nabídku.');
  if (!textValue(body, 10000)) throw new Error('Vyplňte text nabídky.');
  // Deliberate allowlist: no internal calculations can enter the public DTO.
  return { min: p.approved_price, max: p.approved_price_max, body: textValue(body, 10000) };
}
export function priceLabel(min, max) { return min == null ? 'Neuvedeno' : `${Number(min).toLocaleString('cs-CZ')}${max != null && Number(max) !== Number(min) ? '–' + Number(max).toLocaleString('cs-CZ') : ''} Kč`; }
export function offerText(data, pricing, signature) { return `Dobrý den,\n\nděkujeme Vám za zaslání informací a fotografií Vašeho vozidla ${data.brand} ${data.model}.\n\nNa základě dodaných podkladů stanovujeme orientační výkupní cenu na ${priceLabel(pricing.approved_price, pricing.approved_price_max)}.\n\nJedná se o předběžnou nabídku. Konečná výkupní cena bude potvrzena po osobní prohlídce vozidla a případné technické kontrole.\n\nV případě zájmu se s Vámi rádi domluvíme na termínu prohlídky. Reakce na tuto nabídku nepředstavuje uzavření kupní smlouvy.\n\nDěkujeme a přejeme pěkný den.\n${signature}`; }
