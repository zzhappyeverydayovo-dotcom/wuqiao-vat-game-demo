// Use load/error events so startup never depends on Image.decode() settling.
export function loadImage(source, options = {}) {
  const ImageCtor = options.ImageCtor || Image;
  const timeoutMs = options.timeoutMs ?? 12000;
  return new Promise((resolve, reject) => {
    const image = new ImageCtor();
    let settled = false;
    const finish = error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      if (error) {
        image.src = '';
        reject(error);
      } else resolve(image);
    };
    const timer = setTimeout(() => finish(new Error('image-timeout')), timeoutMs);
    image.onload = () => finish(image.naturalWidth > 0 ? null : new Error('image-empty'));
    image.onerror = () => finish(new Error('image-error'));
    image.decoding = 'async';
    image.src = source;
    if (image.complete && image.naturalWidth > 0) finish();
  });
}

export async function loadImageCandidates(sources, options = {}) {
  let lastError;
  for (const source of sources.filter(Boolean)) {
    try { return await loadImage(source, options); }
    catch (error) { lastError = error; }
  }
  throw lastError || new Error('image-source-missing');
}
