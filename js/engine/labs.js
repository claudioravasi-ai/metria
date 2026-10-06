/* ============================================================
   Laboratorio: fórmulas derivadas e interpretación.
   Unidades de los laboratorios argentinos: mg/dL salvo que se indique.
   ============================================================ */

const num = (v) => (Number.isFinite(v) ? v : null);
const ok = (...v) => v.every((x) => Number.isFinite(x) && x > 0);

export const COL_MGDL_A_MMOL = 0.02586;

/** Filtrado glomerular CKD-EPI 2021 sin raza (Inker, NEJM 2021). Creatinina en mg/dL. */
export function tfgCkdEpi2021(creat, edad, sexo) {
  if (!ok(creat, edad)) return null;
  const f = sexo === 'F';
  const k = f ? 0.7 : 0.9;
  const a = f ? -0.241 : -0.302;
  const r = creat / k;
  return 142 * Math.min(r, 1) ** a * Math.max(r, 1) ** -1.2 * 0.9938 ** edad * (f ? 1.012 : 1);
}

/** Estadio KDIGO por filtrado (G) y albuminuria (A). RACu en mg/g. */
export function estadioErc(tfg, racu) {
  if (!Number.isFinite(tfg)) return null;
  const g = tfg >= 90 ? 'G1' : tfg >= 60 ? 'G2' : tfg >= 45 ? 'G3a' : tfg >= 30 ? 'G3b' : tfg >= 15 ? 'G4' : 'G5';
  const a = !Number.isFinite(racu) ? null : racu < 30 ? 'A1' : racu <= 300 ? 'A2' : 'A3';
  const erc = tfg < 60 || (a && a !== 'A1');
  return { g, a, erc, texto: `${g}${a ? ' ' + a : ''}` };
}

/** LDL calculado: ecuación de Sampson/NIH (JAMA Cardiol 2020), válida con TG hasta 800. */
export function ldlSampson(ct, hdl, tg) {
  if (!ok(ct, hdl, tg) || tg > 800) return null;
  const nh = ct - hdl;
  return ct / 0.948 - hdl / 0.971 - (tg / 8.56 + (tg * nh) / 2140 - (tg * tg) / 16100) - 9.44;
}

/** LDL de Friedewald (solo con TG < 400). */
export function ldlFriedewald(ct, hdl, tg) {
  if (!ok(ct, hdl, tg) || tg >= 400) return null;
  return ct - hdl - tg / 5;
}

export const noHdl = (ct, hdl) => (ok(ct, hdl) ? ct - hdl : null);
/** HOMA-IR = glucosa (mg/dL) × insulina (µU/mL) / 405. */
export const homaIr = (glu, ins) => (ok(glu, ins) ? (glu * ins) / 405 : null);
/** Índice triglicéridos-glucosa: ln(TG × glucosa / 2). */
export const tyg = (tg, glu) => (ok(tg, glu) ? Math.log((tg * glu) / 2) : null);
export const tgHdl = (tg, hdl) => (ok(tg, hdl) ? tg / hdl : null);
/** FIB-4 = edad × AST / (plaquetas[10^3/µL] × √ALT). */
export const fib4 = (edad, ast, alt, plaq) => (ok(edad, ast, alt, plaq) ? (edad * ast) / (plaq * Math.sqrt(alt)) : null);

/** Lp(a): pasa a mg/dL si viene en nmol/L (aproximación 2,5 nmol ≈ 1 mg). */
export function lpaMgDl(valor, unidad) {
  if (!ok(valor)) return null;
  return unidad === 'nmol' ? valor / 2.5 : valor;
}

/** Estado glucémico según ADA (Standards of Care 2026). */
export function estadoGlucemico(glu, a1c, tieneDm) {
  if (tieneDm) return { id: 'dm', nombre: 'Diabetes conocida' };
  const dmLab = (Number.isFinite(glu) && glu >= 126) || (Number.isFinite(a1c) && a1c >= 6.5);
  if (dmLab) return { id: 'dm-lab', nombre: 'Valores en rango de diabetes (confirmar)' };
  const pre = (Number.isFinite(glu) && glu >= 100) || (Number.isFinite(a1c) && a1c >= 5.7);
  if (pre) return { id: 'pre', nombre: 'Prediabetes' };
  if (!Number.isFinite(glu) && !Number.isFinite(a1c)) return null;
  return { id: 'normal', nombre: 'Glucemia normal' };
}

/** Derivados del laboratorio. */
export function derivados(l = {}, { edad, sexo } = {}) {
  const ldlCalc = ldlSampson(l.ct, l.hdl, l.tg);
  const ldl = num(l.ldl) ?? ldlCalc ?? ldlFriedewald(l.ct, l.hdl, l.tg);
  const tfg = tfgCkdEpi2021(l.creatinina, edad, sexo);
  return {
    ldl,
    ldlMedido: Number.isFinite(l.ldl),
    ldlSampson: ldlCalc,
    ldlFriedewald: ldlFriedewald(l.ct, l.hdl, l.tg),
    noHdl: noHdl(l.ct, l.hdl),
    tfg,
    erc: estadioErc(tfg, l.racu),
    homa: homaIr(l.glucosa, l.insulina),
    tyg: tyg(l.tg, l.glucosa),
    tgHdl: tgHdl(l.tg, l.hdl),
    fib4: fib4(edad, l.ast, l.alt, l.plaquetas),
    lpa: lpaMgDl(l.lpa, l.lpaUnidad),
  };
}

/**
 * Interpretación renglón por renglón para la vista de laboratorio.
 * estado: 'ok' | 'limite' | 'alto' | 'bajo'
 */
export function interpretar(l = {}, d = {}, { edad, sexo, dm } = {}) {
  const out = [];
  const add = (id, nombre, valor, unidad, estado, texto, ref) => {
    if (Number.isFinite(valor)) out.push({ id, nombre, valor, unidad, estado, texto, ref });
  };
  const g = l.glucosa;
  add('glucosa', 'Glucemia en ayunas', g, 'mg/dL', g >= 126 ? 'alto' : g >= 100 ? 'limite' : g < 70 ? 'bajo' : 'ok',
    g >= 126 ? 'En rango de diabetes si se confirma' : g >= 100 ? 'Glucemia alterada en ayunas' : g < 70 ? 'Baja' : 'Normal', '70–99');
  const a = l.hba1c;
  add('hba1c', 'Hemoglobina glicosilada', a, '%', a >= 6.5 ? 'alto' : a >= 5.7 ? 'limite' : 'ok',
    dm ? (a <= 7 ? 'En objetivo habitual (≤ 7 %)' : 'Por encima del objetivo habitual (≤ 7 %)') : a >= 6.5 ? 'En rango de diabetes' : a >= 5.7 ? 'Prediabetes' : 'Normal', '< 5,7');
  add('homa', 'HOMA-IR', d.homa, '', d.homa >= 2.5 ? 'alto' : 'ok', d.homa >= 2.5 ? 'Sugiere insulinorresistencia' : 'Sin insulinorresistencia', '< 2,5');
  add('tyg', 'Índice TyG', d.tyg, '', d.tyg >= 8.8 ? 'alto' : d.tyg >= 8.5 ? 'limite' : 'ok', d.tyg >= 8.5 ? 'Marcador de insulinorresistencia' : 'Normal', '< 8,5');
  add('ct', 'Colesterol total', l.ct, 'mg/dL', l.ct >= 240 ? 'alto' : l.ct >= 200 ? 'limite' : 'ok', l.ct >= 240 ? 'Alto' : l.ct >= 200 ? 'Límite alto' : 'Deseable', '< 200');
  const hdlBajo = sexo === 'F' ? 50 : 40;
  add('hdl', 'Colesterol HDL', l.hdl, 'mg/dL', l.hdl < hdlBajo ? 'bajo' : 'ok', l.hdl < hdlBajo ? 'Bajo (factor de riesgo)' : 'Adecuado', `≥ ${hdlBajo}`);
  add('ldl', d.ldlMedido ? 'Colesterol LDL' : 'Colesterol LDL (calculado, Sampson)', d.ldl, 'mg/dL',
    d.ldl >= 190 ? 'alto' : d.ldl >= 160 ? 'alto' : d.ldl >= 130 ? 'limite' : 'ok',
    d.ldl >= 190 ? 'Muy alto: descartar hipercolesterolemia familiar' : d.ldl >= 160 ? 'Alto' : d.ldl >= 130 ? 'Límite alto' : 'Según objetivo por riesgo', 'según riesgo');
  add('nohdl', 'Colesterol no-HDL', d.noHdl, 'mg/dL', d.noHdl >= 160 ? 'alto' : d.noHdl >= 130 ? 'limite' : 'ok', 'Refleja todas las partículas aterogénicas', '< 130');
  add('tg', 'Triglicéridos', l.tg, 'mg/dL', l.tg >= 500 ? 'alto' : l.tg >= 150 ? 'limite' : 'ok', l.tg >= 500 ? 'Muy altos: riesgo de pancreatitis' : l.tg >= 175 ? 'Elevados (potenciador de riesgo)' : l.tg >= 150 ? 'Límite alto' : 'Normales', '< 150');
  add('tghdl', 'Cociente TG/HDL', d.tgHdl, '', d.tgHdl >= 3 ? 'alto' : 'ok', d.tgHdl >= 3 ? 'Perfil aterogénico / insulinorresistencia' : 'Normal', '< 3');
  add('lpa', 'Lipoproteína (a)', d.lpa, 'mg/dL', d.lpa >= 50 ? 'alto' : 'ok', d.lpa >= 50 ? 'Elevada: potenciador de riesgo (genético)' : 'Normal', '< 50 mg/dL (< 125 nmol/L)');
  add('apob', 'Apolipoproteína B', l.apob, 'mg/dL', l.apob >= 130 ? 'alto' : 'ok', l.apob >= 130 ? 'Elevada: potenciador de riesgo' : 'Normal', '< 130');
  add('pcr', 'PCR ultrasensible', l.pcr, 'mg/L', l.pcr >= 10 ? 'limite' : l.pcr >= 2 ? 'alto' : 'ok', l.pcr >= 10 ? 'Muy alta: descartar proceso agudo y repetir' : l.pcr >= 2 ? 'Inflamación de bajo grado (potenciador)' : 'Normal', '< 2');
  add('creatinina', 'Creatinina', l.creatinina, 'mg/dL', d.tfg < 60 ? 'alto' : 'ok', 'Se usa para el filtrado glomerular', sexo === 'F' ? '0,5–1,0' : '0,7–1,2');
  add('tfg', 'Filtrado glomerular (CKD-EPI 2021)', d.tfg, 'mL/min/1,73 m²', d.tfg < 30 ? 'alto' : d.tfg < 60 ? 'limite' : 'ok', d.erc ? `Estadio ${d.erc.g}` : '', '≥ 90');
  add('racu', 'Albuminuria (RACu)', l.racu, 'mg/g', l.racu > 300 ? 'alto' : l.racu >= 30 ? 'limite' : 'ok', l.racu >= 30 ? 'Albuminuria aumentada: daño renal' : 'Normal', '< 30');
  add('ast', 'AST (GOT)', l.ast, 'U/L', l.ast > 40 ? 'limite' : 'ok', l.ast > 40 ? 'Elevada' : 'Normal', '< 40');
  add('alt', 'ALT (GPT)', l.alt, 'U/L', l.alt > (sexo === 'F' ? 33 : 40) ? 'limite' : 'ok', l.alt > 33 ? 'Elevada' : 'Normal', sexo === 'F' ? '< 33' : '< 40');
  if (Number.isFinite(d.fib4)) {
    const corteBajo = edad >= 65 ? 2 : 1.3;
    add('fib4', 'FIB-4 (fibrosis hepática)', d.fib4, '', d.fib4 > 2.67 ? 'alto' : d.fib4 >= corteBajo ? 'limite' : 'ok',
      d.fib4 > 2.67 ? 'Riesgo alto de fibrosis avanzada: derivar a hepatología' : d.fib4 >= corteBajo ? 'Indeterminado: elastografía' : 'Fibrosis avanzada poco probable', `< ${String(corteBajo).replace('.', ',')}`);
  }
  add('tsh', 'TSH', l.tsh, 'µUI/mL', l.tsh > 4.5 ? 'alto' : l.tsh < 0.4 ? 'bajo' : 'ok', l.tsh > 4.5 ? 'Elevada: descartar hipotiroidismo' : l.tsh < 0.4 ? 'Baja' : 'Normal', '0,4–4,5');
  add('urico', 'Ácido úrico', l.acidoUrico, 'mg/dL', l.acidoUrico > (sexo === 'F' ? 6 : 7) ? 'limite' : 'ok', l.acidoUrico > 6 ? 'Elevado' : 'Normal', sexo === 'F' ? '< 6' : '< 7');
  add('insulina', 'Insulina basal', l.insulina, 'µU/mL', l.insulina > 15 ? 'limite' : 'ok', l.insulina > 15 ? 'Hiperinsulinemia' : 'Normal', '< 15');
  return out;
}
