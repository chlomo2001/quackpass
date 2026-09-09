// Minimal PDF writer: one full-page image per page, losslessly compressed.
// Lossless matters here — JPEG artefacts on an Aztec code can stop it scanning.

const A4_POINTS = { width: 595.28, height: 841.89 };

function latin1(text) {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0xff;
  return bytes;
}

// Canvas -> deflated RGB, the shape a /FlateDecode image XObject wants.
export async function encodePdfPage(canvas) {
  const ctx = canvas.getContext("2d");
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    rgb[j] = data[i];
    rgb[j + 1] = data[i + 1];
    rgb[j + 2] = data[i + 2];
  }

  const stream = new Blob([rgb]).stream().pipeThrough(new CompressionStream("deflate"));
  return { data: new Uint8Array(await new Response(stream).arrayBuffer()), width, height };
}

export function buildPdf(pages) {
  const chunks = [];
  const offsets = [];
  let length = 0;

  const push = (chunk) => {
    const bytes = typeof chunk === "string" ? latin1(chunk) : chunk;
    chunks.push(bytes);
    length += bytes.length;
  };

  const openObject = (id) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
  };

  push("%PDF-1.4\n");
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // marks the file binary

  openObject(1);
  push("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(" ");
  openObject(2);
  push(`<< /Type /Pages /Kids [ ${kids} ] /Count ${pages.length} >>\nendobj\n`);

  pages.forEach((page, i) => {
    const pageId = 3 + i * 3;
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const content = `q ${A4_POINTS.width} 0 0 ${A4_POINTS.height} 0 0 cm /Im0 Do Q\n`;

    openObject(pageId);
    push(
      `<< /Type /Page /Parent 2 0 R ` +
        `/MediaBox [0 0 ${A4_POINTS.width} ${A4_POINTS.height}] ` +
        `/Resources << /XObject << /Im0 ${imageId} 0 R >> >> ` +
        `/Contents ${contentId} 0 R >>\nendobj\n`
    );

    openObject(contentId);
    push(`<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`);

    openObject(imageId);
    push(
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode ` +
        `/Length ${page.data.length} >>\nstream\n`
    );
    push(page.data);
    push("\nendstream\nendobj\n");
  });

  const size = 3 + pages.length * 3; // object ids 1..(3N+2), plus the free entry
  const xrefOffset = length;

  push(`xref\n0 ${size}\n0000000000 65535 f \n`);
  for (let id = 1; id < size; id++) {
    push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let pos = 0;
  for (const chunk of chunks) {
    out.set(chunk, pos);
    pos += chunk.length;
  }
  return out;
}
