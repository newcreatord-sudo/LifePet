export async function readAsDataUrl(file: File) {
  const reader = new FileReader();
  return await new Promise<string>((resolve, reject) => {
    reader.onerror = () => reject(new Error("Impossibile leggere file"));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

export async function extractFramesFromVideoFile(file: File, frameCount: number) {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Impossibile leggere il video"));
    });

    const duration = Number(video.duration);
    if (!Number.isFinite(duration) || duration <= 0) throw new Error("Durata video non valida");

    const count = Math.max(1, Math.min(frameCount, 12));
    const times = Array.from({ length: count }, (_, i) => ((i + 1) / (count + 1)) * duration);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Impossibile elaborare video");

    const targetWidth = 768;
    const ratio = video.videoWidth > 0 ? targetWidth / video.videoWidth : 1;
    canvas.width = targetWidth;
    canvas.height = Math.max(1, Math.round(video.videoHeight * ratio));

    const frames: string[] = [];
    for (const t of times) {
      await new Promise<void>((resolve) => {
        video.currentTime = t;
        video.onseeked = () => resolve();
      });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.82));
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}

