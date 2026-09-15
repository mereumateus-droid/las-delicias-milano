import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { bindings } from "./lib/bindings.server";
import { applySecurityHeaders } from "./lib/security-headers.server";
import { SITO_HTML } from "./sito-html";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

/**
 * Conservazione dei dati: una prenotazione serve finche serve. Passati sei
 * mesi dalla data del tavolo, nome, telefono e note non hanno piu ragione di
 * restare, e vengono cancellati da soli. La pulizia gira ogni notte, chiamata
 * dalla pianificazione di Cloudflare (vedi "triggers" in wrangler.jsonc).
 */
const MESI_DI_CONSERVAZIONE = 6;

async function pulizia(): Promise<number> {
  const db = bindings().DB;
  if (!db) return 0;
  const esito = await db
    .prepare(`DELETE FROM prenotazioni WHERE data < date('now', '-${MESI_DI_CONSERVAZIONE} months')`)
    .run();
  const tolte = esito.meta?.changes ?? 0;
  if (tolte > 0) console.log(`pulizia: ${tolte} prenotazioni oltre i ${MESI_DI_CONSERVAZIONE} mesi`);
  return tolte;
}

// Pagina non trovata: breve, in italiano, senza rivelare la piattaforma su
// cui il sito e costruito.
const NON_TROVATA = `<!DOCTYPE html>
<html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Pagina non trovata · Las Delicias</title>
<style>
  html{background:#0D2A20}
  body{margin:0;min-height:100svh;display:flex;flex-direction:column;align-items:center;
    justify-content:center;gap:14px;background:#0D2A20;color:#FBF4E6;text-align:center;
    padding:24px;font-family:"Barlow Condensed",Arial,sans-serif}
  p{margin:0}
  .occhio{font-size:12px;letter-spacing:.24em;text-transform:uppercase;color:#C6B69B}
  h1{margin:0;font-size:30px;font-weight:600;text-transform:uppercase;letter-spacing:.02em}
  a{color:#F7CE72}
</style></head>
<body>
  <p class="occhio">Las Delicias</p>
  <h1>Pagina non trovata</h1>
  <p style="color:#C6B69B">La pagina che cercate non esiste o è stata spostata.</p>
  <p><a href="/">Torna al sito</a></p>
</body></html>`;

// La pagina pubblica e un documento unico e gia completo: la serviamo tale e
// quale, prima di TanStack, cosi resta identica a quella approvata dal cliente.
function paginaPubblica(): Response {
  return new Response(SITO_HTML, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}

export default {
  async scheduled(
    _evento: unknown,
    _env: unknown,
    ctx: { waitUntil: (lavoro: Promise<unknown>) => void },
  ) {
    ctx.waitUntil(
      pulizia().catch((errore) => {
        console.error("pulizia fallita:", errore);
      }),
    );
  },

  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);

      // solo cifrato: chi arriva in chiaro viene mandato su https prima di
      // poter inviare qualunque dato.
      const protocollo = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
      if (protocollo === "http") {
        url.protocol = "https:";
        return applySecurityHeaders(
          new Response(null, { status: 301, headers: { location: url.toString() } }),
        );
      }

      // niente barra finale: /menu/ diventa /menu
      if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
        const pulito = url.pathname.replace(/\/+$/, "") || "/";
        return applySecurityHeaders(
          new Response(null, { status: 301, headers: { location: pulito + url.search } }),
        );
      }

      if (url.pathname === "/" && (request.method === "GET" || request.method === "HEAD")) {
        const risposta = paginaPubblica();
        return applySecurityHeaders(
          request.method === "HEAD"
            ? new Response(null, { status: 200, headers: risposta.headers })
            : risposta,
        );
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalizzata = await normalizeCatastrophicSsrResponse(response);

      if (
        normalizzata.status === 404 &&
        (normalizzata.headers.get("content-type") ?? "").includes("text/html")
      ) {
        return applySecurityHeaders(
          new Response(NON_TROVATA, {
            status: 404,
            headers: {
              "content-type": "text/html; charset=utf-8",
              "cache-control": "no-store",
              "x-robots-tag": "noindex, nofollow",
            },
          }),
        );
      }

      return applySecurityHeaders(normalizzata);
    } catch (error) {
      console.error(error);
      return applySecurityHeaders(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );
    }
  },
};
