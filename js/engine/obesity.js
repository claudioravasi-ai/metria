/* ============================================================
   Estadificación de la obesidad
   - Edmonton Obesity Staging System (Sharma y Kushner, 2009).
   - Obesidad clínica / preclínica (Comisión de The Lancet Diabetes &
     Endocrinology, Rubino et al., enero 2025): el IMC solo no alcanza;
     el exceso de adiposidad se confirma con otra medida y la obesidad
     "clínica" exige disfunción de órganos o limitación de la vida diaria.
   ============================================================ */

/** Comorbilidades relacionadas con el peso (las que habilitan GLP-1 con IMC ≥ 27). */
export const COMORBILIDADES_PESO = [
  ['hta', 'Hipertensión arterial'],
  ['dm2', 'Diabetes tipo 2'],
  ['prediabetes', 'Prediabetes'],
  ['dislipemia', 'Dislipemia'],
  ['sahos', 'Apnea obstructiva del sueño'],
  ['iam', 'Infarto previo'], ['acv', 'ACV previo'], ['eap', 'Enfermedad arterial periférica'], ['revasc', 'Revascularización coronaria'],
  ['ic', 'Insuficiencia cardíaca'],
  ['higadoGraso', 'Hígado graso (MASLD/MASH)'],
  ['artrosis', 'Artrosis de rodilla o cadera'],
  ['sop', 'Síndrome de ovario poliquístico'],
  ['erc', 'Enfermedad renal crónica'],
];

export function comorbilidades(pat = {}, extra = {}) {
  const lista = COMORBILIDADES_PESO.filter(([k]) => pat[k]).map(([, n]) => n);
  if (extra.ercLab && !pat.erc) lista.push('Enfermedad renal crónica (por laboratorio)');
  if (extra.prediabetesLab && !pat.prediabetes && !pat.dm2) lista.push('Prediabetes (por laboratorio)');
  if (extra.dislipemiaLab && !pat.dislipemia) lista.push('Dislipemia (por laboratorio)');
  if (extra.htaPa && !pat.hta) lista.push('Presión arterial elevada en la medición');
  return lista;
}

/** Edmonton (EOSS) estimado. El médico puede corregirlo. */
export function eoss({ pat = {}, sintomas = {}, pa, glucemia, fib4 }) {
  const m = [];
  // Estadio 3: daño de órgano
  if (pat.iam || pat.acv || pat.ic || pat.revasc) m.push([3, 'Daño de órgano blanco cardiovascular']);
  if (pat.retinopatia || pat.neuropatia) m.push([3, 'Complicaciones de la diabetes']);
  if (pat.limitacionActividades) m.push([3, 'Limitación importante de la vida diaria']);
  if (Number.isFinite(fib4) && fib4 > 2.67) m.push([3, 'Probable fibrosis hepática avanzada']);
  // Estadio 2: enfermedad crónica establecida
  const est2 = [['hta', 'Hipertensión'], ['dm2', 'Diabetes tipo 2'], ['sahos', 'Apnea del sueño'], ['artrosis', 'Artrosis'], ['sop', 'Ovario poliquístico'], ['depresion', 'Depresión'], ['higadoGraso', 'Hígado graso'], ['erc', 'Enfermedad renal'], ['dislipemia', 'Dislipemia']];
  for (const [k, n] of est2) if (pat[k]) m.push([2, n]);
  if (sintomas.dolorRodillaCadera) m.push([2, 'Dolor articular con limitación']);
  // Estadio 1: factores subclínicos
  if (pat.prediabetes || glucemia === 'pre') m.push([1, 'Glucemia alterada']);
  if (pa === 'elevada' || pa === 'e1') m.push([1, 'Presión arterial limítrofe']);
  if (sintomas.disnea) m.push([1, 'Disnea con esfuerzo moderado']);
  const estadio = m.reduce((a, [e]) => Math.max(a, e), 0);
  return { estadio, motivos: m.filter(([e]) => e === estadio).map(([, t]) => t), todos: m };
}

/** Comisión Lancet 2025: exceso de adiposidad confirmado y obesidad clínica vs. preclínica. */
export function obesidadClinica({ imc, comp, pat = {}, sintomas = {}, der = {}, labs = {}, sexo }) {
  if (!Number.isFinite(imc)) return null;
  const confirmaciones = [];
  if (comp?.cintura?.muyElevado || comp?.cintura?.elevado) confirmaciones.push('Perímetro de cintura aumentado');
  if (comp?.ict?.nivel && comp.ict.nivel !== 'normal') confirmaciones.push('Índice cintura/talla ≥ 0,5');
  if (comp?.icc?.elevado) confirmaciones.push('Índice cintura/cadera elevado');
  if (Number.isFinite(comp?.grasa?.medida) && comp.grasa.medida >= (sexo === 'F' ? 35 : 25)) confirmaciones.push('Porcentaje de grasa medido elevado');

  const exceso = imc >= 40 || (imc >= 30 && confirmaciones.length > 0) || (imc >= 25 && imc < 30 && confirmaciones.length >= 1 && (comp?.ict?.nivel === 'alto' || comp?.cintura?.muyElevado));
  const sinConfirmar = imc >= 30 && imc < 40 && confirmaciones.length === 0;

  const criterios = [];
  if (pat.sahos) criterios.push('Vías aéreas: apnea obstructiva del sueño');
  if (pat.ic) criterios.push('Corazón: insuficiencia cardíaca');
  if (pat.fa) criterios.push('Corazón: fibrilación auricular');
  if (pat.hta) criterios.push('Circulación: presión arterial elevada');
  const metab = (pat.dm2 || pat.prediabetes || labs.glucosa >= 100) && (labs.tg >= 150 || (Number.isFinite(labs.hdl) && labs.hdl < (sexo === 'F' ? 50 : 40)));
  if (metab || pat.dm2) criterios.push('Metabolismo: hiperglucemia con dislipemia aterogénica');
  if (pat.higadoGraso && (der.fib4 >= 1.3 || pat.mash)) criterios.push('Hígado: esteatosis con fibrosis');
  if (der.erc?.erc) criterios.push('Riñón: filtrado bajo o albuminuria');
  if (pat.sop) criterios.push('Reproductivo: anovulación / ovario poliquístico');
  if (pat.hipogonadismo) criterios.push('Reproductivo: hipogonadismo masculino');
  if (sintomas.dolorRodillaCadera || pat.artrosis) criterios.push('Osteoarticular: dolor de rodilla o cadera con limitación');
  if (sintomas.incontinencia) criterios.push('Urinario: incontinencia recurrente');
  if (sintomas.linfedema) criterios.push('Linfático: linfedema de miembros inferiores');
  if (sintomas.disnea) criterios.push('Respiratorio: disnea por la obesidad');
  if (pat.limitacionActividades) criterios.push('Limitación de las actividades de la vida diaria');

  let id = 'sin-exceso', nombre = 'Sin exceso de adiposidad confirmado';
  if (exceso) {
    id = criterios.length ? 'clinica' : 'preclinica';
    nombre = criterios.length ? 'Obesidad clínica' : 'Obesidad preclínica';
  } else if (sinConfirmar) {
    id = 'a-confirmar'; nombre = 'IMC de obesidad: falta confirmar con cintura o % de grasa';
  }
  return { id, nombre, exceso, confirmaciones, criterios };
}
