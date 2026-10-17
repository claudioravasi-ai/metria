/* ============================================================
   Seguimiento endoscópico a 10 años: lectura y escritura en la base.

   seguimiento/<pac>/antecedentes          antecedentes que cambian intervalos
   seguimiento/<pac>/estudios/<id>         estudio: tipo, fecha, calidad, hallazgos, histología, estado
   seguimiento/<pac>/controles/<id>        controles con fecha (próximo y proyectados)
   seguimiento/<pac>/historial/<id>        cada cálculo y cada firma: antes, después, regla y quién
   indiceDni/<huella>                      huella SHA-256 del DNI → uid del paciente (solo médicos)

   El paciente puede leer su propio seguimiento; solo los médicos escriben.
   ============================================================ */

import { backend, auditar } from './servicio.js';
import * as C from '../engine/calendario.js';
import { sha256hex } from '../core/cripto.js';

const B = () => backend();
const limpiar = (s, n = 120) => String(s ?? '').trim().replace(/\s+/g, ' ').slice(0, n);
const soloDni = (dni) => String(dni ?? '').replace(/\D/g, '').slice(0, 9);
const base = (pac) => `seguimiento/${pac}`;
const quien = () => B().usuario()?.uid || null;

export const huellaDni = async (dni) => sha256hex(`metria-dni:${soloDni(dni)}`);

/* ---------- Búsqueda por DNI ---------- */

/**
 * Devuelve el uid del paciente con ese DNI o null.
 * Primero el índice por huella; si no está (paciente anterior al índice), busca entre los
 * pacientes cuyo DNI termina igual y deja el índice escrito para la próxima vez.
 */
export async function buscarPorDni(dni, indice = {}) {
  const d = soloDni(dni);
  if (d.length < 7) return null;
  const h = await huellaDni(d);
  const uid = await B().leer(`indiceDni/${h}`).catch(() => null);
  if (uid && indice[uid]) return uid;
  for (const [pac, fila] of Object.entries(indice)) {
    if (fila.d3 !== d.slice(-3)) continue;
    const per = await B().leer(`pacientes/${pac}/perfil`).catch(() => null);
    if (soloDni(per?.dni) === d) {
      await B().escribir(`indiceDni/${h}`, pac).catch(() => {});
      return pac;
    }
  }
  return null;
}

/* ---------- Normalización ---------- */
function limpiarHallazgo(hz) {
  const out = {
    organo: C.ORGANOS[hz.organo] ? hz.organo : 'colon',
    tipo: C.TIPOS[hz.tipo] ? hz.tipo : 'polipo',
    segmento: limpiar(hz.segmento, 40) || null,
    cantidad: Math.min(99, Math.max(1, +hz.cantidad || 1)),
    tamano: hz.tamano === '' || hz.tamano == null ? null : Math.min(200, Math.max(0, +hz.tamano || 0)),
    paris: C.PARIS.includes(hz.paris) ? hz.paris : null,
    tecnica: C.TECNICAS.some(([k]) => k === hz.tecnica) ? hz.tecnica : 'ninguna',
    frasco: limpiar(hz.frasco, 6) || null,
    presuntivo: C.DX[hz.presuntivo] ? hz.presuntivo : null,
    nota: limpiar(hz.nota, 200) || null,
  };
  if (out.tipo === 'barrett') { out.pragaC = Math.max(0, +hz.pragaC || 0); out.pragaM = Math.max(0, +hz.pragaM || 0); }
  if (out.tipo === 'esofagitis') out.losAngeles = ['A', 'B', 'C', 'D'].includes(hz.losAngeles) ? hz.losAngeles : 'A';
  if (out.tipo === 'atrofia') out.extension = hz.extension === 'extensa' ? 'extensa' : 'antro';
  return out;
}

function limpiarHisto(h) {
  const frascos = {};
  for (const [n, f] of Object.entries(h?.frascos || {})) {
    if (!f) continue;
    frascos[limpiar(n, 6)] = {
      dx: C.DX[f.dx] ? f.dx : null,
      tamano: f.tamano === '' || f.tamano == null ? null : Math.max(0, +f.tamano || 0),
      margenes: ['libres', 'comprometidos', 'no-evaluables'].includes(f.margenes) ? f.margenes : null,
      olga: [0, 1, 2, 3, 4].includes(+f.olga) ? +f.olga : 0,
      miIncompleta: !!f.miIncompleta, hp: !!f.hp,
      texto: limpiar(f.texto, 300) || null,
    };
  }
  return {
    cargada: true, laboratorio: limpiar(h?.laboratorio, 80) || null, protocolo: limpiar(h?.protocolo, 40) || null,
    fechaInforme: /^\d{4}-\d{2}-\d{2}$/.test(h?.fechaInforme || '') ? h.fechaInforme : null, hp: !!h?.hp, frascos,
  };
}

export function limpiarEstudio(e) {
  const hallazgos = {};
  for (const [id, hz] of Object.entries(e.hallazgos || {})) hallazgos[id] = limpiarHallazgo(hz);
  return {
    tipo: ['veda', 'vcc', 'rsc', 'doble'].includes(e.tipo) ? e.tipo : 'vcc',
    fecha: e.fecha, turno: e.turno || null, indicacion: limpiar(e.indicacion, 200) || null,
    calidad: {
      preparacion: e.calidad?.preparacion === 'inadecuada' ? 'inadecuada' : 'adecuada',
      boston: e.calidad?.boston === '' || e.calidad?.boston == null ? null : Math.min(9, Math.max(0, +e.calidad.boston || 0)),
      incompleta: !!e.calidad?.incompleta,
    },
    hallazgos, texto: limpiar(e.texto, 2000) || null,
    ...(e.histologia?.cargada ? { histologia: limpiarHisto(e.histologia) } : {}),
  };
}

/* ---------- Guardar estudio y recalcular ---------- */

/**
 * Guarda el estudio y rehace sus controles.
 * - Los controles vigentes de estudios anteriores del mismo tipo quedan «reemplazados».
 * - Los controles anteriores de ESTE estudio se reemplazan por los nuevos.
 * - ajustes: { [parte]: { fecha, motivo } } fecha acordada por el médico distinta de la sugerida.
 * Devuelve { id, evaluacion, nuevos, antes }.
 */
export async function guardarEstudio(pac, { id = null, estudio, antecedentes = {}, nac = null, ajustes = {}, que = null, seguimientoActual = {} }) {
  const eid = id || B().nuevaClave();
  const e = limpiarEstudio(estudio);
  const ev = C.evaluarEstudio(e, { antecedentes, nac });
  e.estado = ev.pendienteAP ? 'esperando-ap' : e.histologia?.cargada ? 'definitivo' : 'sin-biopsias';
  const generados = C.controlesDeEstudio(eid, e, ev, { nac });
  const c = {};
  const controles = seguimientoActual.controles || {};
  const estudios = seguimientoActual.estudios || {};
  const antes = Object.values(controles).filter((k) => k.estudio === eid && k.orden === 0 && C.VIGENTES.includes(k.estado));
  // Controles anteriores de este estudio: se reemplazan
  for (const [cid, k] of Object.entries(controles)) {
    if (k.estudio === eid && C.ABIERTOS.includes(k.estado)) c[`${base(pac)}/controles/${cid}`] = null;
  }
  // Estudios previos de las mismas partes: sus controles abiertos quedan reemplazados por este estudio
  const partes = new Set(ev.resultado.partes.map((p) => p.id === 'rsc' ? 'baja' : p.id));
  for (const [cid, k] of Object.entries(controles)) {
    if (k.estudio === eid || !C.ABIERTOS.includes(k.estado)) continue;
    const otro = estudios[k.estudio];
    if (!otro || otro.fecha > e.fecha) continue;
    if (partes.has(k.parte === 'rsc' ? 'baja' : k.parte)) {
      c[`${base(pac)}/controles/${cid}/estado`] = 'reemplazado';
      c[`${base(pac)}/controles/${cid}/por`] = eid;
    }
  }
  const nuevos = {};
  for (const g of generados) {
    const cid = B().nuevaClave();
    const aj = g.orden === 0 && ajustes[g.parte]?.fecha && ajustes[g.parte].fecha !== g.fecha
      ? { ajuste: { fecha: ajustes[g.parte].fecha, motivo: limpiar(ajustes[g.parte].motivo, 300) || 'Ajuste del médico', por: quien(), cuando: B().TS } } : {};
    nuevos[cid] = { ...g, ...aj, creado: B().TS };
    c[`${base(pac)}/controles/${cid}`] = nuevos[cid];
  }
  c[`${base(pac)}/estudios/${eid}`] = { ...e, actualizado: B().TS, por: quien(), creado: estudios[eid]?.creado || B().TS };
  c[`${base(pac)}/antecedentes`] = Object.fromEntries(C.ANTECEDENTES_SEG.map(([k]) => [k, !!antecedentes[k]]));
  const proximos = Object.values(nuevos).filter((k) => k.orden === 0);
  c[`${base(pac)}/historial/${B().nuevaClave()}`] = {
    cuando: B().TS, por: quien(), estudio: eid,
    que: que || (e.histologia?.cargada ? 'Anatomía patológica cargada: fecha definitiva' : 'Estudio cargado: fecha provisoria'),
    antes: antes.map((k) => ({ parte: k.parte, tipo: k.tipo, fecha: C.fechaControl(k) })),
    despues: proximos.map((k) => ({ parte: k.parte, tipo: k.tipo, fecha: C.fechaControl(k), regla: k.regla.texto, guia: k.regla.guia })),
  };
  await B().actualizar('', c);
  await auditar(pac, e.histologia?.cargada ? 'seguimiento-histologia' : 'seguimiento-estudio');
  return { id: eid, evaluacion: ev, nuevos, antes };
}

/** Cambia la fecha acordada de un control (con motivo). */
export async function ajustarControl(pac, cid, fecha, motivo) {
  await B().actualizar('', {
    [`${base(pac)}/controles/${cid}/ajuste`]: { fecha, motivo: limpiar(motivo, 300) || 'Ajuste del médico', por: quien(), cuando: B().TS },
    [`${base(pac)}/historial/${B().nuevaClave()}`]: { cuando: B().TS, por: quien(), que: `Fecha de control ajustada al ${fecha}: ${limpiar(motivo, 300)}` },
  });
}

/** Anula un control (edad, decisión médica, fallecimiento…). */
export async function anularControl(pac, cid, motivo) {
  await B().actualizar('', {
    [`${base(pac)}/controles/${cid}/estado`]: 'anulado',
    [`${base(pac)}/controles/${cid}/motivo`]: limpiar(motivo, 300) || 'Anulado por el médico',
    [`${base(pac)}/historial/${B().nuevaClave()}`]: { cuando: B().TS, por: quien(), que: `Control anulado: ${limpiar(motivo, 300)}` },
  });
}

/** Une VEDA y VCC cercanas en la fecha más temprana. */
export async function unirControles(pac, ids, fecha) {
  const c = {};
  for (const cid of ids) {
    c[`${base(pac)}/controles/${cid}/ajuste`] = { fecha, motivo: 'VEDA y VCC en el mismo día', por: quien(), cuando: B().TS };
    c[`${base(pac)}/controles/${cid}/unidoCon`] = ids.find((x) => x !== cid);
  }
  c[`${base(pac)}/historial/${B().nuevaClave()}`] = { cuando: B().TS, por: quien(), que: `VEDA y VCC unidas para el ${fecha}` };
  await B().actualizar('', c);
}

/** El control pasa a «con turno» cuando se le da turno desde la agenda. */
export const marcarConTurno = (pac, cid, turno) => B().actualizar('', { [`${base(pac)}/controles/${cid}/estado`]: 'turno', [`${base(pac)}/controles/${cid}/turno`]: turno || null });

export const guardarAntecedentes = (pac, ant) => B().escribir(`${base(pac)}/antecedentes`, Object.fromEntries(C.ANTECEDENTES_SEG.map(([k]) => [k, !!ant[k]])));

/** Aviso de 30 días: queda marcado para no repetirlo (lo hace el servidor; en la demo, la app al abrir). */
export const marcarAvisado = (pac, cid) => B().escribir(`${base(pac)}/controles/${cid}/avisado`, B().TS);
