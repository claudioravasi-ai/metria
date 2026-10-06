/* ============================================================
   Orquestador del motor: arma la evaluación completa de un paciente
   a partir de su perfil y su ficha clínica. Se recalcula en cada cambio
   (es puro y tarda < 1 ms), así que todas las vistas están siempre al día.
   ============================================================ */

import * as A from './anthro.js';
import * as L from './labs.js';
import * as R from './risk.js';
import * as O from './obesity.js';
import * as G from './glp1.js';
import { banderas } from './meds.js';

const n = (v) => (v === '' || v == null ? null : Number.isFinite(+v) ? +v : null);

/** Normaliza números que pueden venir como texto desde los formularios. */
function numeros(o = {}) {
  const r = {};
  for (const [k, v] of Object.entries(o)) r[k] = typeof v === 'string' && /^-?\d+([.,]\d+)?$/.test(v.trim()) ? +v.replace(',', '.') : v;
  return r;
}

const CLAVE = [
  ['perfil.fechaNac', 'Fecha de nacimiento'], ['perfil.sexo', 'Sexo'],
  ['antropo.talla', 'Talla'], ['antropo.peso', 'Peso'], ['antropo.cintura', 'Cintura'],
  ['vitales.pas', 'Presión sistólica'], ['vitales.pad', 'Presión diastólica'],
  ['habitos.tabaco', 'Tabaco'], ['habitos.actividad', 'Actividad física'],
  ['labs.ct', 'Colesterol total'], ['labs.hdl', 'HDL'], ['labs.tg', 'Triglicéridos'],
  ['labs.glucosa', 'Glucemia'], ['labs.creatinina', 'Creatinina'], ['labs.hba1c', 'HbA1c'],
];

export function evaluarPaciente(perfil = {}, cl = {}, hoy = new Date()) {
  const an = numeros(cl.antropo), vit = numeros(cl.vitales), labs = numeros(cl.labs);
  const hab = cl.habitos || {}, pat = cl.patologias || {}, fam = cl.familia || {}, sint = cl.sintomas || {};
  const meds = cl.meds || [];
  const edad = A.edad(perfil.fechaNac, hoy);
  const sexo = perfil.sexo === 'M' ? 'M' : 'F';
  const b = banderas(meds);

  const comp = A.composicion({ peso: an.peso, talla: an.talla, edad, sexo, cintura: an.cintura, cadera: an.cadera, grasa: an.grasa });
  const ener = A.energia({ peso: an.peso, talla: an.talla, edad, sexo, grasa: comp?.grasa?.usada, actividad: hab.actividad });
  const der = L.derivados(labs, { edad, sexo });
  const dm = !!(pat.dm2 || pat.dm1);
  const labsInt = L.interpretar(labs, der, { edad, sexo, dm });
  const glucemia = L.estadoGlucemico(labs.glucosa, labs.hba1c, dm);
  const pa = R.categoriaPresion(vit.pas, vit.pad);
  const sm = R.sindromeMetabolico({ sexo, cintura: an.cintura, tg: labs.tg, hdl: labs.hdl, pas: vit.pas, pad: vit.pad, glucosa: labs.glucosa, pat, meds: b });

  // PREVENT necesita el filtrado: sin creatinina se asume 90 y se avisa.
  const tfgSupuesta = !Number.isFinite(der.tfg);
  const preventIn = {
    edad, sexo, ct: labs.ct, hdl: labs.hdl, pas: vit.pas,
    tratHta: b.antihipertensivo, estatina: b.estatina, dm, tabaco: hab.tabaco === 'actual',
    tfg: tfgSupuesta ? 90 : der.tfg, imc: comp?.imc,
  };
  const prev = R.prevent(preventIn);
  if (prev.ok && tfgSupuesta) prev.avisos.unshift('Sin creatinina: se asumió un filtrado de 90 mL/min. Cargá la creatinina para mayor precisión.');
  if (prev.ok && glucemia?.id === 'dm-lab') prev.avisos.push('El laboratorio está en rango de diabetes sin diagnóstico cargado: confirmar.');
  const fram = R.framingham(preventIn);

  const clinica = R.categoriaClinica({ pat, erc: der.erc, tfg: der.tfg, ldl: der.ldl, pas: vit.pas, pad: vit.pad });
  const pot = R.potenciadores({ pat, fam, labs, der, sm });
  let categoria = null;
  if (clinica) categoria = { ...clinica, fuente: 'clinica' };
  else if (prev.ok) {
    const c = R.categoriaAscvd10(prev.ascvd10);
    categoria = { ...c, fuente: 'prevent', motivos: [`PREVENT: ${prev.ascvd10.toFixed(1).replace('.', ',')} % de riesgo aterosclerótico a 10 años`] };
    if ((c.id === 'limite' || c.id === 'bajo') && pot.length >= 2) categoria.sugerirSubir = true;
  }
  const ldlObjetivo = categoria ? R.objetivoLdl(categoria.id) : null;
  const contrib = prev.ok ? R.contribuciones(preventIn) : null;
  const findrisc = dm ? null : R.findrisc({
    edad, imc: comp?.imc, cintura: an.cintura, sexo,
    actividad30: hab.actividad && hab.actividad !== 'sedentario', frutasVerduras: !!hab.frutasVerduras,
    antihipertensivo: b.antihipertensivo, glucosaAltaPrevia: !!(pat.glucosaAltaPrevia || pat.prediabetes), famDm: fam.dm2,
  });
  const eoss = O.eoss({ pat, sintomas: sint, pa: pa?.id, glucemia: glucemia?.id, fib4: der.fib4 });
  const lancet = O.obesidadClinica({ imc: comp?.imc, comp, pat, sintomas: sint, der, labs, sexo });
  const glp1 = G.evaluar({
    edad, sexo, imc: comp?.imc, peso: an.peso, talla: an.talla, pat, fam, meds, labs,
    tfg: der.tfg, erc: der.erc, fib4: der.fib4, alcohol: hab.alcohol, comp,
    prefiereOral: !!cl.preferencias?.oral, glucemia: glucemia?.id, ldl: der.ldl, pas: vit.pas, pad: vit.pad,
  });

  const fuentes = { perfil, antropo: an, vitales: vit, habitos: hab, labs };
  const faltan = CLAVE.filter(([ruta]) => {
    const [o, k] = ruta.split('.');
    const v = fuentes[o]?.[k];
    return v === undefined || v === null || v === '';
  }).map(([, t]) => t);

  return {
    edad, sexo, antropo: an, vitales: vit, habitos: hab, pat, fam, meds, labs, banderas: b,
    comp, ener, der, labsInt, glucemia, pa, sm,
    prevent: prev, preventIn, tfgSupuesta, framingham: fram, clinica, categoria, potenciadores: pot,
    ldlObjetivo, contrib, findrisc, eoss, lancet, glp1,
    completitud: { pct: Math.round(((CLAVE.length - faltan.length) / CLAVE.length) * 100), faltan },
  };
}

/** Resumen corto para el índice que ven los médicos (sin diagnósticos en texto). */
export function resumenIndice(ev) {
  return {
    imc: ev.comp?.imc ? Math.round(ev.comp.imc * 10) / 10 : null,
    riesgo: ev.categoria?.id || null,
    glp1: ev.glp1?.veredicto || null,
    completo: ev.completitud.pct,
  };
}

export { n as aNumero };
