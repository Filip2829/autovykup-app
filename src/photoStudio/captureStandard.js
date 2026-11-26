export const captureRatio = 4 / 3;

export const opportunityShots = {
  frontLeft: { title: 'Titulní · zepředu zleva', guide: 'Stůjte přibližně pod úhlem 45° u levého předního rohu. V záběru nechte celé čelo i levý bok.', width: .74 },
  front: { title: 'Přímo zepředu', guide: 'Postavte se proti středu vozu. Oba světlomety a zrcátka mají být stejně daleko od středové osy.', width: .54 },
  frontRight: { title: 'Zepředu zprava', guide: 'Zopakujte titulní pohled od pravého předního rohu, ve stejné výšce a vzdálenosti.', width: .74 },
  right: { title: 'Pravý bok', guide: 'Stůjte kolmo ke středu pravého boku. Vyrovnejte kola do jedné vodorovné linie.', width: .82 },
  rearRight: { title: 'Zezadu zprava', guide: 'Stůjte šikmo u pravého zadního rohu. V záběru nechte celou záď i pravý bok.', width: .74 },
  rear: { title: 'Přímo zezadu', guide: 'Postavte se proti středu zádi. Srovnejte obě zadní světla podle vodorovné linie.', width: .54 },
  rearLeft: { title: 'Zezadu zleva', guide: 'Zopakujte zadní šikmý pohled od levého zadního rohu.', width: .74 },
  left: { title: 'Levý bok', guide: 'Stůjte kolmo ke středu levého boku. Vyrovnejte kola do jedné vodorovné linie.', width: .82 },
  dashboard: { title: 'Palubní deska', guide: 'Foťte ze středu zadní řady dopředu. Volant vlevo, displej a středová konzola uprostřed, obě strany palubní desky v záběru.' },
  frontSeats: { title: 'Přední sedadla', guide: 'Foťte šikmo od otevřených dveří řidiče. Zachyťte obě opěrky a většinu obou sedáků.' },
  rearSeats: { title: 'Zadní sedadla', guide: 'Foťte od otevřených levých zadních dveří. Zachyťte zadní lavici, opěrky a pásy.' },
  console: { title: 'Středová konzola', guide: 'Z přední řady namiřte mírně shora na středovou konzolu. Zachyťte řazení a okolní ovladače.' },
};

export const isOpportunityShot = angle => Object.hasOwn(opportunityShots, angle);
export const isInteriorShot = angle => angle === 'interior' || (isOpportunityShot(angle) && !opportunityShots[angle].width);

export function centerCaptureCrop(width, height) {
  const cropWidth = Math.min(width, height * captureRatio);
  const cropHeight = cropWidth / captureRatio;
  return { x: (width - cropWidth) / 2, y: (height - cropHeight) / 2, width: cropWidth, height: cropHeight };
}

export function nextOpportunityShot(angle, items) {
  const shots = Object.keys(opportunityShots);
  const start = shots.indexOf(angle) + 1;
  return [...shots.slice(start), ...shots.slice(0, start)].find(shot => !items.some(item => item.angle === shot && item.opportunityCapture));
}

export function orderOpportunityPhotos(items) {
  const shots = Object.keys(opportunityShots);
  const position = item => item.opportunityCapture ? shots.indexOf(item.angle) : shots.length;
  return [...items].sort((a, b) => position(a) - position(b));
}
