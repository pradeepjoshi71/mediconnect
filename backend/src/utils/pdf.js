function escapePdfText(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r/g, " ")
    .replace(/\n/g, " ");
}

function wrapText(lines, maxLength = 88) {
  const wrapped = [];

  for (const line of lines) {
    const text = String(line ?? "").trim();
    if (!text) {
      wrapped.push("");
      continue;
    }

    let remaining = text;
    while (remaining.length > maxLength) {
      let sliceAt = remaining.lastIndexOf(" ", maxLength);
      if (sliceAt <= 0) sliceAt = maxLength;
      wrapped.push(remaining.slice(0, sliceAt).trim());
      remaining = remaining.slice(sliceAt).trim();
    }
    wrapped.push(remaining);
  }

  return wrapped;
}

function buildPdfBuffer({ title, subtitle, sections = [] }) {
  const lines = wrapText([
    title,
    subtitle || "",
    "",
    ...sections.flatMap((section) => [section.heading, ...section.lines, ""]),
  ]);

  let y = 785;
  const commands = ["BT", "/F1 11 Tf"];

  for (const line of lines) {
    if (y < 60) break;
    const size = y > 760 ? 16 : line === title ? 16 : 11;
    commands.push(`/F1 ${size} Tf`);
    commands.push(`1 0 0 1 50 ${y} Tm (${escapePdfText(line)}) Tj`);
    y -= size > 11 ? 22 : 16;
  }

  commands.push("ET");
  const contentStream = commands.join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(contentStream, "utf8")} >>\nstream\n${contentStream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

module.exports = { buildPdfBuffer };
