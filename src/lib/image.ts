const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const MAX_SIDE = 256;

function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image illisible."));
    };
    image.src = url;
  });
}

/**
 * Turns any image the operator picks (PNG, JPEG, WebP, SVG…) into a small WebP that fits in a
 * 256 px square, transparency kept. Logos stay light to store and to serve.
 */
export async function toLogoBlob(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("choisissez une image.");
  if (file.size > MAX_INPUT_BYTES) throw new Error("image trop lourde (5 Mo au plus).");
  const image = await loadImage(file);
  // SVGs without intrinsic size report 0: draw them at full size.
  const width = image.naturalWidth || MAX_SIDE;
  const height = image.naturalHeight || MAX_SIDE;
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("conversion de l'image impossible.");
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.9),
  );
  if (!blob) throw new Error("conversion de l'image impossible.");
  return blob;
}
