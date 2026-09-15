/**
 * Pannello riservato del proprietario. Rotta privata, non collegata da
 * nessuna pagina pubblica e non elencata nella sitemap.
 *
 * Ogni risposta parte da un controllo di sessione: senza cookie valido esce
 * soltanto il modulo di accesso, mai una prenotazione.
 */
import { createFileRoute } from "@tanstack/react-router";
import { bindings } from "../lib/bindings.server";
import {
  chiaveValida,
  cookieScaduto,
  cookieSessione,
  creaSessione,
  origineAttendibile,
  pannelloConfigurato,
  sessioneValida,
} from "../lib/pannello.server";
import {
  oggiRoma,
  paginaAccesso,
  paginaPannello,
  type Prenotazione,
} from "../lib/pannello-pagina.server";

const INTESTAZIONI = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "x-robots-tag": "noindex, nofollow",
};

function html(corpo: string, stato = 200, extra: Record<string, string> = {}): Response {
  return new Response(corpo, { status: stato, headers: { ...INTESTAZIONI, ...extra } });
}

function aPannello(extra: Record<string, string> = {}): Response {
  return new Response(null, {
    status: 303,
    headers: { location: "/gestione-prenotazioni", "cache-control": "no-store", ...extra },
  });
}

async function elenco(): Promise<Response> {
  const db = bindings().DB;
  if (!db) return html(paginaAccesso("Archivio non disponibile. Riprovate tra poco."), 503);

  const giorno = oggiRoma();
  const oggi = await db
    .prepare("SELECT * FROM prenotazioni WHERE data = ? ORDER BY orario, id")
    .bind(giorno)
    .all<Prenotazione>();
  const prossime = await db
    .prepare("SELECT * FROM prenotazioni WHERE data > ? ORDER BY data, orario, id")
    .bind(giorno)
    .all<Prenotazione>();

  return html(paginaPannello(oggi.results ?? [], prossime.results ?? []));
}

/** Rallenta di poco un tentativo fallito, senza bloccare il Worker. */
function attesaBreve(): Promise<void> {
  return new Promise((risolvi) => setTimeout(risolvi, 400));
}

function soloGetPost(): Response {
  return new Response(null, {
    status: 405,
    headers: { allow: "GET, POST", "cache-control": "no-store" },
  });
}

export const Route = createFileRoute("/gestione-prenotazioni")({
  server: {
    handlers: {
      PUT: async () => soloGetPost(),
      PATCH: async () => soloGetPost(),
      DELETE: async () => soloGetPost(),
      GET: async ({ request }) => {
        if (!pannelloConfigurato()) {
          return html(paginaAccesso("Il pannello non è ancora configurato."), 503);
        }
        if (!(await sessioneValida(request))) return html(paginaAccesso());
        return elenco();
      },

      POST: async ({ request }) => {
        if (!pannelloConfigurato()) {
          return html(paginaAccesso("Il pannello non è ancora configurato."), 503);
        }
        if (!origineAttendibile(request)) return html(paginaAccesso("Richiesta non valida."), 403);

        const modulo = await request.formData();
        const azione = String(modulo.get("azione") ?? "");

        if (azione === "accedi") {
          const fornita = String(modulo.get("chiave") ?? "");
          if (!(await chiaveValida(fornita))) {
            await attesaBreve();
            return html(paginaAccesso("Chiave non valida."), 401);
          }
          const gettone = await creaSessione();
          if (!gettone) return html(paginaAccesso("Il pannello non è ancora configurato."), 503);
          return aPannello({ "set-cookie": cookieSessione(gettone) });
        }

        if (azione === "esci") {
          return aPannello({ "set-cookie": cookieScaduto() });
        }

        // Da qui in poi serve una sessione valida.
        if (!(await sessioneValida(request))) return html(paginaAccesso(), 401);

        if (azione === "confermata" || azione === "annullata") {
          const id = Number(modulo.get("id"));
          if (!Number.isInteger(id) || id < 1) return aPannello();
          const db = bindings().DB;
          if (!db) return html(paginaAccesso("Archivio non disponibile."), 503);
          await db
            .prepare("UPDATE prenotazioni SET stato = ? WHERE id = ?")
            .bind(azione, id)
            .run();
          return aPannello();
        }

        return aPannello();
      },
    },
  },
});
