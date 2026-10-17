/* ============================================================
   Turnos de endoscopia: lectura y escritura en la base.

   endoConfig                    médico actuante (con firma), lugar, preparación, vigencias
   agendaEndo/<fecha>            fecha abierta por el médico: { desde, hasta, minutos, cerrada? }
   ocupacionEndo/<fecha>/<hhmm>  id del turno que ocupa ese cupo (sin datos personales)
   turnosEndo/<pac>/<id>         el turno completo (solo el paciente y los médicos)
   estadoTurno/<código>          estado público del turno para el QR (sin nombre ni DNI)
   pacientes/<pac>/endo          formulario y prequirúrgico del paciente

   Reservar es una sola escritura «todo o nada»: si otro paciente tomó el
   mismo cupo un instante antes, la base la rechaza y no queda nada a medias.
   ============================================================ */

import { backend, auditar } from './servicio.js';
import * as E from '../engine/endoscopia.js';
import { sha256hex } from '../core/cripto.js';

const B = () => backend();
const limpiar = (s, n = 120) => String(s ?? '').trim().replace(/\s+/g, ' ').slice(0, n);

export const CONFIG_DEFECTO = {
  medico: { nombre: '', matricula: '', especialidad: 'Gastroenterología y endoscopia digestiva', firma: null },
  lugar: { nombre: 'Servicio de Endoscopia Digestiva', direccion: '' },
  preparacion: 'peg4', validez: { ...E.VALIDEZ_DEFECTO }, minutos: 30,
};
export const configCompleta = (c) => ({ ...CONFIG_DEFECTO, ...(c || {}), medico: { ...CONFIG_DEFECTO.medico, ...(c?.medico || {}) }, lugar: { ...CONFIG_DEFECTO.lugar, ...(c?.lugar || {}) }, validez: { ...E.VALIDEZ_DEFECTO, ...(c?.validez || {}) } });

/* ---------- Paciente ---------- */
export async function guardarEndoPaciente(uid, { datos, pre }) {
  const c = {};
  if (datos) c[`pacientes/${uid}/endo/datos`] = limpiarDatos(datos);
  if (pre) c[`pacientes/${uid}/endo/pre`] = limpiarPre(pre);
  c[`pacientes/${uid}/endo/actualizado`] = B().TS;
  await B().actualizar('', c);
}

function limpiarDatos(d) {
  const ant = Object.fromEntries(E.ANTECEDENTES.map(([k]) => [k, !!d.antecedentes?.[k]]).filter(([, v]) => v));
  return {
    cobertura: limpiar(d.cobertura, 80), afiliado: limpiar(d.afiliado, 40), telefono: limpiar(d.telefono, 25),
    acompNombre: limpiar(d.acompNombre, 80), acompTel: limpiar(d.acompTel, 25),
    motivo: E.MOTIVOS.some(([k]) => k === d.motivo) ? d.motivo : 'otro', motivoTexto: limpiar(d.motivoTexto, 300),
    derivante: limpiar(d.derivante, 80), peso: +d.peso || null, talla: +d.talla || null,
    alergias: limpiar(d.alergias, 200), medicacion: limpiar(d.medicacion, 300),
    antecedentes: ant,
  };
}
function limpiarPre(p) {
  const out = {};
  for (const r of E.REQUISITOS) {
    const x = p[r.id] || {};
    if (x.tiene !== true && x.tiene !== false) continue;
    out[r.id] = { tiene: x.tiene, fecha: x.tiene && /^\d{4}-\d{2}-\d{2}$/.test(x.fecha || '') ? x.fecha : null };
    if (r.id === 'ecg') out[r.id].informe = !!x.informe;
    if (r.id === 'anestesia') out[r.id].apto = x.apto !== false;
  }
  return out;
}

export async function registrarOrdenes(uid, ids) {
  await B().escribir(`pacientes/${uid}/endo/ordenes`, { items: ids, fecha: B().TS });
  await auditar(uid, 'orden-prequirurgico');
}

/** Reserva el turno: ocupa los cupos, crea el turno y su estado público en una sola escritura. */
/** Huella SHA-256 del consentimiento firmado: texto exacto + firma + aclaración + turno original. */
export function huellaConsentimiento(c, codigo, tipo) {
  return sha256hex(JSON.stringify({ v: c.version, texto: c.texto, firma: c.firma || '', aclaracion: c.aclaracion || '', codigo, tipo, fecha: c.paraFecha, hora: c.paraHora }));
}
/** ¿El consentimiento guardado sigue igual al que se firmó? (y, en producción, coincide con el sello del servidor) */
export async function verificarConsentimiento(t) {
  const c = t?.consentimiento;
  if (!c?.huella || !c.texto) return { estado: 'sin-huella' };
  const calc = await huellaConsentimiento(c, t.codigo, t.tipo);
  if (calc !== c.huella) return { estado: 'alterado' };
  const sello = B().selloConsentimiento ? await B().selloConsentimiento(t.codigo).catch(() => null) : null;
  if (sello && sello.h !== c.huella) return { estado: 'alterado' };
  return { estado: 'integro', sello };
}

export async function reservar(uid, perfil, { tipo, fecha, libre, datos, pre, firma, aclaracion, config, textoConsentimiento = [], reemplaza, enEspera }) {
  const id = B().nuevaClave();
  const codigo = E.nuevoCodigo();
  const ahora = B().TS;
  const consentimiento = {
    aceptado: true, version: 'endo-2026-10', fecha: ahora, firma, aclaracion: limpiar(aclaracion, 80),
    texto: textoConsentimiento.map(([a, b]) => `${a}: ${b}`).join('\n').slice(0, 12000), paraFecha: fecha, paraHora: libre.hora, algoritmo: 'SHA-256',
  };
  consentimiento.huella = await huellaConsentimiento(consentimiento, codigo, tipo);
  const c = {};
  for (const k of libre.cupos) c[`ocupacionEndo/${fecha}/${k}`] = id;
  c[`turnosEndo/${uid}/${id}`] = {
    codigo, tipo, fecha, hora: libre.hora, cupos: libre.cupos, estado: 'confirmado', reprogramaciones: 0,
    paciente: { n: `${perfil.apellido}, ${perfil.nombre}`, d3: String(perfil.dni || '').slice(-3) },
    datos: limpiarDatos(datos), pre: limpiarPre(pre), alertas: E.alertasMedico(datos),
    consentimiento,
    medico: limpiar(config?.medico?.nombre, 80) || null,
    creado: ahora, historial: { [B().nuevaClave()]: { cuando: ahora, que: 'Turno otorgado y confirmado', por: 'paciente' } },
  };
  c[`estadoTurno/${codigo}`] = { t: id, estado: 'confirmado', tipo, fecha, hora: libre.hora, reprogramaciones: 0, actualizado: ahora };
  try { await B().actualizar('', c); }
  catch (e) { if (/permission|PERMISSION/i.test(`${e.code} ${e.message}`)) throw Object.assign(new Error('ocupado'), { code: 'endo/ocupado' }); throw e; }
  if (enEspera) await B().borrar(`esperaEndo/${uid}`).catch(() => {});
  if (reemplaza?.t && E.turnoActivo(reemplaza.t)) await cancelarTurno(uid, reemplaza.id, reemplaza.t, 'paciente-adelanto').catch((e) => console.warn(e));
  await auditar(uid, 'turno-endoscopia');
  return { id, codigo, huella: consentimiento.huella, fechaFirma: Date.now() };
}

export async function cancelarTurno(uid, id, t, por = 'paciente') {
  const c = {};
  for (const k of t.cupos || []) c[`ocupacionEndo/${t.fecha}/${k}`] = null;
  c[`turnosEndo/${uid}/${id}/estado`] = 'cancelado';
  c[`turnosEndo/${uid}/${id}/historial/${B().nuevaClave()}`] = { cuando: B().TS, que: por === 'paciente' ? 'Cancelado por el paciente' : por === 'paciente-adelanto' ? 'Reemplazado: el paciente tomó un lugar antes (lista de espera)' : 'Cancelado por el consultorio', por: por === 'paciente-adelanto' ? 'paciente' : por };
  c[`estadoTurno/${t.codigo}/estado`] = 'cancelado';
  c[`estadoTurno/${t.codigo}/actualizado`] = B().TS;
  await B().actualizar('', c);
  B().avisarEspera?.(); // el lugar se le ofrece al primero de la lista de espera
}

/* ---------- Lista de espera ---------- */
export async function anotarEspera(uid, { tipo, antesDe = null, turno = null }) {
  await B().escribir(`esperaEndo/${uid}`, { tipo, antesDe, turno, creado: B().TS });
  B().avisarEspera?.();
}
export const salirEspera = (uid) => B().borrar(`esperaEndo/${uid}`);
export async function rechazarOferta(uid, e) {
  await B().actualizar('', { [`esperaEndo/${uid}/oferta`]: null, [`esperaEndo/${uid}/ofrecidos/${e.oferta.fecha}_${e.oferta.hora}`]: B().TS });
  B().avisarEspera?.();
}
/** Calcula y guarda las ofertas nuevas (en producción lo hace el servidor; en la demo, el médico). */
export async function repartirOfertas({ esperas, agenda, ocupacion, ahora }) {
  const nuevas = E.nuevasOfertas(esperas, agenda, ocupacion, { ahora });
  const c = {};
  for (const n of nuevas) {
    c[`esperaEndo/${n.pac}/oferta`] = n.oferta;
    c[`esperaEndo/${n.pac}/ofrecidos/${n.oferta.fecha}_${n.oferta.hora}`] = ahora;
  }
  if (nuevas.length) await B().actualizar('', c);
  return nuevas;
}

/* ---------- Médico ---------- */
export const guardarConfig = (cfg) => B().escribir('endoConfig', cfg);

export async function abrirFecha(fecha, { desde, hasta, minutos }) {
  await B().escribir(`agendaEndo/${fecha}`, { desde: desde.replace(':', ''), hasta: hasta.replace(':', ''), minutos: +minutos || 30, abierta: B().TS });
}

export async function marcarEstado(pacUid, id, t, estado, que) {
  await B().actualizar('', {
    [`turnosEndo/${pacUid}/${id}/estado`]: estado,
    [`turnosEndo/${pacUid}/${id}/historial/${B().nuevaClave()}`]: { cuando: B().TS, que, por: 'consultorio' },
    [`estadoTurno/${t.codigo}/estado`]: estado,
    [`estadoTurno/${t.codigo}/actualizado`]: B().TS,
  });
}

/**
 * Suspende un turno y lo reprograma solo para el próximo día con lugar.
 * Si no hay lugar, queda suspendido y se reprograma cuando el médico abra fechas nuevas.
 * Devuelve la nueva fecha y hora (o null).
 */
export async function suspenderYReprogramar(pacUid, id, t, { agenda, ocupacion, motivo, ahora }) {
  const c = {};
  const ocup = JSON.parse(JSON.stringify(ocupacion || {}));
  if (t.estado !== 'suspendido') for (const k of t.cupos || []) { c[`ocupacionEndo/${t.fecha}/${k}`] = null; if (ocup[t.fecha]) delete ocup[t.fecha][k]; }
  const nuevo = E.proximoLibre(agenda, ocup, t.tipo, { ahora, despuesDe: t.fecha });
  const base = `turnosEndo/${pacUid}/${id}`;
  const motivoTxt = limpiar(motivo, 200) || 'Suspendido por el consultorio';
  c[`${base}/historial/${B().nuevaClave()}`] = { cuando: B().TS, que: `Suspendido: ${motivoTxt}`, por: 'consultorio' };
  if (nuevo) {
    for (const k of nuevo.cupos) c[`ocupacionEndo/${nuevo.fecha}/${k}`] = id;
    Object.assign(c, {
      [`${base}/estado`]: 'confirmado', [`${base}/fecha`]: nuevo.fecha, [`${base}/hora`]: nuevo.hora, [`${base}/cupos`]: nuevo.cupos,
      [`${base}/reprogramaciones`]: (t.reprogramaciones || 0) + 1, [`${base}/motivo`]: motivoTxt,
      [`${base}/historial/${B().nuevaClave()}`]: { cuando: B().TS, que: `Reprogramado automáticamente para el ${E.fechaCorta(nuevo.fecha)} a las ${E.hora(nuevo.hora)}`, por: 'sistema' },
      [`estadoTurno/${t.codigo}`]: { t: id, estado: 'confirmado', tipo: t.tipo, fecha: nuevo.fecha, hora: nuevo.hora, reprogramaciones: (t.reprogramaciones || 0) + 1, motivo: motivoTxt, actualizado: B().TS },
    });
  } else {
    Object.assign(c, {
      [`${base}/estado`]: 'suspendido', [`${base}/motivo`]: motivoTxt,
      [`estadoTurno/${t.codigo}`]: { t: id, estado: 'suspendido', tipo: t.tipo, fecha: t.fecha, hora: t.hora, reprogramaciones: t.reprogramaciones || 0, motivo: motivoTxt, actualizado: B().TS },
    });
  }
  await B().actualizar('', c);
  if (nuevo) for (const k of nuevo.cupos) { ocupacion[nuevo.fecha] = ocupacion[nuevo.fecha] || {}; ocupacion[nuevo.fecha][k] = id; }
  B().avisarEspera?.();
  return nuevo;
}

/** Cierra una fecha: cada turno de ese día se suspende y se reprograma solo. */
export async function cerrarFecha(fecha, { agenda, ocupacion, turnos, ahora, motivo }) {
  await B().escribir(`agendaEndo/${fecha}/cerrada`, true);
  const ag = { ...agenda, [fecha]: { ...agenda[fecha], cerrada: true } };
  const movidos = [];
  for (const [pac, lista] of Object.entries(turnos || {})) {
    for (const [id, t] of Object.entries(lista || {})) {
      if (t.fecha !== fecha || !['confirmado', 'admitido'].includes(t.estado)) continue;
      const nuevo = await suspenderYReprogramar(pac, id, t, { agenda: ag, ocupacion, motivo: motivo || 'El consultorio cerró la agenda de ese día', ahora });
      movidos.push({ pac, id, t, nuevo });
    }
  }
  return movidos;
}

/** Al abrir fechas nuevas, los turnos suspendidos se reprograman solos (el más antiguo primero). */
export async function asignarSuspendidos({ agenda, ocupacion, turnos, ahora }) {
  const lista = Object.entries(turnos || {}).flatMap(([pac, l]) => Object.entries(l || {}).filter(([, t]) => t.estado === 'suspendido').map(([id, t]) => ({ pac, id, t })))
    .sort((a, b) => (a.t.creado || 0) - (b.t.creado || 0));
  const hechos = [];
  for (const x of lista) {
    if (!E.proximoLibre(agenda, ocupacion, x.t.tipo, { ahora, despuesDe: x.t.fecha })) continue;
    const nuevo = await suspenderYReprogramar(x.pac, x.id, x.t, { agenda, ocupacion, motivo: x.t.motivo, ahora });
    if (nuevo) hechos.push({ ...x, nuevo });
  }
  return hechos;
}

/** Informe del endoscopista con la categoría de riesgo y el próximo control (el turno pasa a «Realizado»). */
export async function guardarInforme(pacUid, id, t, informe) {
  const c = {
    [`turnosEndo/${pacUid}/${id}/informe`]: { ...informe, fecha: B().TS },
    [`turnosEndo/${pacUid}/${id}/historial/${B().nuevaClave()}`]: { cuando: B().TS, que: informe.histoCargada ? 'Informe actualizado con la anatomía patológica' : 'Estudio realizado: informe y próximo control cargados', por: 'consultorio' },
  };
  if (t.estado !== 'realizado') {
    c[`turnosEndo/${pacUid}/${id}/estado`] = 'realizado';
    c[`estadoTurno/${t.codigo}/estado`] = 'realizado';
    c[`estadoTurno/${t.codigo}/actualizado`] = B().TS;
  }
  await B().actualizar('', c);
  await auditar(pacUid, 'informe-endoscopia');
}

/* ---------- Estado público (QR) ---------- */
export async function leerEstadoPublico(codigo) {
  const c = E.normalizarCodigo(codigo);
  if (!E.codigoValido(c)) return null;
  try { return await B().leer(`estadoTurno/${c}`); } catch { return null; }
}

/* ---------- Correos e IA (servidor de Apps Script; en la demo se muestran en pantalla) ---------- */
export async function enviarCorreo(datos) {
  if (B().modo === 'demo' || !B().correoEndo) return { demo: true };
  return B().correoEndo(datos);
}
export async function resumenIA(datos) {
  if (B().modo === 'demo' || !B().iaEndo) return null;
  try { return await B().iaEndo(datos); } catch (e) { console.warn('IA no disponible', e.code || e); return null; }
}
