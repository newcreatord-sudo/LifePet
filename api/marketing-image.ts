export const config = { runtime: "edge" };

function hash32(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function iconMarkup(key: string) {
  const stroke = "rgb(255,255,255)";
  const ink = "rgb(15,23,42)";
  const common = `stroke="${stroke}" stroke-opacity="0.92" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" fill="none"`;

  const paw = `
    <g opacity="0.96">
      <circle cx="700" cy="480" r="86" fill="rgb(255,255,255)" fill-opacity="0.92" />
      <circle cx="635" cy="395" r="34" fill="rgb(255,255,255)" fill-opacity="0.88" />
      <circle cx="705" cy="370" r="34" fill="rgb(255,255,255)" fill-opacity="0.88" />
      <circle cx="775" cy="395" r="34" fill="rgb(255,255,255)" fill-opacity="0.88" />
      <circle cx="810" cy="455" r="30" fill="rgb(255,255,255)" fill-opacity="0.86" />
      <circle cx="590" cy="455" r="30" fill="rgb(255,255,255)" fill-opacity="0.86" />
      <circle cx="700" cy="480" r="86" fill="none" stroke="${ink}" stroke-width="14" opacity="0.55" />
    </g>`;

  const heart = `
    <g opacity="0.98">
      <path d="M700 560 C610 500 560 450 560 390 C560 330 610 290 670 300 C700 306 720 326 735 350 C750 326 770 306 800 300 C860 290 910 330 910 390 C910 450 860 500 700 560 Z" fill="rgb(255,255,255)" fill-opacity="0.92"/>
      <path d="M700 560 C610 500 560 450 560 390 C560 330 610 290 670 300 C700 306 720 326 735 350 C750 326 770 306 800 300 C860 290 910 330 910 390 C910 450 860 500 700 560 Z" fill="none" stroke="${ink}" stroke-width="14" opacity="0.45"/>
    </g>`;

  const doc = `
    <g opacity="0.98">
      <rect x="565" y="300" width="270" height="360" rx="34" fill="rgb(255,255,255)" fill-opacity="0.92" />
      <path d="M610 390 H790" ${common} />
      <path d="M610 460 H760" ${common} />
      <path d="M610 530 H740" ${common} />
      <rect x="565" y="300" width="270" height="360" rx="34" fill="none" stroke="${ink}" stroke-width="14" opacity="0.45" />
    </g>`;

  const mapPin = `
    <g opacity="0.98">
      <path d="M700 640 C700 640 520 520 520 410 C520 310 600 230 700 230 C800 230 880 310 880 410 C880 520 700 640 700 640 Z" fill="rgb(255,255,255)" fill-opacity="0.92"/>
      <circle cx="700" cy="410" r="62" fill="rgb(15,23,42)" fill-opacity="0.16"/>
      <path d="M700 640 C700 640 520 520 520 410 C520 310 600 230 700 230 C800 230 880 310 880 410 C880 520 700 640 700 640 Z" fill="none" stroke="${ink}" stroke-width="14" opacity="0.45" />
    </g>`;

  const chat = `
    <g opacity="0.98">
      <path d="M520 360 C520 312 560 272 610 272 H820 C870 272 910 312 910 360 V520 C910 568 870 608 820 608 H710 L630 670 V608 H610 C560 608 520 568 520 520 Z" fill="rgb(255,255,255)" fill-opacity="0.92"/>
      <circle cx="640" cy="440" r="18" fill="rgb(15,23,42)" fill-opacity="0.20"/>
      <circle cx="710" cy="440" r="18" fill="rgb(15,23,42)" fill-opacity="0.20"/>
      <circle cx="780" cy="440" r="18" fill="rgb(15,23,42)" fill-opacity="0.20"/>
      <path d="M520 360 C520 312 560 272 610 272 H820 C870 272 910 312 910 360 V520 C910 568 870 608 820 608 H710 L630 670 V608 H610 C560 608 520 568 520 520 Z" fill="none" stroke="${ink}" stroke-width="14" opacity="0.45"/>
    </g>`;

  const cart = `
    <g opacity="0.98">
      <path d="M520 310 H580 L620 560 H840 L880 390 H620" ${common} />
      <circle cx="690" cy="610" r="28" fill="rgb(255,255,255)" fill-opacity="0.92"/>
      <circle cx="820" cy="610" r="28" fill="rgb(255,255,255)" fill-opacity="0.92"/>
      <circle cx="690" cy="610" r="28" fill="none" stroke="${ink}" stroke-width="12" opacity="0.45"/>
      <circle cx="820" cy="610" r="28" fill="none" stroke="${ink}" stroke-width="12" opacity="0.45"/>
    </g>`;

  const dogFace = `
    <g opacity="0.98">
      <ellipse cx="560" cy="430" rx="90" ry="120" fill="rgb(255,255,255)" fill-opacity="0.86" />
      <ellipse cx="840" cy="430" rx="90" ry="120" fill="rgb(255,255,255)" fill-opacity="0.86" />
      <circle cx="700" cy="460" r="170" fill="rgb(255,255,255)" fill-opacity="0.92" />
      <circle cx="650" cy="430" r="22" fill="rgb(15,23,42)" fill-opacity="0.22"/>
      <circle cx="750" cy="430" r="22" fill="rgb(15,23,42)" fill-opacity="0.22"/>
      <path d="M700 470 C670 470 650 490 650 515 C650 548 680 568 700 568 C720 568 750 548 750 515 C750 490 730 470 700 470 Z" fill="rgb(15,23,42)" fill-opacity="0.20"/>
      <path d="M660 560 C680 590 720 590 740 560" ${common} />
      <circle cx="700" cy="460" r="170" fill="none" stroke="${ink}" stroke-width="14" opacity="0.45" />
    </g>`;

  const spark = `
    <g opacity="0.98">
      <circle cx="700" cy="460" r="170" fill="rgb(255,255,255)" fill-opacity="0.90" />
      <path d="M700 310 L730 410 L830 440 L730 470 L700 610 L670 470 L570 440 L670 410 Z" fill="rgb(255,255,255)" fill-opacity="0.98" />
      <path d="M700 310 L730 410 L830 440 L730 470 L700 610 L670 470 L570 440 L670 410 Z" fill="none" stroke="${ink}" stroke-width="14" opacity="0.40" />
      <circle cx="700" cy="460" r="170" fill="none" stroke="${ink}" stroke-width="14" opacity="0.45" />
    </g>`;

  const k = key.toLowerCase();
  if (/(health|dashboard|vaccin|medic|pill)/.test(k)) return heart;
  if (/(documents|records|pdf)/.test(k)) return doc;
  if (/(gps|map|nearby)/.test(k)) return mapPin;
  if (/(community|chat|group)/.test(k)) return chat;
  if (/(market|shop|expense)/.test(k)) return cart;
  if (/(ai|insight|vision|video)/.test(k)) return spark;
  if (/(training)/.test(k)) return dogFace;
  return paw;
}

function svgFor(key: string, salt: string) {
  const h = hash32(`${key}:${salt}`);
  const hue1 = h % 360;
  const hue2 = (hue1 + 48 + ((h >>> 8) % 50)) % 360;
  const hue3 = (hue1 + 200 + ((h >>> 16) % 90)) % 360;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900" viewBox="0 0 1400 900">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue1}, 88%, 62%)"/>
      <stop offset="0.55" stop-color="hsl(${hue2}, 88%, 62%)"/>
      <stop offset="1" stop-color="hsl(${hue3}, 88%, 62%)"/>
    </linearGradient>
    <radialGradient id="r" cx="50%" cy="40%" r="70%">
      <stop offset="0" stop-color="rgb(255,255,255)" stop-opacity="0.95"/>
      <stop offset="1" stop-color="rgb(255,255,255)" stop-opacity="0"/>
    </radialGradient>
    <filter id="blur" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="36" />
    </filter>
  </defs>

  <rect width="1400" height="900" fill="url(#g)"/>
  <g opacity="0.75" filter="url(#blur)">
    <circle cx="260" cy="260" r="180" fill="url(#r)"/>
    <circle cx="1180" cy="240" r="220" fill="url(#r)"/>
    <circle cx="860" cy="720" r="260" fill="url(#r)"/>
  </g>
  <g opacity="0.12">
    <circle cx="220" cy="170" r="10" fill="rgb(255,255,255)" fill-opacity="0.85"/>
    <circle cx="280" cy="210" r="8" fill="rgb(255,255,255)" fill-opacity="0.75"/>
    <circle cx="320" cy="150" r="7" fill="rgb(255,255,255)" fill-opacity="0.70"/>
    <circle cx="1180" cy="680" r="10" fill="rgb(255,255,255)" fill-opacity="0.85"/>
    <circle cx="1120" cy="720" r="8" fill="rgb(255,255,255)" fill-opacity="0.75"/>
    <circle cx="1080" cy="660" r="7" fill="rgb(255,255,255)" fill-opacity="0.70"/>
  </g>
  ${iconMarkup(key)}
  <rect x="0" y="0" width="1400" height="900" fill="rgb(15,23,42)" fill-opacity="0.10"/>
</svg>`;
}

export default async function handler(req: Request) {
  const url = new URL(req.url);
  if (req.method !== "GET") return new Response("Method Not Allowed", { status: 405 });

  const key = url.searchParams.get("key") || "home";
  const salt = url.searchParams.get("salt") || "0";
  const svg = svgFor(key, salt);

  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

