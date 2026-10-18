/* ============================================================
   Riesgo e intervalo de la próxima endoscopia (vigilancia)
   A partir del informe que carga el endoscopista al terminar el
   estudio y, después, de la anatomía patológica.
   Guías (revisadas en la web el 16-10-2026):
   - Colon: ESGE «Post-polypectomy colonoscopy surveillance — Update 2020»
     (Hassan y col., Endoscopy 2020;52:687-700). Referencia: USMSTF 2020.
   - Preparación inadecuada: ESGE «Bowel preparation — Update 2019».
   - Barrett: ESGE 2023 (Weusten y col., Endoscopy 2023;55:1124-46).
   - Estómago: MAPS III 2025 (ESGE/EHMSG/ESP, Endoscopy 2025).
   - Esofagitis y úlcera: guía ACG 2022 de ERGE y práctica ESGE/ACG.
   Es apoyo a la decisión: el intervalo final lo decide el médico.
   ============================================================ */

const CAT = {
  bajo: { nombre: 'Riesgo bajo', tono: 'ok', orden: 0 },
  intermedio: { nombre: 'Riesgo intermedio', tono: 'aviso', orden: 1 },
  alto: { nombre: 'Riesgo alto', tono: 'peligro', orden: 2 },
  'muy-alto': { nombre: 'Riesgo muy alto', tono: 'peligro', orden: 3 },
};
export const CATEGORIAS = CAT;

/* serie: intervalos sucesivos (meses) si cada control sale normal; sin serie, el control es único.
   proximo: tipo del próximo estudio cuando no es el mismo (p. ej. rectoscopia → colonoscopia). */
const r = (riesgo, meses, texto, guia, extra = {}) => ({ riesgo, meses, texto, guia, ...extra });

/** Rastreo de colon después de una colonoscopia sin hallazgos de riesgo: criterio del consultorio
 *  (decisión de CLAU, 17-10-2026) = 5 años. ESGE 2020 y USMSTF indican 10 años. */
export const RASTREO_COLON_MESES = 60;
const RASTREO_TXT = 'a los 5 años (criterio del consultorio; ESGE 2020 indica 10 años)';

/** Endoscopia alta. a: datos del informe; edad en años. */
export function evaluarAlta(a = {}, { edad } = {}) {
  const out = [];
  const largo = Math.max(+a.barrettM || 0, +a.barrettC || 0);
  if (a.neoplasia) out.push(r('muy-alto', 0, 'Lesión sospechosa de neoplasia: completar estudio y estadificación; la conducta depende de la anatomía patológica.', 'ESGE'));
  if (a.barrett) {
    const d = a.barrettDisplasia || 'sin-dato';
    if (['alto', 'cancer'].includes(d)) out.push(r('muy-alto', 0, 'Barrett con displasia de alto grado o cáncer temprano: derivar a un centro experto para resección endoscópica y ablación.', 'ESGE Barrett 2023'));
    else if (d === 'bajo') out.push(r('alto', 6, 'Barrett con displasia de bajo grado: confirmar con un segundo patólogo experto; si se confirma, tratamiento endoscópico (ablación) en centro experto o control a los 6 meses.', 'ESGE Barrett 2023', { serie: [6, 12, 12, 12, 12, 12, 12, 12, 12, 12] }));
    else if (d === 'indefinida') out.push(r('intermedio', 6, 'Displasia indefinida: optimizar inhibidores de bomba y repetir la endoscopia con biopsias a los 6 meses.', 'ESGE Barrett 2023'));
    else if (largo >= 10) out.push(r('alto', 36, `Barrett de ${largo} cm (≥ 10 cm): vigilancia en un centro experto en Barrett.`, 'ESGE Barrett 2023', { serie: [36, 36, 36, 36] }));
    else if (largo >= 3) out.push(r('intermedio', 36, `Barrett de ${largo} cm (3 a < 10 cm) sin displasia: control cada 3 años.`, 'ESGE Barrett 2023', { serie: [36, 36, 36, 36] }));
    else if (largo >= 1) out.push(r('intermedio', 60, `Barrett de ${largo} cm (1 a < 3 cm) sin displasia: control cada 5 años.`, 'ESGE Barrett 2023', { serie: [60, 60] }));
    else out.push(r('bajo', null, 'Línea Z irregular o Barrett < 1 cm: no requiere vigilancia endoscópica.', 'ESGE Barrett 2023'));
    if (edad >= 75) out.at(-1).nota = 'Con 75 años o más, o expectativa de vida menor a 5 años, puede considerarse suspender la vigilancia.';
  }
  if (['C', 'D'].includes(a.esofagitis)) out.push(r('intermedio', 3, `Esofagitis Los Ángeles ${a.esofagitis}: repetir la endoscopia después de 8 a 12 semanas de inhibidores de bomba para confirmar la curación y descartar Barrett.`, 'ACG 2022 (ERGE)'));
  if (a.ulceraGastrica) out.push(r('intermedio', 3, 'Úlcera gástrica: control endoscópico a las 8-12 semanas del tratamiento para confirmar la cicatrización (con biopsias si no se tomaron o el aspecto fue dudoso).', 'ESGE / ACG'));
  // Estómago: MAPS III 2025
  const olga = +a.olga || 0;
  const factoresGastricos = !!(a.familiarGastrico || a.miIncompleta || a.hpPersistente);
  if (a.atrofia === 'extensa' || olga >= 3) out.push(r('alto', 36, `Atrofia o metaplasia intestinal extensa${olga >= 3 ? ` (OLGA/OLGIM ${['', 'I', 'II', 'III', 'IV'][olga]})` : ''}: endoscopia de alta calidad cada 3 años.`, 'MAPS III 2025', { serie: [36, 36, 36, 36] }));
  else if (a.atrofia === 'antro' || [1, 2].includes(olga)) {
    out.push(factoresGastricos
      ? r('intermedio', 36, 'Atrofia o metaplasia limitada al antro con factores de riesgo (familiar de 1.er grado con cáncer gástrico, metaplasia incompleta o H. pylori persistente): considerar control a los 3 años.', 'MAPS III 2025', { serie: [36, 36, 36, 36] })
      : r('bajo', null, 'Atrofia o metaplasia leve a moderada limitada al antro, sin otros factores de riesgo: no requiere vigilancia endoscópica.', 'MAPS III 2025'));
  }
  if (a.hp) out.push(r('bajo', null, 'Helicobacter pylori: tratar y confirmar la erradicación con test de aire espirado o antígeno en materia fecal (no hace falta otra endoscopia solo para eso).', 'MAPS III 2025 / Maastricht VI'));
  if (a.poliposGastricos === 'adenoma') out.push(r('alto', 12, 'Adenoma gástrico resecado: control endoscópico al año y luego según hallazgos.', 'ESGE', { serie: [12, 36, 36] }));
  if (a.poliposGastricos === 'hiperplasicos') out.push(r('bajo', 12, 'Pólipos hiperplásicos: erradicar H. pylori; si eran grandes (> 10 mm) o múltiples, control al año.', 'ESGE'));
  if (!out.length) out.push(r('bajo', null, 'Endoscopia alta sin hallazgos que requieran vigilancia: nueva endoscopia solo si aparecen síntomas o hay otra indicación.', 'ESGE'));
  if (edad >= 80 && out.some((x) => x.guia.startsWith('MAPS'))) out.push(r('bajo', null, 'Con 80 años o más y sin síntomas, MAPS III sugiere no iniciar o suspender la vigilancia gástrica.', 'MAPS III 2025'));
  return out;
}

/** Colonoscopia. b: datos del informe. */
export function evaluarBaja(b = {}, { edad } = {}) {
  const out = [];
  const adenomas = +b.adenomas || 0, serrados = +b.serrados || 0, tam = +b.tamanoMax || 0;
  if (b.neoplasia) out.push(r('muy-alto', 0, 'Lesión sospechosa de cáncer: estadificación y derivación a oncología/cirugía; la vigilancia se define después del tratamiento.', 'ESGE'));
  if (b.incompleta) out.push(r('intermedio', 3, 'Colonoscopia incompleta (no se llegó al ciego): completar a la brevedad con nueva colonoscopia o colonografía por tomografía.', 'ESGE', { serie: [3, RASTREO_COLON_MESES] }));
  if (b.preparacion === 'inadecuada') out.push(r('intermedio', 12, 'Preparación inadecuada (Boston < 6 o algún segmento < 2): repetir dentro del año, con preparación reforzada.', 'ESGE preparación 2019', { serie: [12, RASTREO_COLON_MESES] }));
  if (b.piecemeal) out.push(r('muy-alto', 6, 'Pólipo ≥ 20 mm resecado en fragmentos (piecemeal): control del sitio a los 3-6 meses y luego a los 12 meses.', 'ESGE 2020', { serie: [6, 12, 36, 60] }));
  if (adenomas >= 10) out.push(r('muy-alto', 12, '10 o más adenomas: control al año y asesoramiento genético (descartar poliposis).', 'ESGE 2020', { serie: [12, 12, 12, 12, 12, 12, 12, 12, 12, 12] }));
  const altoRiesgo = [];
  if (adenomas >= 5) altoRiesgo.push('5 o más adenomas');
  if (adenomas && tam >= 10) altoRiesgo.push('adenoma ≥ 10 mm');
  if (b.displasiaAlta) altoRiesgo.push('adenoma con displasia de alto grado');
  if (serrados && b.serradoGrande) altoRiesgo.push('pólipo serrado ≥ 10 mm');
  if (serrados && b.serradoDisplasia) altoRiesgo.push('pólipo serrado con displasia');
  if (altoRiesgo.length && adenomas < 10 && !b.piecemeal) out.push(r('alto', 36, `Pólipos de alto riesgo (${altoRiesgo.join(', ')}): colonoscopia de vigilancia a los 3 años. Si ese control es normal, el siguiente a los 5 años.`, 'ESGE 2020', { usmstf: 'USMSTF 2020: 3 años.', serie: [36, 60, RASTREO_COLON_MESES] }));
  else if (!altoRiesgo.length && (adenomas || serrados)) out.push(r('bajo', RASTREO_COLON_MESES, `Pólipos de bajo riesgo (${adenomas ? `${adenomas} adenoma${adenomas > 1 ? 's' : ''} < 10 mm sin displasia de alto grado` : ''}${adenomas && serrados ? ' y ' : ''}${serrados ? `${serrados} serrado${serrados > 1 ? 's' : ''} < 10 mm sin displasia` : ''}): sin vigilancia especial; volver al rastreo (test de sangre oculta) o nueva colonoscopia ${RASTREO_TXT}.`, 'ESGE 2020',
    { usmstf: adenomas <= 2 && !serrados ? 'USMSTF 2020: 7 a 10 años.' : 'USMSTF 2020: 3 a 5 años.' }));
  if (b.hiperplasicos && !adenomas && !serrados) out.push(r('bajo', RASTREO_COLON_MESES, `Pólipos hiperplásicos pequeños de recto-sigma: no aumentan el riesgo; nueva colonoscopia ${RASTREO_TXT}.`, 'ESGE 2020', { serie: [RASTREO_COLON_MESES, RASTREO_COLON_MESES] }));
  if (!out.length) out.push(r('bajo', RASTREO_COLON_MESES, `Colonoscopia completa, con buena preparación y sin pólipos: nueva colonoscopia de rastreo ${RASTREO_TXT} (antes si aparecen síntomas o antecedentes familiares nuevos).`, 'ESGE 2020', { serie: [RASTREO_COLON_MESES, RASTREO_COLON_MESES] }));
  if (b.familiarCCR) out.push(r('intermedio', 60, 'Familiar de 1.er grado con cáncer colorrectal: el rastreo suele hacerse cada 5 años (según la edad del familiar); aplicar el intervalo más corto.', 'Consensos de rastreo', { serie: [60, 60] }));
  if (edad >= 80) out.push(r('bajo', null, 'Con 80 años o más, ESGE sugiere suspender la vigilancia según comorbilidades y expectativa de vida.', 'ESGE 2020'));
  return out;
}

/** Rectosigmoidoscopia: si aparecen adenomas, hay que estudiar todo el colon. */
export function evaluarRsc(b = {}) {
  const out = [];
  if (b.neoplasia) out.push(r('muy-alto', 0, 'Lesión sospechosa de cáncer: biopsias, estadificación y colonoscopia completa.', 'ESGE'));
  if ((+b.adenomas || 0) > 0 || (+b.serrados || 0) > 0 && b.serradoGrande) out.push(r('alto', 3, 'Adenoma (o serrado ≥ 10 mm) en el recto-sigma: completar con una colonoscopia total para estudiar el resto del colon.', 'ESGE / USMSTF', { proximo: 'vcc' }));
  if (b.preparacion === 'inadecuada') out.push(r('intermedio', 3, 'Preparación inadecuada con enemas: repetir el estudio con mejor preparación.', 'ESGE'));
  if (b.hiperplasicos && !out.length) out.push(r('bajo', 60, 'Solo pólipos hiperplásicos pequeños: no requiere colonoscopia por este hallazgo; rastreo según edad y antecedentes.', 'ESGE 2020'));
  if (!out.length) out.push(r('bajo', 60, 'Rectosigmoidoscopia sin hallazgos de riesgo: si fue de rastreo, repetir a los 5 años o pasar a colonoscopia / test de sangre oculta según el programa.', 'USMSTF / ACS', { serie: [60, 60] }));
  return out;
}

/**
 * Resultado completo para un turno.
 * informe: { alta, baja, biopsias, histoCargada, edad }
 */
export function evaluarVigilancia(tipo, informe = {}, { edad, fechaEstudio } = {}) {
  const partes = [];
  if (['veda', 'doble'].includes(tipo)) partes.push({ id: 'alta', nombre: 'Endoscopia alta', items: evaluarAlta(informe.alta, { edad }) });
  if (['vcc', 'doble'].includes(tipo)) partes.push({ id: 'baja', nombre: 'Colonoscopia', items: evaluarBaja(informe.baja, { edad }) });
  if (tipo === 'rsc') partes.push({ id: 'rsc', nombre: 'Rectosigmoidoscopia', items: evaluarRsc(informe.baja, { edad }) });
  for (const p of partes) {
    p.riesgo = p.items.reduce((m, x) => (CAT[x.riesgo].orden > CAT[m].orden ? x.riesgo : m), 'bajo');
    const conIntervalo = p.items.filter((x) => Number.isFinite(x.meses));
    p.meses = conIntervalo.length ? Math.min(...conIntervalo.map((x) => x.meses)) : null;
    p.fecha = fechaEstudio && Number.isFinite(p.meses) ? sumarMeses(fechaEstudio, p.meses) : null;
  }
  const provisorio = !!informe.biopsias && !informe.histoCargada;
  return { partes, provisorio, riesgo: partes.reduce((m, p) => (CAT[p.riesgo].orden > CAT[m].orden ? p.riesgo : m), 'bajo') };
}

export function sumarMeses(iso, meses) {
  const d = new Date(`${iso}T12:00:00`);
  d.setMonth(d.getMonth() + meses);
  return d.toISOString().slice(0, 10);
}

export function textoIntervalo(meses) {
  if (meses === null || meses === undefined) return 'Sin vigilancia programada';
  if (meses === 0) return 'Conducta inmediata';
  if (meses < 12) return `En ${meses} meses`;
  const a = meses / 12;
  return `En ${Number.isInteger(a) ? a : a.toFixed(1).replace('.', ',')} año${a > 1 ? 's' : ''}`;
}

export const VERSION_REGLAS = 'reglas-2026-10';

export const AVISO_HISTO = 'Recomendación provisoria: se tomaron biopsias o se resecaron pólipos. La categoría de riesgo y el intervalo pueden cambiar cuando llegue el informe de anatomía patológica.';
