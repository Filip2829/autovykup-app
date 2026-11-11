export function pointInSurface(points, x, y) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function validateCleanupPlan(value) {
  if (value?.status === 'none' && Number.isFinite(value.confidence) && value.confidence >= .98 && value.confidence <= 1 && Array.isArray(value.regions) && !value.regions.length) return [];
  if (value?.status !== 'located' || !Number.isFinite(value.confidence) || value.confidence < .98 || value.confidence > 1 || !Array.isArray(value.regions) || !value.regions.length || value.regions.length > 12) throw new Error('Nečistoty interiéru se nepodařilo bezpečně odlišit od opotřebení.');
  const polygon = points => {
    if (!Array.isArray(points) || points.length < 3 || points.length > 32 || points.some(p => !Number.isFinite(p?.x) || !Number.isFinite(p?.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1)) throw new Error('Neplatná oblast čištění interiéru.');
    const area = Math.abs(points.reduce((sum, p, i) => { const q = points[(i + 1) % points.length]; return sum + p.x * q.y - q.x * p.y; }, 0)) / 2;
    if (area < .000001 || area > .55) throw new Error('Neplatný rozsah čištění interiéru.');
    return points;
  };
  const regions = value.regions.map(region => {
    if (!['specks', 'surface_film'].includes(region.method) || !Array.isArray(region.protect) || region.protect.length > 40) throw new Error('Neplatný plán čištění interiéru.');
    return { polygon: polygon(region.polygon), protect: region.protect.map(polygon), method: region.method, reference: polygon(region.reference) };
  });
  const totalArea = regions.reduce((sum, region) => sum + Math.abs(region.polygon.reduce((n, p, i) => { const q = region.polygon[(i + 1) % region.polygon.length]; return n + p.x * q.y - q.x * p.y; }, 0)) / 2, 0);
  if (totalArea > .65) throw new Error('Příliš rozsáhlá oblast čištění interiéru.');
  return regions;
}

const median = values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];

// Local photographic cleanup only. No generated textures, labels or controls.
export function cleanLooseInteriorDirt(image, regions) {
  const { width, height } = image, source = image.data, result = new Uint8Array(source);
  if (source.length !== width * height * 4 || width * height > 4000000) throw new Error('Neplatný podklad čištění interiéru.');
  for (const region of regions) {
    const samples = [[], [], []];
    const referenceLeft = Math.max(0, Math.floor(Math.min(...region.reference.map(p => p.x)) * width));
    const referenceTop = Math.max(0, Math.floor(Math.min(...region.reference.map(p => p.y)) * height));
    const referenceRight = Math.min(width, Math.ceil(Math.max(...region.reference.map(p => p.x)) * width));
    const referenceBottom = Math.min(height, Math.ceil(Math.max(...region.reference.map(p => p.y)) * height));
    for (let y = referenceTop; y < referenceBottom; y += 2) for (let x = referenceLeft; x < referenceRight; x += 2) {
      if (!pointInSurface(region.reference, (x + .5) / width, (y + .5) / height)) continue;
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) samples[c].push(source[i + c]);
    }
    if (samples[0].length < 4) throw new Error('Chybí čistá referenční plocha interiéru.');
    const reference = samples.map(median), radius = region.method === 'surface_film' ? Math.max(3, Math.round(Math.max(width, height) / 200)) : 2;
    const left = Math.max(radius, Math.floor(Math.min(...region.polygon.map(p => p.x)) * width));
    const right = Math.min(width - radius, Math.ceil(Math.max(...region.polygon.map(p => p.x)) * width));
    const top = Math.max(radius, Math.floor(Math.min(...region.polygon.map(p => p.y)) * height));
    const bottom = Math.min(height - radius, Math.ceil(Math.max(...region.polygon.map(p => p.y)) * height));
    if (right <= left || bottom <= top) continue;
    if (region.method === 'surface_film') {
      const stride = right - left + radius * 2 + 1, rows = bottom - top + radius * 2 + 1;
      const integral = new Float64Array(stride * rows), active = new Uint8Array((right - left) * (bottom - top));
      for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
        const nx = (x + .5) / width, ny = (y + .5) / height;
        if (pointInSurface(region.polygon, nx, ny) && !region.protect.some(p => pointInSurface(p, nx, ny))) active[(y - top) * (right - left) + x - left] = 1;
      }
      const blend = Uint8Array.from(active, value => value ? 255 : 0);
      let inset = new Uint8Array(active);
      const regionWidth = right - left, regionHeight = bottom - top;
      for (let pass = 1; pass <= 3; pass++) {
        const next = new Uint8Array(inset.length);
        for (let y = 0; y < regionHeight; y++) for (let x = 0; x < regionWidth; x++) {
          const i = y * regionWidth + x;
          if (!inset[i]) continue;
          if (x && y && x < regionWidth - 1 && y < regionHeight - 1 && inset[i - 1] && inset[i + 1] && inset[i - regionWidth] && inset[i + regionWidth]) next[i] = 1;
          else blend[i] = Math.round(pass * 255 / 4);
        }
        inset = next;
      }
      for (let c = 0; c < 3; c++) {
        integral.fill(0);
        for (let y = 1; y < rows; y++) {
          let sum = 0;
          for (let x = 1; x < stride; x++) {
            sum += source[((top - radius + y - 1) * width + left - radius + x - 1) * 4 + c];
            integral[y * stride + x] = integral[(y - 1) * stride + x] + sum;
          }
        }
        for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
          if (!active[(y - top) * (right - left) + x - left]) continue;
          const x0 = x - left, y0 = y - top, x1 = x0 + radius * 2 + 1, y1 = y0 + radius * 2 + 1;
          const low = (integral[y1 * stride + x1] - integral[y0 * stride + x1] - integral[y1 * stride + x0] + integral[y0 * stride + x0]) / ((radius * 2 + 1) ** 2);
          const i = (y * width + x) * 4 + c;
          if (source[i] < low - 35) continue; // retain dark scratches and deep grooves
          const correction = Math.min(65, Math.max(0, low - reference[c] - 3)) * .85 * blend[(y - top) * regionWidth + x - left] / 255;
          result[i] = Math.max(0, Math.round(source[i] - correction));
        }
      }
      continue;
    }
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
      const nx = (x + .5) / width, ny = (y + .5) / height;
      if (!pointInSurface(region.polygon, nx, ny) || region.protect.some(p => pointInSurface(p, nx, ny))) continue;
      const i = (y * width + x) * 4, nearby = [[], [], []];
      const neighbourhood = [0, 0, 0];
      for (const dy of [-radius, 0, radius]) for (const dx of [-radius, 0, radius]) {
        if (!dx && !dy) continue;
        const j = ((y + dy) * width + x + dx) * 4;
        for (let c = 0; c < 3; c++) neighbourhood[c] += source[j + c];
      }
      // Most original texture pixels need no filtering. Run a median only for
      // bright isolated candidates, keeping CPU bounded on full-size photos.
      if (!neighbourhood.every((sum, c) => source[i + c] - sum / 8 > 20)) continue;
      // A sparse local median retains original grain/groove residuals beneath a
      // broad dust film. Small isolated bright dust uses a 5x5 neighbourhood.
      const step = 1;
      for (let dy = -radius; dy <= radius; dy += step) for (let dx = -radius; dx <= radius; dx += step) {
        const j = ((y + dy) * width + x + dx) * 4;
        for (let c = 0; c < 3; c++) nearby[c].push(source[j + c]);
      }
      const low = nearby.map(median);
      // Only isolated light deposits, never dark scratches or discoloration.
      if (low.every((value, c) => source[i + c] - value > 24)) for (let c = 0; c < 3; c++) result[i + c] = low[c];
    }
  }
  return { ...image, data: result };
}
