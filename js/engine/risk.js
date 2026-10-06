/* ============================================================
   Riesgo cardiovascular
   - PREVENT (AHA, Khan et al., Circulation 2024;149:430-449), modelo base,
     10 y 30 años: ECV total, ECV aterosclerótica (ASCVD) e insuficiencia cardíaca.
     Es la ecuación que adoptan la guía AHA/ACC de hipertensión 2025 y la
     guía ACC/AHA de dislipemias 2026 (reemplaza a las Pooled Cohort).
   - Framingham general 2008 (D'Agostino), como referencia histórica.
   - Categoría clínica (prevención secundaria / equivalentes de alto riesgo).
   - Potenciadores de riesgo, objetivos de LDL, presión arterial,
     síndrome metabólico y FINDRISC.
   ============================================================ */

import { COL_MGDL_A_MMOL } from './labs.js';

/* Coeficientes del modelo base. Orden de cada vector:
   [edad, edad², noHDL, HDL, PAS<110, PAS≥110, DM, tabaco, IMC<30, IMC≥30,
    TFG<60, TFG≥60, tto HTA, estatina, ttoHTA×PAS≥110, estatina×noHDL,
    edad×noHDL, edad×HDL, edad×PAS≥110, edad×DM, edad×tabaco, edad×IMC≥30,
    edad×TFG<60, constante] */
const P = {
  10: {
    cvd: {
      F: [0.7939329, 0, 0.0305239, -0.1606857, -0.2394003, 0.3600781, 0.8667604, 0.5360739, 0, 0, 0.6045917, 0.0433769, 0.3151672, -0.1477655, -0.0663612, 0.1197879, -0.0819715, 0.0306769, -0.0946348, -0.27057, -0.078715, 0, -0.1637806, -3.307728],
      M: [0.7688528, 0, 0.0736174, -0.0954431, -0.4347345, 0.3362658, 0.7692857, 0.4386871, 0, 0, 0.5378979, 0.0164827, 0.288879, -0.1337349, -0.0475924, 0.150273, -0.0517874, 0.0191169, -0.1049477, -0.2251948, -0.0895067, 0, -0.1543702, -3.031168],
    },
    ascvd: {
      F: [0.719883, 0, 0.1176967, -0.151185, -0.0835358, 0.3592852, 0.8348585, 0.4831078, 0, 0, 0.4864619, 0.0397779, 0.2265309, -0.0592374, -0.0395762, 0.0844423, -0.0567839, 0.0325692, -0.1035985, -0.2417542, -0.0791142, 0, -0.1671492, -3.819975],
      M: [0.7099847, 0, 0.1658663, -0.1144285, -0.2837212, 0.3239977, 0.7189597, 0.3956973, 0, 0, 0.3690075, 0.0203619, 0.2036522, -0.0865581, -0.0322916, 0.114563, -0.0300005, 0.0232747, -0.0927024, -0.2018525, -0.0970527, 0, -0.1217081, -3.500655],
    },
    hf: {
      F: [0.8998235, 0, 0, 0, -0.4559771, 0.3576505, 1.038346, 0.583916, -0.0072294, 0.2997706, 0.7451638, 0.0557087, 0.3534442, 0, -0.0981511, 0, 0, 0, -0.0946663, -0.3581041, -0.1159453, -0.003878, -0.1884289, -4.310409],
      M: [0.8972642, 0, 0, 0, -0.6811466, 0.3634461, 0.923776, 0.5023736, -0.0485841, 0.3726929, 0.6926917, 0.0251827, 0.2980922, 0, -0.0497731, 0, 0, 0, -0.1289201, -0.3040924, -0.1401688, 0.0068126, -0.1797778, -3.946391],
    },
  },
  30: {
    cvd: {
      F: [0.5503079, -0.0928369, 0.0409794, -0.1663306, -0.1628654, 0.3299505, 0.6793894, 0.3196112, 0, 0, 0.1857101, 0.0553528, 0.2894, -0.075688, -0.056367, 0.1071019, -0.0751438, 0.0301786, -0.0998776, -0.3206166, -0.1607862, 0, -0.1450788, -1.318827],
      M: [0.4627309, -0.0984281, 0.0836088, -0.1029824, -0.2140352, 0.2904325, 0.5331276, 0.2141914, 0, 0, 0.1155556, 0.0603775, 0.232714, -0.0272112, -0.0384488, 0.134192, -0.0511759, 0.0165865, -0.1101437, -0.2585943, -0.1566406, 0, -0.1166776, -1.148204],
    },
    ascvd: {
      F: [0.4669202, -0.0893118, 0.1256901, -0.1542255, -0.0018093, 0.322949, 0.6296707, 0.268292, 0, 0, 0.100106, 0.0499663, 0.1875292, 0.0152476, -0.0276123, 0.0736147, -0.0521962, 0.0316918, -0.1046101, -0.2727793, -0.1530907, 0, -0.1299149, -1.974074],
      M: [0.3994099, -0.0937484, 0.1744643, -0.120203, -0.0665117, 0.2753037, 0.4790257, 0.1782635, 0, 0, -0.0218789, 0.0602553, 0.1421182, 0.0135996, -0.0218265, 0.1013148, -0.0312619, 0.020673, -0.0920935, -0.2159947, -0.1548811, 0, -0.0712547, -1.736444],
    },
    hf: {
      F: [0.6254374, -0.0983038, 0, 0, -0.3919241, 0.3142295, 0.8330787, 0.3438651, 0.0594874, 0.2525536, 0.2981642, 0.0667159, 0.333921, 0, -0.0893177, 0, 0, 0, -0.0974299, -0.404855, -0.1982991, -0.0035619, -0.1564215, -2.205379],
      M: [0.5681541, -0.1048388, 0, 0, -0.4761564, 0.30324, 0.6840338, 0.2656273, 0.0833107, 0.26999, 0.2541805, 0.0638923, 0.2583631, 0, -0.0391938, 0, 0, 0, -0.1269124, -0.3273572, -0.2043019, -0.0182831, -0.1342618, -1.95751],
    },
  },
};

/** Rangos validados del modelo; fuera de ellos se recorta y se avisa. */
export const PREVENT_RANGOS = {
  edad: [30, 79], ct: [130, 320], hdl: [20, 100], pas: [90, 200], imc: [18.5, 39.9], tfg: [15, 140],
};

const clamp = (v, [a, b]) => Math.min(b, Math.max(a, v));

/**
 * PREVENT, modelo base. Entradas en mg/dL y mmHg.
 * Devuelve riesgos en % y avisos de validez.
 */
export function prevent(x) {
  const req = ['edad', 'ct', 'hdl', 'pas', 'tfg'];
  const faltan = req.filter((k) => !Number.isFinite(x[k]));
  if (faltan.length) return { ok: false, faltan };
  const avisos = [];
  const v = {};
  for (const [k, r] of Object.entries(PREVENT_RANGOS)) {
    const val = x[k];
    if (!Number.isFinite(val)) continue;
    v[k] = clamp(val, r);
    if (v[k] !== val) avisos.push(`${k.toUpperCase()} fuera del rango validado (${r[0]}–${r[1]}); se usó ${v[k]}`);
  }
  if (x.edad < 30 || x.edad > 79) avisos.unshift('PREVENT está validado entre 30 y 79 años: el resultado es solo orientativo.');
  const imc = Number.isFinite(x.imc) ? v.imc : 25;
  if (!Number.isFinite(x.imc)) avisos.push('Sin IMC: el riesgo de insuficiencia cardíaca asume IMC 25.');

  const a = (v.edad - 55) / 10;
  const nh = (v.ct - v.hdl) * COL_MGDL_A_MMOL - 3.5;
  const hd = (v.hdl * COL_MGDL_A_MMOL - 1.3) / 0.3;
  const sl = (Math.min(v.pas, 110) - 110) / 20;
  const sh = (Math.max(v.pas, 110) - 130) / 20;
  const bl = (Math.min(imc, 30) - 25) / 5;
  const bh = (Math.max(imc, 30) - 30) / 5;
  const el = (Math.min(v.tfg, 60) - 60) / -15;
  const eh = (Math.max(v.tfg, 60) - 90) / -15;
  const dm = x.dm ? 1 : 0;
  const tb = x.tabaco ? 1 : 0;
  const tx = x.tratHta ? 1 : 0;
  const st = x.estatina ? 1 : 0;
  const X = [a, a * a, nh, hd, sl, sh, dm, tb, bl, bh, el, eh, tx, st, tx * sh, st * nh, a * nh, a * hd, a * sh, a * dm, a * tb, a * bh, a * el, 1];

  const sx = x.sexo === 'M' ? 'M' : 'F';
  const out = { ok: true, avisos };
  for (const h of [10, 30]) {
    for (const o of ['cvd', 'ascvd', 'hf']) {
      const b = P[h][o][sx];
      let lp = 0;
      for (let i = 0; i < X.length; i++) lp += b[i] * X[i];
      out[`${o}${h}`] = (100 * Math.exp(lp)) / (1 + Math.exp(lp));
    }
  }
  return out;
}

/** Categorías PREVENT. ASCVD a 10 años: guía ACC/AHA de dislipemias 2026. */
export function categoriaAscvd10(p) {
  if (!Number.isFinite(p)) return null;
  if (p < 3) return { id: 'bajo', nombre: 'Bajo', color: '#22c55e' };
  if (p < 5) return { id: 'limite', nombre: 'Limítrofe', color: '#eab308' };
  if (p < 10) return { id: 'intermedio', nombre: 'Intermedio', color: '#f97316' };
  return { id: 'alto', nombre: 'Alto', color: '#ef4444' };
}
/** ECV total a 10 años: la guía de HTA 2025 usa ≥ 7,5 % para tratar la etapa 1. */
export function categoriaCvd10(p) {
  if (!Number.isFinite(p)) return null;
  if (p < 5) return { id: 'bajo', nombre: 'Bajo', color: '#22c55e' };
  if (p < 7.5) return { id: 'limite', nombre: 'Limítrofe', color: '#eab308' };
  if (p < 20) return { id: 'intermedio', nombre: 'Intermedio', color: '#f97316' };
  return { id: 'alto', nombre: 'Alto', color: '#ef4444' };
}

/* ---------- Framingham general 2008 (D'Agostino, Circulation 2008) ---------- */
export function framingham(x) {
  if (!['edad', 'ct', 'hdl', 'pas'].every((k) => Number.isFinite(x[k]) && x[k] > 0)) return null;
  const F = x.sexo === 'F';
  const c = F
    ? { e: 2.32888, ct: 1.20904, hdl: -0.70833, pasN: 2.76157, pasT: 2.82263, tb: 0.52873, dm: 0.69154, s0: 0.95012, m: 26.1931 }
    : { e: 3.06117, ct: 1.1237, hdl: -0.93263, pasN: 1.93303, pasT: 1.99881, tb: 0.65451, dm: 0.57367, s0: 0.88936, m: 23.9802 };
  const s = c.e * Math.log(x.edad) + c.ct * Math.log(x.ct) + c.hdl * Math.log(x.hdl)
    + (x.tratHta ? c.pasT : c.pasN) * Math.log(x.pas) + (x.tabaco ? c.tb : 0) + (x.dm ? c.dm : 0);
  return 100 * (1 - c.s0 ** Math.exp(s - c.m));
}

/* ---------- Categoría clínica ----------
   Quien ya tuvo un evento o tiene un equivalente no se calcula con ecuaciones:
   entra directo en riesgo alto o muy alto (ESC 2021 / SAC). */
export function categoriaClinica(c) {
  const p = c.pat || {};
  const motivos = [];
  const ecv = p.iam || p.acv || p.eap || p.revasc;
  if (ecv) motivos.push('Enfermedad cardiovascular aterosclerótica establecida');
  const daño = p.retinopatia || (c.erc && c.erc.a && c.erc.a !== 'A1') || p.neuropatia;
  if ((p.dm2 || p.dm1) && daño) motivos.push('Diabetes con daño de órgano blanco');
  if (Number.isFinite(c.tfg) && c.tfg < 30) motivos.push('Enfermedad renal crónica grave (TFG < 30)');
  if (motivos.length) return { id: 'muy-alto', nombre: 'Muy alto', color: '#be123c', motivos, secundaria: !!ecv };

  if (p.dm2 || p.dm1) motivos.push('Diabetes');
  if (Number.isFinite(c.tfg) && c.tfg < 60) motivos.push('Enfermedad renal crónica moderada (TFG 30–59)');
  if (Number.isFinite(c.ldl) && c.ldl >= 190) motivos.push('LDL ≥ 190 mg/dL');
  if (p.hipercolFamiliar) motivos.push('Hipercolesterolemia familiar');
  if (c.pas >= 180 || c.pad >= 110) motivos.push('Presión arterial ≥ 180/110 mmHg');
  if (motivos.length) return { id: 'alto', nombre: 'Alto', color: '#ef4444', motivos, secundaria: false };
  return null; // Se decide con PREVENT
}

/** Potenciadores de riesgo (ACC/AHA): suben de categoría a los casos limítrofes. */
export function potenciadores(c) {
  const p = c.pat || {}, f = c.fam || {}, l = c.labs || {}, d = c.der || {};
  const out = [];
  if (f.ecvPrecoz) out.push('Antecedente familiar de enfermedad cardiovascular precoz');
  if (Number.isFinite(d.ldl) && d.ldl >= 160 && d.ldl < 190) out.push('LDL persistente ≥ 160 mg/dL');
  if (c.sm?.cumple) out.push('Síndrome metabólico');
  if (d.erc?.erc) out.push(`Enfermedad renal crónica (${d.erc.texto})`);
  if (p.inflamatoria) out.push('Enfermedad inflamatoria crónica (artritis reumatoidea, psoriasis, lupus, VIH)');
  if (p.preeclampsia) out.push('Preeclampsia o menopausia precoz');
  if (Number.isFinite(d.lpa) && d.lpa >= 50) out.push('Lipoproteína (a) ≥ 50 mg/dL');
  if (Number.isFinite(l.pcr) && l.pcr >= 2 && l.pcr < 10) out.push('PCR ultrasensible ≥ 2 mg/L');
  if (Number.isFinite(l.apob) && l.apob >= 130) out.push('Apolipoproteína B ≥ 130 mg/dL');
  if (Number.isFinite(l.tg) && l.tg >= 175) out.push('Triglicéridos persistentes ≥ 175 mg/dL');
  if (p.higadoGraso) out.push('Esteatosis hepática metabólica (MASLD)');
  if (p.sahos) out.push('Apnea obstructiva del sueño');
  return out;
}

/** Objetivo de LDL por categoría (ESC/EAS y consensos SAC). */
export function objetivoLdl(nivel) {
  return { 'muy-alto': 55, alto: 70, intermedio: 100, limite: 100, bajo: 116 }[nivel] ?? 116;
}

/** Presión arterial (guía AHA/ACC 2025). */
export function categoriaPresion(pas, pad) {
  if (!Number.isFinite(pas) || !Number.isFinite(pad)) return null;
  if (pas >= 180 || pad >= 120) return { id: 'crisis', nombre: 'Muy elevada (≥ 180/120)', color: '#be123c' };
  if (pas >= 140 || pad >= 90) return { id: 'e2', nombre: 'Hipertensión etapa 2', color: '#ef4444' };
  if (pas >= 130 || pad >= 80) return { id: 'e1', nombre: 'Hipertensión etapa 1', color: '#f97316' };
  if (pas >= 120) return { id: 'elevada', nombre: 'Elevada', color: '#eab308' };
  return { id: 'normal', nombre: 'Normal', color: '#22c55e' };
}

/** Síndrome metabólico, definición armonizada 2009 con cintura ALAD (94/88 cm). */
export function sindromeMetabolico({ sexo, cintura, tg, hdl, pas, pad, glucosa, pat = {}, meds = {} }) {
  const crit = [
    { id: 'cintura', nombre: 'Cintura aumentada', ok: Number.isFinite(cintura) ? cintura >= (sexo === 'F' ? 88 : 94) : null },
    { id: 'tg', nombre: 'Triglicéridos ≥ 150 o en tratamiento', ok: Number.isFinite(tg) ? tg >= 150 || !!meds.fibrato : meds.fibrato ? true : null },
    { id: 'hdl', nombre: `HDL < ${sexo === 'F' ? 50 : 40}`, ok: Number.isFinite(hdl) ? hdl < (sexo === 'F' ? 50 : 40) : null },
    { id: 'pa', nombre: 'PA ≥ 130/85 o en tratamiento', ok: pat.hta || meds.antihipertensivo ? true : Number.isFinite(pas) ? pas >= 130 || pad >= 85 : null },
    { id: 'glu', nombre: 'Glucemia ≥ 100 o en tratamiento', ok: pat.dm2 || pat.prediabetes || meds.antidiabetico ? true : Number.isFinite(glucosa) ? glucosa >= 100 : null },
  ];
  const n = crit.filter((c) => c.ok === true).length;
  const sinDato = crit.filter((c) => c.ok === null).length;
  return { cumple: n >= 3, n, sinDato, criterios: crit };
}

/** FINDRISC: riesgo de diabetes tipo 2 a 10 años (solo sin diabetes). */
export function findrisc({ edad, imc, cintura, sexo, actividad30, frutasVerduras, antihipertensivo, glucosaAltaPrevia, famDm }) {
  if (!Number.isFinite(edad) || !Number.isFinite(imc)) return null;
  let p = 0;
  p += edad < 45 ? 0 : edad < 55 ? 2 : edad < 65 ? 3 : 4;
  p += imc < 25 ? 0 : imc <= 30 ? 1 : 3;
  if (Number.isFinite(cintura)) {
    p += sexo === 'F' ? (cintura < 80 ? 0 : cintura <= 88 ? 3 : 4) : (cintura < 94 ? 0 : cintura <= 102 ? 3 : 4);
  }
  p += actividad30 ? 0 : 2;
  p += frutasVerduras ? 0 : 1;
  p += antihipertensivo ? 2 : 0;
  p += glucosaAltaPrevia ? 5 : 0;
  p += famDm === '1grado' ? 5 : famDm === '2grado' ? 3 : 0;
  const n = p < 7 ? { id: 'bajo', nombre: 'Bajo', riesgo: '1 %' }
    : p <= 11 ? { id: 'leve', nombre: 'Ligeramente elevado', riesgo: '4 %' }
      : p <= 14 ? { id: 'moderado', nombre: 'Moderado', riesgo: '17 %' }
        : p <= 20 ? { id: 'alto', nombre: 'Alto', riesgo: '33 %' }
          : { id: 'muy-alto', nombre: 'Muy alto', riesgo: '50 %' };
  return { puntos: p, ...n, incompleto: !Number.isFinite(cintura) };
}

/**
 * Cuánto bajaría el riesgo si se corrige cada factor modificable
 * (simulación con PREVENT, ECV total a 10 años).
 */
export function contribuciones(x) {
  const base = prevent(x);
  if (!base.ok) return null;
  const idealHdl = x.sexo === 'F' ? 60 : 50;
  const prueba = (cambio, o = 'cvd10') => prevent({ ...x, ...cambio })[o];
  // El IMC solo entra en la ecuación de insuficiencia cardíaca: se mide sobre ese riesgo.
  const lista = [
    { id: 'tabaco', nombre: 'Dejar de fumar', aplica: !!x.tabaco, cambio: { tabaco: false } },
    { id: 'pas', nombre: 'Presión sistólica a 120 mmHg', aplica: x.pas > 120, cambio: { pas: 120 } },
    { id: 'col', nombre: 'Colesterol no-HDL a 100 mg/dL', aplica: x.ct - x.hdl > 100, cambio: { ct: x.hdl + 100 } },
    { id: 'hdl', nombre: `HDL a ${idealHdl} mg/dL`, aplica: x.hdl < idealHdl, cambio: { hdl: idealHdl, ct: x.ct + (idealHdl - x.hdl) } },
    { id: 'imc', nombre: 'IMC a 25 (riesgo de insuficiencia cardíaca)', aplica: x.imc > 25, cambio: { imc: 25 }, o: 'hf10' },
  ];
  return lista.filter((l) => l.aplica).map((l) => {
    const o = l.o || 'cvd10';
    const r = prueba(l.cambio, o);
    return { id: l.id, nombre: l.nombre, desenlace: o, actual: base[o], nuevo: r, baja: base[o] - r };
  }).filter((l) => l.baja > 0.05).sort((a, b) => b.baja - a.baja);
}
