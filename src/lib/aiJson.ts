export function extractJsonValue(raw: string) {
  const s = String(raw || "").trim();
  if (!s) return null;

  const tryParse = (from: number, to: number) => {
    if (from < 0 || to <= from) return null;
    try {
      return JSON.parse(s.slice(from, to + 1)) as unknown;
    } catch {
      return null;
    }
  };

  const objStart = s.indexOf("{");
  const objEnd = s.lastIndexOf("}");
  const arrStart = s.indexOf("[");
  const arrEnd = s.lastIndexOf("]");

  if (objStart >= 0 && objEnd > objStart) {
    const parsed = tryParse(objStart, objEnd);
    if (parsed !== null) return parsed;
  }

  if (arrStart >= 0 && arrEnd > arrStart) {
    const parsed = tryParse(arrStart, arrEnd);
    if (parsed !== null) return parsed;
  }

  try {
    return JSON.parse(s) as unknown;
  } catch {
    return null;
  }
}

