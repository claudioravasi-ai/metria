/* ============================================================
   Seguimiento a 10 años: de los hallazgos de la endoscopia (y, cuando
   llega, de la anatomía patológica) a controles con fecha.

   Dos tiempos:
   - Provisorio: el día del estudio, con el diagnóstico presuntivo de cada lesión.
   - Definitivo: con la histología de cada frasco, que reemplaza al presuntivo.

   Las reglas clínicas son las de vigilancia.js (ESGE 2020, ESGE Barrett 2023,
   MAPS III 2025, ACG 2022). Este módulo traduce los hallazgos a esas reglas,
   arma el próximo control y la proyección suponiendo controles normales.
   Es apoyo a la decisión: la fecha final la firma el médico.
   ============================================================ */

import { evaluarVigilancia, sumarMeses, VERSION_REGLAS } from './vigilancia.js';

export const HORIZONTE_MESES = 120;
export const DIAS_AVISO_PACIENTE = 30;
export const DIAS_RECORDATORIO_AP = 30;
export const MESES_UNION = 6;

/* ---------- Catálogo de hallazgos ---------- */
export const ORGANOS = {
  esofago: { nombre: 'Esófago', parte: 'alta' },
  estomago: { nombre: 'Estómago', parte: 'alta' },
  duodeno: { nombre: 'Duodeno', parte: 'alta' },
  colon: { nombre: 'Colon', parte: 'baja' },
  recto: { nombre: 'Recto', parte: 'baja' },
};

export const SEGMENTOS = {
  esofago: ['Tercio superior', 'Tercio medio', 'Tercio inferior', 'Unión esófago-gástrica'],
  estomago: ['Cardias', 'Fondo', 'Cuerpo', 'Ángulo', 'Antro', 'Píloro'],
  duodeno: ['Bulbo', 'Segunda porción'],
  colon: ['Ciego', 'Ascendente', 'Transverso', 'Descendente', 'Sigma'],
  recto: ['Recto'],
};

/** Tipos por órgano. dx: diagnósticos posibles (presuntivo o histológico). */
export const TIPOS = {
  barrett: { nombre: 'Esófago de Barrett', organos: ['esofago'], dx: ['barrett-sin', 'barrett-indefinida', 'barrett-bajo', 'barrett-alto', 'cancer', 'no-barrett'] },
  esofagitis: { nombre: 'Esofagitis', organos: ['esofago'], dx: [] },
  atrofia: { nombre: 'Atrofia / metaplasia intestinal', organos: ['estomago'], dx: ['gastritis-atrofica', 'gastritis-cronica'] },
  ulcera: { nombre: 'Úlcera', organos: ['estomago', 'duodeno'], dx: ['ulcera-benigna', 'cancer'] },
  'polipo-gastrico': { nombre: 'Pólipo gástrico', organos: ['estomago', 'duodeno'], dx: ['glandulas-fundicas', 'hiperplasico-gastrico', 'adenoma-gastrico', 'cancer'] },
  polipo: { nombre: 'Pólipo', organos: ['colon', 'recto'], dx: ['adenoma-bajo', 'adenoma-alto', 'serrado', 'serrado-displasia', 'hiperplasico', 'no-neoplasico', 'cancer'] },
  sospechosa: { nombre: 'Lesión sospechosa de neoplasia', organos: ['esofago', 'estomago', 'duodeno', 'colon', 'recto'], dx: ['cancer', 'benigna'] },
};

export const DX = {
  'barrett-sin': 'Barrett sin displasia',
  'barrett-indefinida': 'Barrett, displasia indefinida',
  'barrett-bajo': 'Barrett con displasia de bajo grado',
  'barrett-alto': 'Barrett con displasia de alto grado',
  'no-barrett': 'Sin metaplasia intestinal (no es Barrett)',
  'gastritis-atrofica': 'Gastritis atrófica / metaplasia intestinal',
  'gastritis-cronica': 'Gastritis crónica sin atrofia',
  'ulcera-benigna': 'Úlcera benigna',
  'glandulas-fundicas': 'Pólipo de glándulas fúndicas',
  'hiperplasico-gastrico': 'Pólipo hiperplásico',
  'adenoma-gastrico': 'Adenoma gástrico',
  'adenoma-bajo': 'Adenoma sin displasia de alto grado',
  'adenoma-alto': 'Adenoma con displasia de alto grado',
  serrado: 'Lesión serrada sésil sin displasia',
  'serrado-displasia': 'Lesión serrada con displasia',
  hiperplasico: 'Pólipo hiperplásico',
  'no-neoplasico': 'No neoplásico (inflamatorio, linfoide, mucosa normal)',
  cancer: 'Cáncer / adenocarcinoma',
  benigna: 'Benigna',
};

export const TECNICAS = [['ninguna', 'Sin resección'], ['biopsia', 'Biopsia con pinza'], ['pinza', 'Polipectomía con pinza'], ['asa-fria', 'Asa fría'], ['asa-caliente', 'Asa caliente'], ['mucosectomia', 'Mucosectomía (en bloque)'], ['fragmentos', 'En fragmentos (piecemeal)'], ['dse', 'Disección submucosa']];
export const PARIS = ['0-Ip', '0-Is', '0-Isp', '0-IIa', '0-IIb', '0-IIc', '0-III', 'LST'];

/** Antecedentes del paciente que cambian intervalos. */
export const ANTECEDENTES_SEG = [
  ['familiarCCR', 'Familiar de 1.er grado con cáncer colorrectal'],
  ['familiarGastrico', 'Familiar de 1.er grado con cáncer gástrico'],
  ['hpPersistente', 'H. pylori persistente (falla de erradicación)'],
  ['sindromeHereditario', 'Lynch, poliposis u otro síndrome hereditario (seguimiento especial)'],
  ['eii', 'Enfermedad inflamatoria intestinal (seguimiento especial)'],
];

export const ESTADOS_CONTROL = {
  inmediato: { nombre: 'Conducta inmediata', tono: 'peligro' },
  provisorio: { nombre: 'Provisorio', tono: 'aviso' },
  definitivo: { nombre: 'Definitivo', tono: 'ok' },
  proyectado: { nombre: 'Proyectado', tono: 'neutro' },
  turno: { nombre: 'Con turno', tono: 'ok' },
  realizado: { nombre: 'Realizado', tono: 'neutro' },
  reemplazado: { nombre: 'Reemplazado', tono: 'neutro' },
  anulado: { nombre: 'Anulado', tono: 'neutro' },
};
export const ESTUDIO_DE_PARTE = { alta: 'veda', baja: 'vcc', rsc: 'rsc' };
export const NOMBRE_ESTUDIO = { veda: 'VEDA', vcc: 'VCC', rsc: 'Rectosigmoidoscopia', doble: 'VEDA + VCC' };

/* ---------- Hallazgos → datos del motor ---------- */
const num = (x) => (Number.isFinite(+x) && x !== '' && x !== null ? +x : 0);

/** ¿El hallazgo llevó material a anatomía patológica? */
export const llevaFrasco = (hz) => !!hz.frasco || ['biopsia', 'pinza', 'asa-fria', 'asa-caliente', 'mucosectomia', 'fragmentos', 'dse'].includes(hz.tecnica);

/** Diagnóstico vigente de un hallazgo: el histológico de su frasco si ya llegó, si no el presuntivo. */
export function dxVigente(hz, histologia) {
  const f = hz.frasco && histologia?.cargada ? histologia.frascos?.[hz.frasco] : null;
  return { dx: f?.dx || hz.presuntivo || null, histo: f || null, definitivo: !!f?.dx };
}

/** Tamaño a usar: si se resecó en fragmentos vale el endoscópico; si no, el mayor de los dos. */
export function tamanoVigente(hz, histo) {
  const e = num(hz.tamano), p = num(histo?.tamano);
  if (hz.tecnica === 'fragmentos') return e || p;
  return Math.max(e, p);
}

/** Traduce los hallazgos de un estudio (y su histología) a los datos que usa vigilancia.js. */
export function informeDesdeHallazgos(estudio, antecedentes = {}) {
  const alta = {}, baja = {};
  const hs = Object.values(estudio.hallazgos || {});
  const histo = estudio.histologia || null;
  const cal = estudio.calidad || {};
  baja.preparacion = cal.preparacion === 'inadecuada' ? 'inadecuada' : 'adecuada';
  baja.incompleta = !!cal.incompleta;
  baja.familiarCCR = !!antecedentes.familiarCCR;
  alta.familiarGastrico = !!antecedentes.familiarGastrico;
  alta.hpPersistente = !!antecedentes.hpPersistente;
  let adenomas = 0, serrados = 0, tamMax = 0, hiperplasicos = false;
  const ordenGastrico = ['no', 'glandulas', 'hiperplasicos', 'adenoma'];
  let pg = 'no';
  const LA = ['A', 'B', 'C', 'D'];
  for (const hz of hs) {
    const { dx, histo: h } = dxVigente(hz, histo);
    const cant = Math.max(1, num(hz.cantidad) || 1);
    const tam = tamanoVigente(hz, h);
    if (dx === 'cancer') { if (ORGANOS[hz.organo]?.parte === 'alta') alta.neoplasia = true; else baja.neoplasia = true; continue; }
    if (hz.tipo === 'sospechosa' && dx !== 'benigna') { if (ORGANOS[hz.organo]?.parte === 'alta') alta.neoplasia = true; else baja.neoplasia = true; continue; }
    switch (hz.tipo) {
      case 'barrett': {
        if (dx === 'no-barrett') break;
        alta.barrett = true;
        alta.barrettC = Math.max(num(alta.barrettC), num(hz.pragaC));
        alta.barrettM = Math.max(num(alta.barrettM), num(hz.pragaM));
        const d = { 'barrett-sin': 'sin', 'barrett-indefinida': 'indefinida', 'barrett-bajo': 'bajo', 'barrett-alto': 'alto' }[dx] || 'sin-dato';
        const orden = ['sin-dato', 'sin', 'indefinida', 'bajo', 'alto', 'cancer'];
        if (orden.indexOf(d) > orden.indexOf(alta.barrettDisplasia || 'sin-dato')) alta.barrettDisplasia = d;
        break;
      }
      case 'esofagitis':
        if (LA.includes(hz.losAngeles) && LA.indexOf(hz.losAngeles) > LA.indexOf(alta.esofagitis || '')) alta.esofagitis = hz.losAngeles;
        break;
      case 'atrofia': {
        if (dx === 'gastritis-cronica') break;
        const ext = hz.extension === 'extensa' ? 'extensa' : 'antro';
        if (alta.atrofia !== 'extensa') alta.atrofia = ext;
        if (h) {
          alta.olga = Math.max(num(alta.olga), num(h.olga));
          if (h.miIncompleta) alta.miIncompleta = true;
          if (h.hp) alta.hp = true;
        }
        break;
      }
      case 'ulcera':
        if (hz.organo === 'estomago') alta.ulceraGastrica = true;
        if (h?.hp) alta.hp = true;
        break;
      case 'polipo-gastrico': {
        const k = { 'glandulas-fundicas': 'glandulas', 'hiperplasico-gastrico': 'hiperplasicos', 'adenoma-gastrico': 'adenoma' }[dx] || 'no';
        if (ordenGastrico.indexOf(k) > ordenGastrico.indexOf(pg)) pg = k;
        break;
      }
      case 'polipo':
        if (dx === 'adenoma-bajo' || dx === 'adenoma-alto') {
          adenomas += cant; tamMax = Math.max(tamMax, tam);
          if (dx === 'adenoma-alto') baja.displasiaAlta = true;
          if (hz.tecnica === 'fragmentos' && tam >= 20) baja.piecemeal = true;
        } else if (dx === 'serrado' || dx === 'serrado-displasia' || (dx === 'hiperplasico' && tam >= 10)) {
          // ESGE 2020: el hiperplásico ≥ 10 mm cuenta como serrado de alto riesgo
          serrados += cant;
          if (tam >= 10) baja.serradoGrande = true;
          if (dx === 'serrado-displasia') baja.serradoDisplasia = true;
          if (hz.tecnica === 'fragmentos' && tam >= 20) baja.piecemeal = true;
        } else if (dx === 'hiperplasico') hiperplasicos = true;
        break;
      default:
    }
    if (h?.hp) alta.hp = true;
  }
  if (histo?.cargada && histo.hp) alta.hp = true;
  if (pg !== 'no') alta.poliposGastricos = pg;
  baja.adenomas = adenomas; baja.serrados = serrados; baja.tamanoMax = tamMax;
  if (hiperplasicos) baja.hiperplasicos = true;
  const biopsias = hs.some(llevaFrasco);
  return { alta, baja, biopsias, histoCargada: !!histo?.cargada };
}

/* ---------- Edad ---------- */
export function edadEn(nac, iso) {
  if (!nac || !iso) return null;
  const a = new Date(`${nac}T12:00:00`), b = new Date(`${iso}T12:00:00`);
  let e = b.getFullYear() - a.getFullYear();
  if (b.getMonth() < a.getMonth() || (b.getMonth() === a.getMonth() && b.getDate() < a.getDate())) e--;
  return e;
}

/* ---------- Evaluación completa de un estudio ---------- */
export function evaluarEstudio(estudio, { antecedentes = {}, nac = null } = {}) {
  const informe = informeDesdeHallazgos(estudio, antecedentes);
  const edad = edadEn(nac, estudio.fecha);
  const res = evaluarVigilancia(estudio.tipo, informe, { edad, fechaEstudio: estudio.fecha });
  // Síndromes hereditarios y EII tienen protocolos propios: la app avisa y no los reemplaza
  if (antecedentes.sindromeHereditario || antecedentes.eii) {
    for (const p of res.partes.filter((x) => x.id !== 'alta')) {
      p.items.unshift({ riesgo: 'alto', meses: null, texto: 'Síndrome hereditario o enfermedad inflamatoria intestinal: el intervalo sigue el protocolo específico de esa condición (definirlo manualmente).', guia: 'Protocolo específico', manual: true });
    }
  }
  const pendienteAP = informe.biopsias && !informe.histoCargada;
  return { informe, resultado: res, pendienteAP, edad };
}

/* ---------- Controles ---------- */

/** Ítem que manda en una parte: el de intervalo más corto (los «sin vigilancia» no mandan). */
export function itemQueManda(parte) {
  const con = parte.items.filter((x) => Number.isFinite(x.meses));
  if (!con.length) return null;
  return con.reduce((m, x) => (x.meses < m.meses ? x : m));
}

/**
 * Simula los controles sucesivos suponiendo que cada uno sale normal.
 * Cada ítem aporta su serie; en cada paso manda el intervalo más corto y,
 * hecho el control, todos los ítems avanzan un lugar en su serie.
 */
export function proyectarParte(parte, fechaEstudio, horizonte = HORIZONTE_MESES) {
  const series = parte.items.filter((x) => Number.isFinite(x.meses)).map((x) => ({ item: x, serie: x.meses === 0 ? [0] : (x.serie?.length ? x.serie : [x.meses]), i: 0 }));
  const pasos = [];
  let meses = 0, guarda = 0;
  while (series.some((s) => s.i < s.serie.length) && guarda++ < 40) {
    const activos = series.filter((s) => s.i < s.serie.length);
    const manda = activos.reduce((m, s) => (s.serie[s.i] < m.serie[m.i] ? s : m));
    const intervalo = manda.serie[manda.i];
    if (intervalo === 0) { pasos.push({ meses: 0, item: manda.item }); break; }
    if (meses + intervalo > horizonte) break;
    meses += intervalo;
    pasos.push({ meses, intervalo, item: manda.item, fecha: sumarMeses(fechaEstudio, meses) });
    activos.forEach((s) => { s.i++; });
  }
  return pasos;
}

/**
 * Controles que genera un estudio: el próximo (provisorio o definitivo) y los proyectados.
 * Devuelve objetos sin id (los asigna la capa de datos).
 */
export function controlesDeEstudio(estudioId, estudio, evaluacion, { nac = null } = {}) {
  const out = [];
  for (const p of evaluacion.resultado.partes) {
    const pasos = proyectarParte(p, estudio.fecha);
    pasos.forEach((s, n) => {
      const tipo = s.item.proximo || ESTUDIO_DE_PARTE[p.id];
      const estado = s.meses === 0 ? 'inmediato' : n > 0 ? 'proyectado' : evaluacion.pendienteAP ? 'provisorio' : 'definitivo';
      const edad = s.fecha ? edadEn(nac, s.fecha) : null;
      const limite = p.id === 'alta' && s.item.guia.includes('Barrett') ? 75 : 80;
      out.push({
        estudio: estudioId, parte: p.id, tipo, orden: n, estado,
        fecha: s.fecha || estudio.fecha, meses: s.meses, intervalo: s.intervalo ?? 0,
        riesgo: p.riesgo, regla: { texto: s.item.texto, guia: s.item.guia, version: VERSION_REGLAS },
        ...(edad !== null && edad >= limite ? { nota: `A los ${edad} años: evaluar si corresponde seguir con la vigilancia.` } : {}),
      });
    });
  }
  return out;
}

/** Próximo control vigente por parte (no proyectado, no cerrado). */
export const VIGENTES = ['inmediato', 'provisorio', 'definitivo', 'turno'];
export const ABIERTOS = [...VIGENTES, 'proyectado'];

/** Si el próximo VEDA y el próximo VCC caen a menos de 6 meses, propone hacerlos juntos en la fecha más temprana. */
export function propuestaUnion(controles) {
  const lista = Object.entries(controles || {}).filter(([, c]) => VIGENTES.includes(c.estado) && c.estado !== 'inmediato');
  const prox = (t) => lista.filter(([, c]) => c.tipo === t).sort((a, b) => a[1].fecha.localeCompare(b[1].fecha))[0];
  const a = prox('veda'), b = prox('vcc');
  if (!a || !b || a[1].unidoCon || b[1].unidoCon) return null;
  const meses = Math.abs(mesesEntre(a[1].fecha, b[1].fecha));
  if (meses > MESES_UNION) return null;
  const fecha = a[1].fecha < b[1].fecha ? a[1].fecha : b[1].fecha;
  return { ids: [a[0], b[0]], fecha, meses };
}

export function mesesEntre(iso1, iso2) {
  const a = new Date(`${iso1}T12:00:00`), b = new Date(`${iso2}T12:00:00`);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + (b.getDate() - a.getDate()) / 30;
}
export function diasEntre(iso1, iso2) {
  return Math.round((new Date(`${iso2}T12:00:00`) - new Date(`${iso1}T12:00:00`)) / 864e5);
}
export const sumarDias = (iso, dias) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + dias); return d.toISOString().slice(0, 10); };

/** Fecha que vale para el control: la acordada por el médico si la hay, si no la sugerida. */
export const fechaControl = (c) => c.ajuste?.fecha || c.fecha;

/**
 * Compara los controles vigentes antes y después de un recálculo (para mostrar «antes → ahora»).
 * antes/despues: listas de controles (sin proyectados).
 */
export function diferencias(antes, despues) {
  const partes = new Set([...antes, ...despues].map((c) => c.parte));
  return [...partes].map((parte) => {
    const a = antes.find((c) => c.parte === parte && c.orden === 0) || null;
    const d = despues.find((c) => c.parte === parte && c.orden === 0) || null;
    return { parte, antes: a, despues: d, cambia: (a?.fecha || null) !== (d?.fecha || null) || (a?.tipo || null) !== (d?.tipo || null) };
  });
}

/** Bandeja del médico a partir de todo el seguimiento (seguimiento/<pac>). */
export function bandeja(seguimiento, hoy) {
  const ap = [], mes = [], vencidos = [], inmediatos = [];
  const finMes = sumarDias(hoy, 31);
  for (const [pac, s] of Object.entries(seguimiento || {})) {
    for (const [id, e] of Object.entries(s?.estudios || {})) {
      if (e.estado === 'esperando-ap') ap.push({ pac, id, e, dias: diasEntre(e.fecha, hoy), vencido: diasEntre(e.fecha, hoy) >= DIAS_RECORDATORIO_AP });
    }
    for (const [id, c] of Object.entries(s?.controles || {})) {
      if (c.estado === 'inmediato') { inmediatos.push({ pac, id, c }); continue; }
      if (!VIGENTES.includes(c.estado)) continue;
      const f = fechaControl(c);
      if (f < hoy && c.estado !== 'turno') vencidos.push({ pac, id, c, f });
      else if (f <= finMes) mes.push({ pac, id, c, f });
    }
  }
  ap.sort((a, b) => b.dias - a.dias);
  mes.sort((a, b) => a.f.localeCompare(b.f));
  vencidos.sort((a, b) => a.f.localeCompare(b.f));
  return { ap, mes, vencidos, inmediatos };
}

/** Controles por año y mes para el calendario de 10 años: { 'AAAA': { 'MM': [ {pac, id, c} ] } } */
export function calendario(seguimiento, { desde, anios = 10, tipos = null, estados = ABIERTOS } = {}) {
  const fin = `${+desde.slice(0, 4) + anios}-12-31`;
  const out = {};
  for (const [pac, s] of Object.entries(seguimiento || {})) {
    for (const [id, c] of Object.entries(s?.controles || {})) {
      if (!estados.includes(c.estado) || c.estado === 'inmediato') continue;
      if (tipos && !tipos.includes(c.tipo)) continue;
      const f = fechaControl(c);
      if (f < desde.slice(0, 4) + '-01-01' || f > fin) continue;
      const a = f.slice(0, 4), m = f.slice(5, 7);
      ((out[a] ||= {})[m] ||= []).push({ pac, id, c, f });
    }
  }
  return out;
}

/** Controles a avisar al paciente (30 días antes). */
export function controlesParaAvisar(controles, hoy) {
  return Object.entries(controles || {}).filter(([, c]) => ['provisorio', 'definitivo', 'turno'].includes(c.estado) && !c.avisado && diasEntre(hoy, fechaControl(c)) <= DIAS_AVISO_PACIENTE && fechaControl(c) >= hoy);
}
