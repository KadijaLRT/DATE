// Optional profile photos. They are shrunk on this device and stored as small JPEGs inside the same private
// browser storage as everything else. Nothing is uploaded anywhere.
export const MAX_PHOTO_CHARS = 150000 // about 110 KB of image
const PHOTO_RE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/

export function cleanPhoto(x) {
  return typeof x === 'string' && x.length <= MAX_PHOTO_CHARS && PHOTO_RE.test(x) ? x : ''
}

// "Alex Rivera" -> "AR", "alex" -> "A", "" -> "?"
export function initialsOf(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const first = Array.from(words[0])[0]
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] : ''
  return (first + last).toUpperCase()
}

async function loadBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file) } catch { /* fall through to <img> */ }
  }
  const url = URL.createObjectURL(file)
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('That file could not be read as an image.'))
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Browser only. Returns a JPEG data URL no larger than MAX_PHOTO_CHARS, or throws an error whose message can be shown as is.
export async function fileToPhoto(file, maxSide = 560) {
  if (!file || !/^image\//.test(file.type || '')) throw new Error('Choose an image file (a photo).')
  if (file.size > 20 * 1024 * 1024) throw new Error('That image is over 20 MB. Choose a smaller one.')
  const bmp = await loadBitmap(file)
  const w0 = bmp.width || bmp.naturalWidth
  const h0 = bmp.height || bmp.naturalHeight
  if (!w0 || !h0) throw new Error('That file could not be read as an image.')
  let side = maxSide
  for (let attempt = 0; attempt < 6; attempt++) {
    const scale = Math.min(1, side / Math.max(w0, h0))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(w0 * scale))
    canvas.height = Math.max(1, Math.round(h0 * scale))
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff' // transparent PNGs become white instead of black
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    for (const q of [0.82, 0.7, 0.58, 0.46]) {
      const url = canvas.toDataURL('image/jpeg', q)
      if (url.length <= MAX_PHOTO_CHARS) { bmp.close?.(); return url }
    }
    side = Math.round(side * 0.75)
  }
  bmp.close?.()
  throw new Error('Could not shrink that image enough. Try a smaller one.')
}
