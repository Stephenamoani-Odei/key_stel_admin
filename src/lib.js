export const money = (n) => 'GH₵ ' + Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const dt = (d, o) => new Date(d).toLocaleDateString('en-US', o)
export const dateTime = (d) => `${dt(d, { month: 'short', day: 'numeric', year: 'numeric' })}, ${new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
export const statuses = ['Pending', 'Dispatched', 'Delivered']
export function downloadCSV(name, rows) {
  const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
  const blob = new Blob(['\ufeff' + rows.map((r) => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href)
}
// Shrinks big phone photos before upload so the storefront loads fast.
export async function resizeImage(file, max = 1200) {
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale)
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85))
    return blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file
  } catch { return file }
}
export const digits = (p) => (p || '').replace(/\D/g, '')
export const waLink = (p) => { let d = digits(p); if (d.startsWith('0')) d = '233' + d.slice(1); return d ? `https://wa.me/${d}` : null }
