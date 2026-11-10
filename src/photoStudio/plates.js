// Coordinates are normalized to the image, clockwise from the plate's top left.
export function validatePlates(plates) {
  if (!Array.isArray(plates) || plates.length > 5) throw new Error('Neplatné označení SPZ.');
  return plates.map(quad => {
    if (!Array.isArray(quad) || quad.length !== 4 || quad.some(p => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1)) throw new Error('Označte čtyři rohy celé SPZ.');
    let area = 0;
    for (let i = 0; i < 4; i++) {
      const a = quad[i], b = quad[(i + 1) % 4], c = quad[(i + 2) % 4];
      if ((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) <= 0) throw new Error('Rohy označte postupně po obvodu: levý horní, pravý horní, pravý dolní, levý dolní.');
      area += a.x * b.y - b.x * a.y;
    }
    if (area / 2 < 0.000005 || area / 2 > 0.2) throw new Error('Označení SPZ je příliš malé nebo velké.');
    return quad.map(({ x, y }) => ({ x, y }));
  });
}

// Solve the projective transform from a plate quadrilateral to a unit rectangle.
function inverseProjection(quad) {
  const rows = [];
  quad.forEach(({ x, y }, i) => {
    const u = [0, 1, 1, 0][i], v = [0, 0, 1, 1][i];
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    rows.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  });
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let r = col + 1; r < 8; r++) if (Math.abs(rows[r][col]) > Math.abs(rows[pivot][col])) pivot = r;
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    const divisor = rows[col][col];
    if (Math.abs(divisor) < 1e-12) throw new Error('Nelze určit perspektivu SPZ.');
    for (let j = col; j < 9; j++) rows[col][j] /= divisor;
    for (let r = 0; r < 8; r++) if (r !== col) {
      const factor = rows[r][col];
      for (let j = col; j < 9; j++) rows[r][j] -= factor * rows[col][j];
    }
  }
  return rows.map(r => r[8]);
}

// Opaque logo pixels replace every pixel inside the selected plate. No AI text rendering.
export function paintPlateLogos(image, logo, plates) {
  for (const normalized of validatePlates(plates)) {
    const quad = normalized.map(p => ({ x: p.x * image.width, y: p.y * image.height }));
    const h = inverseProjection(quad);
    const minX = Math.max(0, Math.floor(Math.min(...quad.map(p => p.x))));
    const maxX = Math.min(image.width - 1, Math.ceil(Math.max(...quad.map(p => p.x))));
    const minY = Math.max(0, Math.floor(Math.min(...quad.map(p => p.y))));
    const maxY = Math.min(image.height - 1, Math.ceil(Math.max(...quad.map(p => p.y))));
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const denominator = h[6] * (x + .5) + h[7] * (y + .5) + 1;
      const u = (h[0] * (x + .5) + h[1] * (y + .5) + h[2]) / denominator;
      const v = (h[3] * (x + .5) + h[4] * (y + .5) + h[5]) / denominator;
      if (u < 0 || u > 1 || v < 0 || v > 1) continue;
      const source = (Math.min(logo.height - 1, Math.floor(v * logo.height)) * logo.width + Math.min(logo.width - 1, Math.floor(u * logo.width))) * 4;
      const target = (y * image.width + x) * 4;
      image.data[target] = logo.data[source]; image.data[target + 1] = logo.data[source + 1]; image.data[target + 2] = logo.data[source + 2]; image.data[target + 3] = 255;
    }
  }
  return image;
}
