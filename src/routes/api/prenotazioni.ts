/**
 * Registra una prenotazione inviata dal modulo della pagina pubblica.
 * Solo scrittura: da qui non esce nessun dato, l'elenco si legge unicamente
 * dal pannello riservato.
 */
import { createFileRoute } from "@tanstack/react-router";
import { bindings } from "../../lib/bindings.server";
import { origineAttendibile } from "../../lib/pannello.server";

const MAX_PER_ORIGINE_ALL_ORA = 8;

function rifiuto(codice: string, stato = 400): Response {
  return Response.json({ ok: false, codice }, { status: stato });
}

/**
 * Impronta dell'indirizzo: mai salvato in chiaro, e con un sale segreto.
 * Senza il sale un'impronta di un IPv4 si ricostruisce per forza bruta in
 * poche ore, quindi non sarebbe affatto anonima.
 */
async function impronta(valore: string, sale: string): Promise<string> {
  const dati = new TextEncoder().encode(`${sale}|las-delicias|${valore}`);
  const somma = await crypto.subtle.digest("SHA-256", dati);
  return Array.from(new Uint8Array(somma))
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type Richiesta = {
  nome: string;
  telefono: string;
  data: string;
  orario: string;
  persone: number;
  note: string;
};

/** Tutto cio che arriva dal browser va verificato prima di toccare il database. */
function convalida(grezzo: unknown): Richiesta | null {
  if (!grezzo || typeof grezzo !== "object") return null;
  const d = grezzo as Record<string, unknown>;

  const testo = (v: unknown, max: number): string | null => {
    if (typeof v !== "string") return null;
    const pulito = v.trim();
    return pulito.length <= max ? pulito : null;
  };

  const nome = testo(d.nome, 80);
  const telefono = testo(d.telefono, 40);
  const data = testo(d.data, 10);
  const orario = testo(d.orario, 5);
  const note = testo(d.note, 500) ?? "";

  if (!nome || nome.length < 2) return null;
  if (!telefono || telefono.replace(/\D/g, "").length < 6) return null;
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  if (!orario || !/^\d{2}:\d{2}$/.test(orario)) return null;

  const persone = Number(d.persone);
  if (!Number.isInteger(persone) || persone < 1 || persone > 40) return null;

  // niente prenotazioni nel passato o oltre un anno
  const quando = Date.parse(`${data}T00:00:00Z`);
  if (!Number.isFinite(quando)) return null;
  const oggi = Date.now() - 36 * 60 * 60 * 1000;
  if (quando < oggi || quando > Date.now() + 365 * 24 * 60 * 60 * 1000) return null;

  return { nome, telefono, data, orario, persone, note };
}

/** Qui si scrive soltanto: ogni altro metodo va respinto, non ignorato. */
function soloPost(): Response {
  return new Response(null, {
    status: 405,
    headers: { allow: "POST", "cache-control": "no-store" },
  });
}

export const Route = createFileRoute("/api/prenotazioni")({
  server: {
    handlers: {
      GET: async () => soloPost(),
      PUT: async () => soloPost(),
      PATCH: async () => soloPost(),
      DELETE: async () => soloPost(),
      OPTIONS: async () => soloPost(),
      POST: async ({ request }) => {
        if (!origineAttendibile(request)) return rifiuto("origine", 403);

        const db = bindings().DB;
        if (!db) return rifiuto("archivio_assente", 503);

        let corpo: unknown;
        try {
          corpo = await request.json();
        } catch {
          return rifiuto("corpo_illeggibile");
        }

        const dati = convalida(corpo);
        if (!dati) return rifiuto("dati_non_validi");

        const indirizzo =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for") ??
          "sconosciuto";
        const sale = bindings().PANNELLO_SESSIONE ?? "";
        const origine = sale ? await impronta(indirizzo, sale) : null;

        if (origine) {
          const recenti = await db
            .prepare(
              "SELECT COUNT(*) AS totale FROM prenotazioni WHERE origine = ? AND creata_il > datetime('now', '-1 hour')",
            )
            .bind(origine)
            .first<{ totale: number }>();
          if ((recenti?.totale ?? 0) >= MAX_PER_ORIGINE_ALL_ORA) {
            return rifiuto("troppe_richieste", 429);
          }
        }

        await db
          .prepare(
            "INSERT INTO prenotazioni (nome, telefono, data, orario, persone, note, stato, origine) VALUES (?, ?, ?, ?, ?, ?, 'in_attesa', ?)",
          )
          .bind(
            dati.nome,
            dati.telefono,
            dati.data,
            dati.orario,
            dati.persone,
            dati.note || null,
            origine,
          )
          .run();

        return Response.json({ ok: true });
      },
    },
  },
});
