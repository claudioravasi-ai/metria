/* ============================================================
   Servicios de dominio sobre el backend (demo o Firebase).
   Estructura de la base (ver reglas-firebase.json):

   medicos/<uid>               datos profesionales (nombre, matrícula…)
   medicosEstado/<uid>         'pendiente' | 'aprobado' | 'suspendido' (lo cambia el coordinador)
   pacientes/<uid>/perfil      identificación y consentimiento
   pacientes/<uid>/clinica     ficha clínica (antropometría, labs, patologías…)
   pacientes/<uid>/mediciones  historial de peso, cintura y presión
   pacientes/<uid>/plan        plan de tratamiento confirmado por el médico
   pacientes/<uid>/tolerancia  registro semanal de síntomas del paciente
   indice/<uid>                fila mínima para la lista de los médicos
   verificados/<uid>           identidad constatada por un médico (DNI en consulta)
   evaluaciones/<uid>/<id>     notas del médico (solo médicos)
   estudios/<uid>/<id>         metadatos + bosquejo del estudio (liviano)
   estudiosArchivos/<uid>/<id>/<n>  el archivo en partes (pesado, a pedido)
   estudiosVenc/<uid>/<id>     hora de la primera descarga (para el borrado)
   auditoria/<uid>/<id>        quién subió, abrió, descargó o borró (sin datos clínicos)
   solicitudes/<uid>/<id>      pedidos de acceso, rectificación o baja (Ley 25.326)
   ============================================================ */

import { CONFIG, MS_DIA, MS_HORA } from '../config.js';
import { evaluarPaciente, resumenIndice } from '../engine/evaluar.js';
import { esCorreoCoordinador, uidPaciente } from '../core/cripto.js';

let B;
export const backend = () => B;
export async function iniciarBackend() {
  B = CONFIG.firebase?.apiKey && CONFIG.firebase?.databaseURL ? await import('./remoto.js') : await import('./local.js');
  await B.iniciar(CONFIG);
  return B;
}

export const VERSION_CONSENTIMIENTO = '2026-10-06';
export const PARTE = 512 * 1024; // caracteres base64 por parte (~384 KB de archivo)

/* ---------- Identidad y rol ---------- */
export async function perfilDe(u) {
  if (!u) return null;
  const med = u.paciente ? null : await B.leer(`medicos/${u.uid}`).catch(() => null);
  if (med) {
    const estado = await B.leer(`medicosEstado/${u.uid}`).catch(() => null);
    // titular = coordinador/a: su correo coincide con el hash de la configuración (y con las reglas)
    const titular = (B.modo === 'demo' && !!med.demoTitular) || (await esCorreoCoordinador(u.email, CONFIG.coordinadorHash));
    // Si el profesional cambió su correo, se actualiza su ficha
    if (u.email && med.email !== u.email.toLowerCase()) B.escribir(`medicos/${u.uid}/email`, u.email.toLowerCase()).catch(() => {});
    return { rol: 'medico', uid: u.uid, email: u.email, verificado: u.verificado, datos: med, estado: titular ? 'aprobado' : estado || 'pendiente', titular };
  }
  const per = await B.leer(`pacientes/${u.uid}/perfil`).catch(() => null);
  if (per) return { rol: 'paciente', uid: u.uid, email: u.email || per.email, verificado: u.verificado, datos: per };
  return { rol: 'sin-perfil', uid: u.uid, email: u.email, verificado: u.verificado, paciente: !!u.paciente };
}

const limpiar = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);

/** Pedido del código de ingreso para pacientes (alta o ingreso: es el mismo paso). */
export const pedirCodigo = (email) => B.pedirCodigo(email);
export const ingresarConCodigo = (email, codigo, recordar) => B.ingresarConCodigo(email, codigo, recordar);

/**
 * Alta del paciente después de validar el código: completa su perfil.
 * El correo se comprueba contra el uid (derivado del correo verificado), así nadie
 * puede registrar un perfil con un correo que no es el suyo.
 */
export async function completarAltaPaciente(uid, d) {
  const email = String(d.email || '').trim().toLowerCase();
  if (uid.startsWith('pac_') && (await uidPaciente(email)) !== uid) throw Object.assign(new Error('correo'), { code: 'alta/correo' });
  const perfil = {
    nombre: limpiar(d.nombre), apellido: limpiar(d.apellido), dni: String(d.dni).replace(/\D/g, '').slice(0, 9),
    fechaNac: d.fechaNac, sexo: d.sexo === 'M' ? 'M' : 'F', telefono: limpiar(d.telefono).slice(0, 25) || null,
    email,
    consentimiento: { version: VERSION_CONSENTIMIENTO, fecha: B.TS, datosSalud: true, transferencia: true, terminos: true },
    creado: B.TS,
  };
  await B.escribir(`pacientes/${uid}/perfil`, perfil);
  await B.escribir(`indice/${uid}`, filaIndice(perfil, null));
  await auditar(uid, 'alta-cuenta');
  return uid;
}

export async function registrarMedico(d) {
  const { uid } = await B.registrar(d.email, d.clave);
  await B.escribir(`medicos/${uid}`, {
    nombre: limpiar(d.nombre), apellido: limpiar(d.apellido), especialidad: limpiar(d.especialidad),
    matricula: { tipo: d.matTipo === 'MP' ? 'MP' : 'MN', numero: String(d.matNumero).replace(/\D/g, '').slice(0, 8), provincia: limpiar(d.matProvincia) || null },
    email: String(d.email).trim().toLowerCase(),
    compromiso: { version: VERSION_CONSENTIMIENTO, fecha: B.TS },
    creado: B.TS,
  });
  await B.escribir(`medicosEstado/${uid}`, 'pendiente');
  B.avisarCoordinador?.(); // correo al coordinador (solo en producción)
  return uid;
}

/* ---------- Índice para la lista de pacientes ---------- */
export function filaIndice(perfil, ev) {
  return {
    n: `${perfil.apellido}, ${perfil.nombre}`,
    d3: String(perfil.dni || '').slice(-3),
    nac: perfil.fechaNac || null,
    sx: perfil.sexo || null,
    act: B.TS,
    ...(ev ? resumenIndice(ev) : {}),
  };
}

/* ---------- Ficha clínica ---------- */
export async function guardarClinica(uid, perfil, clinica, quien) {
  const ev = evaluarPaciente(perfil, clinica);
  const an = clinica.antropo || {};
  const previa = await B.leer(`pacientes/${uid}/clinica/antropo`).catch(() => null);
  const cambios = {
    [`pacientes/${uid}/clinica`]: { ...clinica, actualizado: B.TS, actualizadoPor: quien.rol, actualizadoUid: quien.uid },
    [`indice/${uid}`]: filaIndice(perfil, ev),
  };
  const cambio = (k) => Number(an[k]) !== Number(previa?.[k]);
  if (an.peso && (!previa || cambio('peso') || cambio('cintura'))) {
    cambios[`pacientes/${uid}/mediciones/${B.nuevaClave()}`] = {
      fecha: B.TS, peso: +an.peso, cintura: an.cintura ? +an.cintura : null,
      pas: clinica.vitales?.pas ? +clinica.vitales.pas : null, pad: clinica.vitales?.pad ? +clinica.vitales.pad : null, por: quien.rol,
    };
  }
  await B.actualizar('', cambios);
  return ev;
}

export async function actualizarPerfil(uid, campos) {
  const permitido = {};
  for (const k of ['nombre', 'apellido', 'telefono']) if (k in campos) permitido[`pacientes/${uid}/perfil/${k}`] = limpiar(campos[k]) || null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(campos.fechaNac || '')) permitido[`pacientes/${uid}/perfil/fechaNac`] = campos.fechaNac;
  if (campos.sexo === 'F' || campos.sexo === 'M') permitido[`pacientes/${uid}/perfil/sexo`] = campos.sexo;
  if ('nombre' in campos || 'apellido' in campos) {
    permitido[`indice/${uid}/n`] = `${limpiar(campos.apellido)}, ${limpiar(campos.nombre)}`;
  }
  if (campos.fechaNac) permitido[`indice/${uid}/nac`] = campos.fechaNac;
  if (campos.sexo) permitido[`indice/${uid}/sx`] = campos.sexo;
  await B.actualizar('', permitido);
}

/* ---------- Auditoría (sin datos clínicos: solo quién, qué y cuándo) ---------- */
export async function auditar(pacUid, accion, estudio = null) {
  const u = B.usuario();
  if (!u) return;
  try {
    await B.agregar(`auditoria/${pacUid}`, { quien: u.uid, accion, estudio, cuando: B.TS });
  } catch (e) { console.warn('No se pudo registrar la auditoría', e.code || e); }
}

/* ---------- Estudios ---------- */
const DESCARGA_MS = () => CONFIG.horasTrasDescarga * MS_HORA;
const RETENCION_MS = () => CONFIG.diasRetencionMaxima * MS_DIA;

export function estadoEstudio(meta, t = B.ahora()) {
  if (!meta) return { id: 'borrado' };
  const limiteRetencion = meta.subidoEn + RETENCION_MS();
  if (meta.descargadoEn) {
    const vence = Math.min(meta.descargadoEn + DESCARGA_MS(), limiteRetencion);
    return vence <= t ? { id: 'vencido', vence } : { id: 'descargado', vence, resta: vence - t };
  }
  return limiteRetencion <= t ? { id: 'vencido', vence: limiteRetencion } : { id: 'nuevo', vence: limiteRetencion, resta: limiteRetencion - t };
}

function aBase64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  const paso = 0x8000;
  for (let i = 0; i < bytes.length; i += paso) s += String.fromCharCode.apply(null, bytes.subarray(i, i + paso));
  return btoa(s);
}
function deBase64(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Sube un estudio: primero las partes, al final los metadatos (así nunca aparece a medias). */
export async function subirEstudio(pacUid, archivo, { titulo, categoria, fechaEstudio, nota, bosquejo }, progreso = () => {}) {
  if (archivo.size > CONFIG.tamanoMaximoMB * 1024 * 1024) throw new Error(`El archivo supera ${CONFIG.tamanoMaximoMB} MB`);
  const id = B.nuevaClave();
  const b64 = aBase64(await archivo.arrayBuffer());
  const n = Math.max(1, Math.ceil(b64.length / PARTE));
  for (let i = 0; i < n; i++) {
    await B.escribir(`estudiosArchivos/${pacUid}/${id}/${i}`, b64.slice(i * PARTE, (i + 1) * PARTE));
    progreso((i + 1) / n);
  }
  const u = B.usuario();
  const meta = {
    titulo: limpiar(titulo) || archivo.name.slice(0, 80), categoria: categoria || 'otro',
    nombre: archivo.name.slice(0, 120), mime: archivo.type || 'application/octet-stream', tamano: archivo.size,
    fechaEstudio: fechaEstudio || null, nota: nota ? String(nota).slice(0, 300) : null,
    bosquejo: bosquejo || null, partes: n, subidoPor: u.uid, subidoEn: B.TS,
  };
  await B.escribir(`estudios/${pacUid}/${id}`, meta);
  await auditar(pacUid, 'subio', id);
  return id;
}

/** Trae el archivo de la base (a pedido) y lo arma en memoria. Nunca se guarda en el equipo. */
export async function traerEstudio(pacUid, id, meta, progreso = () => {}) {
  const trozos = [];
  for (let i = 0; i < meta.partes; i++) {
    const t = await B.leer(`estudiosArchivos/${pacUid}/${id}/${i}`);
    if (typeof t !== 'string') throw Object.assign(new Error('El estudio ya no está disponible'), { code: 'VENCIDO' });
    trozos.push(deBase64(t));
    progreso((i + 1) / meta.partes);
  }
  await auditar(pacUid, 'abrio', id);
  return new Blob(trozos, { type: meta.mime });
}

/** Primera descarga: arranca la cuenta regresiva de 72 h (hora del servidor). */
export async function marcarDescarga(pacUid, id, meta, esPaciente) {
  await auditar(pacUid, 'descargo', id);
  if (!esPaciente || meta.descargadoEn) return;
  await B.escribir(`estudios/${pacUid}/${id}/descargadoEn`, B.TS);
  await B.escribir(`estudiosVenc/${pacUid}/${id}`, B.TS);
}

export async function borrarEstudio(pacUid, id, motivo = 'borro') {
  await B.borrar(`estudiosArchivos/${pacUid}/${id}`);
  await B.borrar(`estudios/${pacUid}/${id}`);
  await B.borrar(`estudiosVenc/${pacUid}/${id}`).catch(() => {});
  await auditar(pacUid, motivo, id);
}

/** Borra lo vencido. El paciente purga lo suyo; los médicos, lo de todos. */
export async function purgarVencidos(perfil) {
  let borrados = 0;
  try {
    if (perfil.rol === 'paciente') {
      const est = (await B.leer(`estudios/${perfil.uid}`)) || {};
      for (const [id, m] of Object.entries(est)) {
        if (estadoEstudio(m).id === 'vencido') { await borrarEstudio(perfil.uid, id, 'borrado-automatico'); borrados++; }
      }
    } else if (perfil.rol === 'medico' && perfil.estado === 'aprobado') {
      // Descargados hace más de 72 h
      const venc = (await B.leer('estudiosVenc')) || {};
      for (const [pac, ests] of Object.entries(venc)) {
        for (const [id, t] of Object.entries(ests)) {
          if (t + DESCARGA_MS() <= B.ahora()) { await borrarEstudio(pac, id, 'borrado-automatico'); borrados++; }
        }
      }
    }
  } catch (e) { console.warn('Purga incompleta', e.code || e); }
  return borrados;
}

/** Barrido completo de retención (lo hace el médico desde el panel). */
export async function purgarRetencion() {
  let borrados = 0;
  const todos = (await B.leer('estudios')) || {};
  for (const [pac, ests] of Object.entries(todos)) {
    for (const [id, m] of Object.entries(ests)) {
      if (estadoEstudio(m).id === 'vencido') { await borrarEstudio(pac, id, 'borrado-automatico'); borrados++; }
    }
  }
  return borrados;
}

/* ---------- Plan, tolerancia, verificación, solicitudes ---------- */
export async function guardarPlan(pacUid, plan, medico) {
  await B.escribir(`pacientes/${pacUid}/plan`, {
    ...plan,
    indicadoPor: { uid: medico.uid, nombre: `${medico.datos.nombre} ${medico.datos.apellido}`, matricula: `${medico.datos.matricula.tipo} ${medico.datos.matricula.numero}` },
    fecha: B.TS,
  });
  await auditar(pacUid, 'plan');
}

export const registrarTolerancia = (pacUid, reg) => B.agregar(`pacientes/${pacUid}/tolerancia`, { ...reg, fecha: B.TS });

export async function verificarIdentidad(pacUid, medico, valor = true) {
  await B.escribir(`verificados/${pacUid}`, valor ? { por: medico.uid, cuando: B.TS } : null);
  await auditar(pacUid, valor ? 'verifico-identidad' : 'quito-verificacion');
}

export const guardarNota = (pacUid, nota, medico) => B.agregar(`evaluaciones/${pacUid}`, { texto: String(nota).slice(0, 4000), por: medico.uid, nombre: `${medico.datos.nombre} ${medico.datos.apellido}`, cuando: B.TS });

export async function solicitar(pacUid, tipo, texto) {
  await B.agregar(`solicitudes/${pacUid}`, { tipo, texto: String(texto || '').slice(0, 1000), cuando: B.TS, estado: 'pendiente' });
}

/** Exporta todos los datos del paciente (derecho de acceso, art. 14 Ley 25.326). */
export async function exportarMisDatos(uid) {
  const [pac, estudios, auditoria, solicitudes] = await Promise.all([
    B.leer(`pacientes/${uid}`), B.leer(`estudios/${uid}`), B.leer(`auditoria/${uid}`), B.leer(`solicitudes/${uid}`),
  ]);
  const est = Object.fromEntries(Object.entries(estudios || {}).map(([k, m]) => [k, { ...m, bosquejo: undefined }]));
  return { exportado: new Date().toISOString(), app: CONFIG.app, paciente: pac, estudios: est, auditoria, solicitudes };
}
