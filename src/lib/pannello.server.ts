/**
 * Accesso riservato al pannello delle prenotazioni.
 *
 * La chiave non sta nel codice: arriva dai secret della piattaforma
 * (PANNELLO_CHIAVE) e viene letta solo qui, lato server. Dopo l'accesso il
 * browser riceve un cookie firmato (HttpOnly) che non contiene la chiave.
 * La firma usa PANNELLO_SESSIONE insieme alla chiave, cosi cambiando la
 * chiave tutte le sessioni aperte decadono da sole.
 */
import { bindings } from "./bindings.server";

export const COOKIE_SESSIONE = "ld_sessione";
const DURATA_SECONDI = 8 * 60 * 60;

const codificatore = new TextEncoder();

function esadecimale(dati: ArrayBuffer): string {
  return Array.from(new Uint8Array(dati))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function firma(materiale: string, messaggio: string): Promise<string> {
  const chiave = await crypto.subtle.importKey(
    "raw",
    codificatore.encode(materiale),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return esadecimale(await crypto.subtle.sign("HMAC", chiave, codificatore.encode(messaggio)));
}

/** Confronto a tempo costante: un `===` lascerebbe trapelare la lunghezza. */
export async function confrontoSicuro(a: string, b: string): Promise<boolean> {
  const primo = codificatore.encode(a);
  const secondo = codificatore.encode(b);
  if (primo.byteLength !== secondo.byteLength) return false;
  const sottosistema = crypto.subtle as unknown as {
    timingSafeEqual?: (a: ArrayBufferView, b: ArrayBufferView) => boolean;
  };
  if (typeof sottosistema.timingSafeEqual === "function") {
    return sottosistema.timingSafeEqual(primo, secondo);
  }
  // Ripiego portatile: confrontare le due impronte con una chiave usa e getta
  // e' equivalente a un confronto a tempo costante.
  const usaEGetta = crypto.randomUUID();
  return (await firma(usaEGetta, a)) === (await firma(usaEGetta, b));
}

type Segreti = { chiave: string; sessione: string };

/** Senza i due secret il pannello resta chiuso: nessun ripiego, nessun valore di comodo. */
function segreti(): Segreti | null {
  const env = bindings();
  const chiave = env.PANNELLO_CHIAVE;
  const sessione = env.PANNELLO_SESSIONE;
  if (!chiave || !sessione || chiave.length < 12) return null;
  return { chiave, sessione };
}

export function pannelloConfigurato(): boolean {
  return segreti() !== null;
}

export async function chiaveValida(fornita: string): Promise<boolean> {
  const s = segreti();
  if (!s) return false;
  return confrontoSicuro(fornita, s.chiave);
}

export async function creaSessione(): Promise<string | null> {
  const s = segreti();
  if (!s) return null;
  const scadenza = Math.floor(Date.now() / 1000) + DURATA_SECONDI;
  const corpo = `v1.${scadenza}`;
  return `${corpo}.${await firma(s.sessione + s.chiave, corpo)}`;
}

export async function sessioneValida(request: Request): Promise<boolean> {
  const s = segreti();
  if (!s) return false;
  const testata = request.headers.get("cookie") ?? "";
  const trovato = testata
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${COOKIE_SESSIONE}=`));
  if (!trovato) return false;
  const gettone = decodeURIComponent(trovato.slice(COOKIE_SESSIONE.length + 1));
  const pezzi = gettone.split(".");
  if (pezzi.length !== 3 || pezzi[0] !== "v1") return false;
  const scadenza = Number(pezzi[1]);
  if (!Number.isFinite(scadenza) || scadenza <= Math.floor(Date.now() / 1000)) return false;
  const atteso = await firma(s.sessione + s.chiave, `v1.${scadenza}`);
  return confrontoSicuro(pezzi[2], atteso);
}

export function cookieSessione(valore: string): string {
  return `${COOKIE_SESSIONE}=${encodeURIComponent(valore)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${DURATA_SECONDI}`;
}

export function cookieScaduto(): string {
  return `${COOKIE_SESSIONE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

/** Un POST deve arrivare dalla stessa origine: difesa in piu oltre a SameSite. */
export function origineAttendibile(request: Request): boolean {
  const origine = request.headers.get("origin");
  if (!origine) return true; // alcuni browser non lo mandano sui form same-origin
  try {
    return new URL(origine).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
