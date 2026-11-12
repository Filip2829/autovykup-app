export function vehiclePlacement(mask, width, height) {
  if (mask.length !== width * height) throw new Error('Rozměry masky nesouhlasí.');
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (mask[y * width + x]) {
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  if (right < left) throw new Error('Chybí obrys vozu.');
  const scale = Math.min(width * .86 / (right - left + 1), height * .64 / (bottom - top + 1), 1);
  // Uniform scale only. Reserve the upper wall for the sign and seat the lower
  // silhouette on the floor; source camera perspective never changes.
  return { scale, offsetX: width * .5 - (left + right + 1) * .5 * scale, offsetY: height * .89 - (bottom + 1) * scale, bounds: { left, top, right, bottom } };
}

export function placeOriginalVehicle(source, mask, width, height) {
  const placement = vehiclePlacement(mask, width, height), { scale, offsetX, offsetY } = placement;
  const pixels = new Uint8Array(width * height * 4), placedMask = new Uint8Array(width * height), profile = new Int32Array(width).fill(-1);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sx = Math.floor((x + .5 - offsetX) / scale), sy = Math.floor((y + .5 - offsetY) / scale);
    if (sx < 0 || sy < 0 || sx >= width || sy >= height || !mask[sy * width + sx]) continue;
    const target = y * width + x, index = sy * width + sx;
    pixels.set(source.subarray(index * 4, index * 4 + 4), target * 4);
    placedMask[target] = 255; profile[x] = y;
  }
  return { pixels, mask: placedMask, profile, placement };
}

export function floorContactShadow(background, profile, width, height) {
  const result = new Uint8Array(background), radiusY = Math.max(2, height * .015), radiusX = Math.max(2, Math.round(width * .012));
  // Follow the actual lower silhouette, including unequal tyre heights in 3/4
  // views, instead of drawing one floating oval under every camera angle.
  const shadow = new Float32Array(width * height);
  for (let x = 0; x < width; x++) {
    const floor = profile[x];
    if (floor < height * .42) continue;
    for (let y = Math.max(0, Math.floor(floor - radiusY)); y < Math.min(height, floor + radiusY * 4); y++) {
      const dy = y - floor;
      shadow[y * width + x] = .48 * Math.exp(-((dy - radiusY * .2) ** 2) / (2 * radiusY ** 2)) + .12 * Math.exp(-(dy ** 2) / (8 * radiusY ** 2));
    }
  }
  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = -radiusX; x < width + radiusX; x++) {
      if (x + radiusX < width && x + radiusX >= 0) sum += shadow[y * width + x + radiusX];
      if (x - radiusX - 1 >= 0 && x - radiusX - 1 < width) sum -= shadow[y * width + x - radiusX - 1];
      if (x < 0 || x >= width) continue;
      const strength = sum / (radiusX * 2 + 1), i = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel++) result[i + channel] = Math.round(background[i + channel] * (1 - strength));
    }
  }
  return result;
}
