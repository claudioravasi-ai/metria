/* ============================================================
   Antropometría y metabolismo energético
   Funciones puras: reciben números, devuelven números u objetos.
   Sexo: 'F' | 'M' (sexo biológico, que es el que usan las fórmulas).
   ============================================================ */

export const redondear = (v, d = 1) => (Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : null);
const ok = (...v) => v.every((x) => Number.isFinite(x) && x > 0);

/** Edad cumplida en años a partir de 'AAAA-MM-DD'. */
export function edad(fechaNac, ref = new Date()) {
  if (!fechaNac) return null;
  const [a, m, d] = String(fechaNac).split('-').map(Number);
  if (!a || !m || !d) return null;
  let e = ref.getFullYear() - a;
  const antes = ref.getMonth() + 1 < m || (ref.getMonth() + 1 === m && ref.getDate() < d);
  if (antes) e--;
  return e >= 0 && e < 130 ? e : null;
}

/* ---------- IMC (OMS) ---------- */
export const CATS_IMC = [
  { id: 'bajo', nombre: 'Bajo peso', min: 0, max: 18.5, color: '#38bdf8' },
  { id: 'normal', nombre: 'Peso saludable', min: 18.5, max: 25, color: '#22c55e' },
  { id: 'sobrepeso', nombre: 'Sobrepeso', min: 25, max: 30, color: '#eab308' },
  { id: 'ob1', nombre: 'Obesidad grado I', min: 30, max: 35, color: '#f97316' },
  { id: 'ob2', nombre: 'Obesidad grado II', min: 35, max: 40, color: '#ef4444' },
  { id: 'ob3', nombre: 'Obesidad grado III', min: 40, max: 70, color: '#be123c' },
];

export function imc(peso, tallaCm) {
  if (!ok(peso, tallaCm)) return null;
  const m = tallaCm / 100;
  return peso / (m * m);
}

export function categoriaImc(v) {
  if (!Number.isFinite(v)) return null;
  return CATS_IMC.find((c) => v < c.max) || CATS_IMC[CATS_IMC.length - 1];
}

/** Rango de peso con IMC 18,5–24,9 para esa talla. */
export function rangoPesoSaludable(tallaCm) {
  if (!ok(tallaCm)) return null;
  const m2 = (tallaCm / 100) ** 2;
  return { min: 18.5 * m2, max: 24.9 * m2 };
}

/* ---------- Gasto energético ----------
   Mifflin-St Jeor (1990): la más exacta en adultos con y sin obesidad
   (revisión de la Academy of Nutrition and Dietetics, Frankenfield 2005).
   Harris-Benedict revisada por Roza y Shizgal (1984).
   Katch-McArdle: solo si se conoce el % de grasa (usa la masa magra). */
export function tmbMifflin({ peso, talla, edad, sexo }) {
  if (!ok(peso, talla, edad)) return null;
  return 10 * peso + 6.25 * talla - 5 * edad + (sexo === 'M' ? 5 : -161);
}

export function tmbHarris({ peso, talla, edad, sexo }) {
  if (!ok(peso, talla, edad)) return null;
  return sexo === 'M'
    ? 88.362 + 13.397 * peso + 4.799 * talla - 5.677 * edad
    : 447.593 + 9.247 * peso + 3.098 * talla - 4.33 * edad;
}

export function tmbKatch({ peso, grasa }) {
  if (!ok(peso, grasa) || grasa >= 70) return null;
  const magra = peso * (1 - grasa / 100);
  return 370 + 21.6 * magra;
}

export const ACTIVIDAD = [
  { id: 'sedentario', f: 1.2, nombre: 'Sedentario', desc: 'Poco o nada de ejercicio' },
  { id: 'ligera', f: 1.375, nombre: 'Ligera', desc: 'Ejercicio 1 a 3 días por semana' },
  { id: 'moderada', f: 1.55, nombre: 'Moderada', desc: 'Ejercicio 3 a 5 días por semana' },
  { id: 'intensa', f: 1.725, nombre: 'Intensa', desc: 'Ejercicio 6 a 7 días por semana' },
  { id: 'muy', f: 1.9, nombre: 'Muy intensa', desc: 'Trabajo físico o doble turno de entrenamiento' },
];

export const factorActividad = (id) => (ACTIVIDAD.find((a) => a.id === id) || ACTIVIDAD[0]).f;

/** Resumen energético completo. */
export function energia({ peso, talla, edad, sexo, grasa, actividad = 'sedentario' }) {
  const mifflin = tmbMifflin({ peso, talla, edad, sexo });
  if (mifflin == null) return null;
  const harris = tmbHarris({ peso, talla, edad, sexo });
  const katch = tmbKatch({ peso, grasa });
  const f = factorActividad(actividad);
  const tmb = mifflin;
  const get = tmb * f;
  // Desglose del gasto total: basal + efecto térmico de los alimentos (~10 % del GET) + actividad.
  const tef = get * 0.1;
  const act = Math.max(0, get - tmb - tef);
  return {
    tmb, mifflin, harris, katch, factor: f, get,
    desglose: { basal: tmb, digestion: tef, actividad: act },
    porNivel: ACTIVIDAD.map((a) => ({ ...a, kcal: tmb * a.f })),
  };
}

/* ---------- Composición corporal ---------- */

/** CUN-BAE (Gómez-Ambrosi, Diabetes Care 2012). sexo: M=0, F=1. */
export function grasaCunBae({ edad, sexo, imc: b }) {
  if (!ok(edad, b)) return null;
  const s = sexo === 'F' ? 1 : 0;
  const v = -44.988 + 0.503 * edad + 10.689 * s + 3.172 * b - 0.026 * b * b
    + 0.181 * b * s - 0.02 * b * edad - 0.005 * b * b * s + 0.00021 * b * b * edad;
  return Math.max(3, Math.min(70, v));
}

/** Relative Fat Mass (Woolcott y Bergman, Sci Rep 2018). */
export function grasaRfm({ talla, cintura, sexo }) {
  if (!ok(talla, cintura)) return null;
  const v = 64 - 20 * (talla / cintura) + (sexo === 'F' ? 12 : 0);
  return Math.max(3, Math.min(70, v));
}

/** Umbral de adiposidad excesiva por % de grasa (AACE). */
export const grasaExcesiva = (pct, sexo) => Number.isFinite(pct) && pct >= (sexo === 'F' ? 35 : 25);

/** Índice cintura/talla: ≥0,5 riesgo aumentado; ≥0,6 riesgo alto. */
export function cinturaTalla(cintura, talla) {
  if (!ok(cintura, talla)) return null;
  const v = cintura / talla;
  return { valor: v, nivel: v >= 0.6 ? 'alto' : v >= 0.5 ? 'aumentado' : 'normal' };
}

/** Índice cintura/cadera (OMS): ≥0,90 en varones y ≥0,85 en mujeres. */
export function cinturaCadera(cintura, cadera, sexo) {
  if (!ok(cintura, cadera)) return null;
  const v = cintura / cadera;
  return { valor: v, elevado: v >= (sexo === 'F' ? 0.85 : 0.9) };
}

/** Perímetro de cintura: punto de corte latinoamericano (ALAD) y el de muy alto riesgo (OMS). */
export function cinturaRiesgo(cintura, sexo) {
  if (!ok(cintura)) return null;
  const alad = sexo === 'F' ? 88 : 94;
  const oms = sexo === 'F' ? 88 : 102;
  return { valor: cintura, alad, oms, elevado: cintura >= alad, muyElevado: cintura >= oms };
}

/** Superficie corporal (Mosteller). */
export const superficieCorporal = (peso, talla) => (ok(peso, talla) ? Math.sqrt((peso * talla) / 3600) : null);

/** Proteínas recomendadas para preservar masa magra durante el descenso de peso. */
export function proteinaDiaria(peso, tallaCm) {
  if (!ok(peso, tallaCm)) return null;
  // Con obesidad se calcula sobre un peso ajustado (peso ideal IMC 25 + 25 % del exceso).
  const ideal = 25 * (tallaCm / 100) ** 2;
  const base = peso > ideal ? ideal + 0.25 * (peso - ideal) : peso;
  return { min: 1.2 * base, max: 1.6 * base, pesoBase: base };
}

/** Resumen corporal completo a partir de la ficha. */
export function composicion({ peso, talla, edad, sexo, cintura, cadera, grasa }) {
  const b = imc(peso, talla);
  if (b == null) return null;
  const cunbae = grasaCunBae({ edad, sexo, imc: b });
  const rfm = grasaRfm({ talla, cintura, sexo });
  const grasaUsada = Number.isFinite(grasa) && grasa > 0 ? grasa : rfm ?? cunbae;
  return {
    imc: b,
    categoria: categoriaImc(b),
    rango: rangoPesoSaludable(talla),
    grasa: { medida: Number.isFinite(grasa) && grasa > 0 ? grasa : null, cunbae, rfm, usada: grasaUsada },
    masaMagra: grasaUsada != null ? peso * (1 - grasaUsada / 100) : null,
    ict: cinturaTalla(cintura, talla),
    icc: cinturaCadera(cintura, cadera, sexo),
    cintura: cinturaRiesgo(cintura, sexo),
    sc: superficieCorporal(peso, talla),
    proteina: proteinaDiaria(peso, talla),
  };
}
