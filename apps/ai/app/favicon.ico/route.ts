const FAVICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="ecorione">
  <rect width="64" height="64" rx="14" fill="#f7f4ec"/>
  <g fill="none" stroke="#a57f35" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M32 10 52 21.5v21L32 54 12 42.5v-21Z"/>
    <path d="M21 24.5 32 18l11 6.5v15L32 46l-11-6.5Z"/>
    <path d="M32 18v28M21 24.5 43 39.5M43 24.5 21 39.5"/>
  </g>
</svg>
`.trim();

export const dynamic = "force-static";

export function GET(): Response {
  return new Response(FAVICON_SVG, {
    status: 200,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}
