export const captureRatio = 4 / 3;

export const opportunityShots = {
  frontLeft: { title: 'Titulní · zepředu zleva', guide: 'Levý přední roh, přibližně 45°. Srovnejte přední kolo a světlomety s obrysem.', width: .74 },
  front: { title: 'Přímo zepředu', guide: 'Proti středu kapoty. Srovnejte oba světlomety a zrcátka podle obrysu.', width: .54 },
  frontRight: { title: 'Zepředu zprava', guide: 'Pravý přední roh, přibližně 45°. Srovnejte přední kolo a světlomety s obrysem.', width: .74 },
  right: { title: 'Pravý bok', guide: 'Kolmo proti pravému boku. Srovnejte středy obou kol se značkami.', width: .82 },
  rearRight: { title: 'Zezadu zprava', guide: 'Pravý zadní roh, přibližně 45°. Srovnejte zadní kolo a světla s obrysem.', width: .74 },
  rear: { title: 'Přímo zezadu', guide: 'Proti středu kufru. Srovnejte zadní světla ve stejné výšce.', width: .54 },
  rearLeft: { title: 'Zezadu zleva', guide: 'Levý zadní roh, přibližně 45°. Srovnejte zadní kolo a světla s obrysem.', width: .74 },
  left: { title: 'Levý bok', guide: 'Kolmo proti levému boku. Srovnejte středy obou kol se značkami.', width: .82 },
  dashboard: { title: 'Palubní deska', guide: 'Ze středu zadní řady. Srovnejte volant vlevo a displej uprostřed.' },
  frontSeats: { title: 'Přední sedadla', guide: 'Od dveří řidiče šikmo dovnitř. Zaberte obě opěrky i sedáky.' },
  rearSeats: { title: 'Zadní sedadla', guide: 'Od levých zadních dveří. Zaberte celou lavici s opěrkami.' },
  console: { title: 'Středová konzola', guide: 'Z přední řady mírně shora. Zarovnejte řazení a ovladače do obrysu.' },
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
