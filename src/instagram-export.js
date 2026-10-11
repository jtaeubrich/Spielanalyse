// Minimal dependency-free ZIP writer (stored entries, CRC32, UTF-8 names).
const encoder = new TextEncoder();
const u16 = n => [n & 255, (n >>> 8) & 255];
const u32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
const concat = parts => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let offset = 0; for (const p of parts) {out.set(p, offset); offset += p.length;} return out; };
export function crc32(bytes) { let crc = 0xffffffff; for (const b of bytes) { crc ^= b; for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (-(crc & 1) & 0xedb88320); } return (crc ^ 0xffffffff) >>> 0; }
export async function makeInstagramZip(files) {
  if (!Array.isArray(files) || !files.length) throw Error("Keine Dateien zum Exportieren.");
  const local = [], central = []; let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name), body = new Uint8Array(await file.blob.arrayBuffer()), crc = crc32(body);
    if (name.length > 65535 || body.length > 0xffffffff) throw Error("Datei für ZIP zu groß.");
    const header = Uint8Array.from([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(body.length), ...u32(body.length), ...u16(name.length), ...u16(0)]);
    local.push(header, name, body);
    central.push(Uint8Array.from([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(body.length), ...u32(body.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]), name);
    offset += header.length + name.length + body.length;
  }
  if (files.length > 65535) throw Error("Zu viele Dateien.");
  const directory = concat(central), end = Uint8Array.from([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(directory.length), ...u32(offset), ...u16(0)]);
  return new Blob([...local, directory, end], {type: "application/zip"});
}
export function chronologicalHighlights(entries) {
  return [...entries].filter(item => item.event?.highlight === true)
    .sort((a,b) => Number(a.event?.time ?? 0) - Number(b.event?.time ?? 0) || a.index-b.index);
}
export function instagramMp4Type(isSupported) {
  for (const mime of ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc1.42E01E", "video/mp4"]) if (isSupported(mime)) return mime;
  throw Error("Dieser Browser kann kein MP4 aufnehmen. Instagram-ZIP bitte auf einem MP4-fähigen Browser exportieren.");
}
