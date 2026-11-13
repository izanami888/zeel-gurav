// Зурвасыг 1080x1920 (Instagram Story) зураг болгож хөтөч дээр (canvas) зурна.
// Сервер рүү юу ч илгээхгүй тул зурвасын агуулга нууц хэвээр үлдэнэ.

const W = 1080;
const H = 1920;
const FONT = '"Segoe UI", system-ui, -apple-system, "Noto Sans", sans-serif';

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      let rest = word;
      // Мөрөнд багтахгүй урт үгийг тэмдэгтээр нь таслана.
      while (ctx.measureText(rest).width > maxWidth) {
        let cut = rest.length - 1;
        while (cut > 1 && ctx.measureText(rest.slice(0, cut)).width > maxWidth) cut--;
        if (line) lines.push(line);
        line = "";
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      const candidate = line ? `${line} ${rest}` : rest;
      if (ctx.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = rest;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
}

export interface StoryImageParams {
  prompt: string;
  message: string;
  /** Жишээ: "playboard.mn/u/bat" */
  link: string;
}

export async function renderStoryImage({ prompt, message, link }: StoryImageParams): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0B1F3A");
  bg.addColorStop(0.55, "#13315C");
  bg.addColorStop(1, "#0B1F3A");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const cardX = 90;
  const cardW = W - cardX * 2;
  const pad = 56;
  const textW = cardW - pad * 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  // Толгой (асуулт) болон биеийн (зурвас) мөрүүдийг хэмжинэ.
  ctx.font = `700 44px ${FONT}`;
  const promptLines = wrap(ctx, prompt, textW);
  const promptLH = 58;
  const headH = pad * 2 + promptLines.length * promptLH;

  let size = 60;
  let bodyLines: string[] = [];
  let bodyLH = 0;
  // Урт зурвас картанд багтах хүртэл үсгийн хэмжээг багасгана.
  for (; size >= 30; size -= 4) {
    ctx.font = `600 ${size}px ${FONT}`;
    bodyLines = wrap(ctx, message, textW);
    bodyLH = Math.round(size * 1.3);
    if (bodyLines.length * bodyLH <= 1050) break;
  }
  const bodyH = pad * 2 + bodyLines.length * bodyLH;

  const cardH = headH + bodyH;
  const cardY = Math.round((H - cardH) / 2);

  // Карт
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, 48);
  ctx.clip();
  const head = ctx.createLinearGradient(cardX, 0, cardX + cardW, 0);
  head.addColorStop(0, "#D4AF37");
  head.addColorStop(1, "#F1D57A");
  ctx.fillStyle = head;
  ctx.fillRect(cardX, cardY, cardW, headH);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(cardX, cardY + headH, cardW, bodyH);
  ctx.restore();

  ctx.fillStyle = "#0B1F3A";
  ctx.font = `700 44px ${FONT}`;
  promptLines.forEach((line, i) =>
    ctx.fillText(line, W / 2, cardY + pad + i * promptLH)
  );

  ctx.font = `600 ${size}px ${FONT}`;
  bodyLines.forEach((line, i) =>
    ctx.fillText(line, W / 2, cardY + headH + pad + i * bodyLH)
  );

  // Доод хэсэг: линк
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = `500 34px ${FONT}`;
  ctx.fillText("Надад нууцаар зурвас илгээ 👇", W / 2, H - 230);
  ctx.fillStyle = "#F1D57A";
  ctx.font = `700 40px ${FONT}`;
  ctx.fillText(link, W / 2, H - 170);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas"))), "image/png")
  );
}

/** Share sheet-ээр хуваалцана; дэмжигдэхгүй бол зургийг татна. */
export async function shareOrDownload(blob: Blob, fileName: string): Promise<void> {
  const file = new File([blob], fileName, { type: "image/png" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // цуцалсан
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
