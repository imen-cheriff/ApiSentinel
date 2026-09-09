const cache = new Map();
const inflight = new Map();

const ACCENTS = /[àâäáãåéèêëíìîïóòôöõúùûüçñßœæ¿¡]/i;
const NON_LATIN = /[\u0400-\u04FF\u0600-\u06FF\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/;
const FOREIGN_WORDS =
  /\b(le|la|les|des|une|est|dans|pour|avec|sans|cette|cet|aux|du|sur|par|pas|que|qui|sont|être|de|du|des|absence|limite|maximale|défaut|defaut|exposition|excessive|propriétés|proprietes|propriété|objet|autorisation|pagination|profil|client|contrôle|controle|appartenance|recherche|télémétrie|telemetrie|entrainements|entraînements|utilisateurs|utilisateur|bâtiment|batiment|export de|d'un|d'une|l'historique|documenté|documente|retourne|historique|appareil|appartenance|de la|un appareil|und|der|die|das|eine|nicht|für|el|los|las|una|para|con|por)\b/i;

export function looksNonEnglish(text) {
  if (!text || typeof text !== "string") return false;
  const sample = text.trim();
  if (sample.length < 3) return false;
  if (ACCENTS.test(sample) || NON_LATIN.test(sample)) return true;
  return FOREIGN_WORDS.test(sample);
}

async function requestTranslation(text) {
  const encoded = encodeURIComponent(text.slice(0, 4500));
  try {
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encoded}`
    );
    if (!res.ok) throw new Error("gtx failed");
    const data = await res.json();
    const translated = Array.isArray(data?.[0])
      ? data[0].map((part) => part?.[0] || "").join("")
      : "";
    if (translated.trim()) return translated.trim();
  } catch {
    /* fall through */
  }

  const res = await fetch(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=autodetect|en`
  );
  const data = await res.json();
  return (data?.responseData?.translatedText || text).trim();
}

export function translateToEnglish(text) {
  if (!text) return Promise.resolve(text);
  if (cache.has(text)) return Promise.resolve(cache.get(text));
  if (inflight.has(text)) return inflight.get(text);

  const job = requestTranslation(text)
    .then((translated) => {
      cache.set(text, translated);
      inflight.delete(text);
      return translated;
    })
    .catch(() => {
      inflight.delete(text);
      return text;
    });

  inflight.set(text, job);
  return job;
}
