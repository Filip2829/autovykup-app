// Keep opaque source pixels, including enclosed glass and small edge details.
// The model supplies only a mask; it never supplies vehicle colors or geometry.
export function protectSubjectMask(values, width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 4000000 || values.length !== width * height) throw new Error('Neplatná maska vozu.');
  const size = width * height, mask = new Uint8Array(size);
  for (let i = 0; i < size; i++) mask[i] = values[i] >= 32 ? 1 : 0;
  const outside = new Uint8Array(size), queue = new Int32Array(size); let start = 0, end = 0;
  const visit = i => { if (!mask[i] && !outside[i]) { outside[i] = 1; queue[end++] = i; } };
  for (let x = 0; x < width; x++) { visit(x); visit((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { visit(y * width); visit(y * width + width - 1); }
  while (start < end) {
    const i = queue[start++], x = i % width;
    if (x) visit(i - 1); if (x < width - 1) visit(i + 1);
    if (i >= width) visit(i - width); if (i < size - width) visit(i + width);
  }
  for (let i = 0; i < size; i++) if (!outside[i]) mask[i] = 1;
  // A small conservative margin avoids cutting away mirrors/paint at soft edges.
  const expanded = new Uint8Array(size);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!mask[y * width + x]) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && xx < width && yy >= 0 && yy < height) expanded[yy * width + xx] = 255;
    }
  }
  const area = expanded.reduce((sum, value) => sum + (value ? 1 : 0), 0) / size;
  if (area < .03 || area > .95) throw new Error('Vůz se nepodařilo spolehlivě oddělit od pozadí. Originál zůstal zachovaný.');
  return expanded;
}

export function compositeSourcePixels(source, background, mask) {
  if (source.length !== background.length || source.length !== mask.length * 4) throw new Error('Rozměry fotografie a masky nesouhlasí.');
  const result = new Uint8Array(background);
  for (let i = 0; i < mask.length; i++) if (mask[i]) {
    result.set(source.subarray(i * 4, i * 4 + 4), i * 4);
  }
  return result;
}
