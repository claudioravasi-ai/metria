/* ============================================================
   Backend de DEMOSTRACIÓN (sin servidor)
   ------------------------------------------------------------
   Imita la API de Firebase (autenticación + base en árbol) usando
   IndexedDB del navegador. Sirve para probar la app sin configurar nada.
   - Las contraseñas se guardan con PBKDF2-SHA256 (nunca en texto plano).
   - Los archivos de estudios van a un almacén aparte, por partes.
   - Varias pestañas o ventanas del mismo navegador se sincronizan en vivo
     (BroadcastChannel), igual que varios equipos con Firebase.
   - Reproduce las reglas clave de la base real (quién lee qué y el
     vencimiento de los estudios) para que la demo se comporte igual.
   ============================================================ */

import { CONFIG, MS_DIA, MS_HORA } from '../config.js';
import { esCorreoCoordinador, uidPaciente } from '../core/cripto.js';

export const modo = 'demo';
export const TS = Object.freeze({ '.sv': 'timestamp' });

const DB_NOMBRE = 'metria-demo-v2'; // v2: pacientes con código; la base vieja se descarta
const CLAVE_RELOJ = 'metria-demo-reloj';
const CLAVE_SESION = 'metria-demo-sesion';

let idb, arbol = {}, sesion = null;
const oyentesSesion = new Set();
const oyentes = new Map(); // ruta → Set(cb)
const canal = 'BroadcastChannel' in self ? new BroadcastChannel('metria-demo') : null;

/* ---------- Reloj (se puede adelantar para probar vencimientos) ---------- */
const desfase = () => { try { return +localStorage.getItem(CLAVE_RELOJ) || 0; } catch { return 0; } };
export const ahora = () => Date.now() + desfase();
export function adelantarReloj(ms) {
  try { localStorage.setItem(CLAVE_RELOJ, String(desfase() + ms)); } catch { /* sin almacenamiento */ }
  canal?.postMessage({ tipo: 'reloj' });
}
export const relojAdelantado = () => desfase();

/* ---------- IndexedDB ---------- */
function abrir() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NOMBRE, 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('arbol');
      d.createObjectStore('archivos');
      d.createObjectStore('cuentas');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
function tx(store, modoTx, fn) {
  return new Promise((res, rej) => {
    const t = idb.transaction(store, modoTx);
    const s = t.objectStore(store);
    let out;
    Promise.resolve(fn(s)).then((v) => { out = v; });
    t.oncomplete = () => res(out);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
}
const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

async function cargarArbol() {
  arbol = (await tx('arbol', 'readonly', (s) => req(s.get('raiz')))) || {};
}
let guardando = Promise.resolve();
function guardarArbol() {
  const copia = JSON.parse(JSON.stringify(arbol));
  guardando = guardando.then(() => tx('arbol', 'readwrite', (s) => s.put(copia, 'raiz')));
  return guardando;
}

/* ---------- Árbol ---------- */
const partes = (ruta) => String(ruta).split('/').filter(Boolean);
const clonar = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));

function obtener(ruta) {
  let n = arbol;
  for (const p of partes(ruta)) {
    if (n == null || typeof n !== 'object') return null;
    n = n[p];
  }
  return n === undefined ? null : n;
}
function poner(ruta, valor) {
  const ps = partes(ruta);
  if (!ps.length) { arbol = valor || {}; return; }
  let n = arbol;
  const pila = [];
  for (let i = 0; i < ps.length - 1; i++) {
    if (n[ps[i]] == null || typeof n[ps[i]] !== 'object') n[ps[i]] = {};
    pila.push([n, ps[i]]);
    n = n[ps[i]];
  }
  const ult = ps[ps.length - 1];
  if (valor === null || valor === undefined) delete n[ult];
  else n[ult] = valor;
  // Firebase no guarda nodos vacíos
  for (let i = pila.length - 1; i >= 0; i--) {
    const [padre, k] = pila[i];
    if (padre[k] && typeof padre[k] === 'object' && !Object.keys(padre[k]).length) delete padre[k];
  }
}
function resolverTS(v) {
  if (v && typeof v === 'object') {
    if (v['.sv'] === 'timestamp') return ahora();
    const o = Array.isArray(v) ? [] : {};
    for (const [k, x] of Object.entries(v)) o[k] = resolverTS(x);
    return o;
  }
  return v;
}

/* ---------- Reglas (versión resumida de reglas-firebase.json) ---------- */
const VENCE_DESCARGA = CONFIG.horasTrasDescarga * MS_HORA;
const RETENCION = CONFIG.diasRetencionMaxima * MS_DIA;

function rol() {
  if (!sesion) return { tipo: null };
  const m = arbol.medicos?.[sesion.uid];
  if (m) {
    const titular = !!sesion.coord || !!m.demoTitular; // titular = coordinador/a
    const aprobado = titular || arbol.medicosEstado?.[sesion.uid] === 'aprobado';
    return { tipo: 'medico', aprobado, titular };
  }
  return { tipo: 'paciente' };
}

function puedeLeer(ruta) {
  const [a, b, c] = partes(ruta);
  const r = rol();
  if (!sesion) return false;
  const med = r.tipo === 'medico' && r.aprobado;
  switch (a) {
    case 'medicos': return b === sesion.uid || r.titular || (med && !!b);
    case 'medicosEstado': return b === sesion.uid || r.titular;
    case 'indice': case 'estudiosVenc': case 'solicitudesTodas': return med;
    case 'pacientes': case 'estudios': case 'auditoria': case 'verificados': case 'solicitudes':
      return b === sesion.uid || med;
    case 'evaluaciones': return med;
    case 'estudiosArchivos': {
      if (med) return true;
      if (b !== sesion.uid || !c) return false;
      const meta = arbol.estudios?.[b]?.[c];
      if (!meta) return false;
      if (meta.subidoEn + RETENCION <= ahora()) return false;
      return !meta.descargadoEn || meta.descargadoEn + VENCE_DESCARGA > ahora();
    }
    default: return false;
  }
}

function puedeEscribir(ruta, valor) {
  const [a, b, c, d] = partes(ruta);
  const r = rol();
  if (!sesion) return false;
  const med = r.tipo === 'medico' && r.aprobado;
  const propio = b === sesion.uid;
  switch (a) {
    case 'medicos': return propio || r.titular;
    case 'medicosEstado': return r.titular || (propio && !arbol.medicosEstado?.[b] && valor === 'pendiente');
    case 'pacientes':
      if (c === 'plan') return med;
      return propio || med;
    case 'indice': return propio || med;
    case 'verificados': case 'evaluaciones': return med;
    case 'auditoria': return propio || med;
    case 'solicitudes': return propio || med;
    case 'estudios': {
      if (med) return true;
      // El paciente solo puede marcar la descarga (una vez) o borrar lo vencido
      const meta = arbol.estudios?.[b]?.[c];
      if (!propio || !meta) return false;
      if (d === 'descargadoEn') return !meta.descargadoEn;
      if (!d && valor === null) return vencido(meta);
      return false;
    }
    case 'estudiosVenc': return med || (propio && valor !== null) || (propio && valor === null && vencido(arbol.estudios?.[b]?.[c]));
    case 'estudiosArchivos': return med || (propio && valor === null && vencido(arbol.estudios?.[b]?.[c]));
    default: return false;
  }
}

export function vencido(meta) {
  if (!meta) return true;
  const t = ahora();
  return (meta.descargadoEn && meta.descargadoEn + VENCE_DESCARGA <= t) || meta.subidoEn + RETENCION <= t;
}

const denegado = (ruta) => Object.assign(new Error(`Permiso denegado: ${partes(ruta)[0]}`), { code: 'PERMISSION_DENIED' });

/* ---------- Archivos (almacén aparte) ---------- */
const esArchivo = (ruta) => partes(ruta)[0] === 'estudiosArchivos';
async function leerArchivo(ruta) {
  const ps = partes(ruta);
  if (ps.length === 4) return tx('archivos', 'readonly', (s) => req(s.get(ps.join('/'))));
  const pref = ps.join('/') + '/';
  const claves = await tx('archivos', 'readonly', (s) => req(s.getAllKeys(IDBKeyRange.bound(pref, pref + '￿'))));
  return claves.length ? { partes: claves.length } : null;
}
async function escribirArchivo(ruta, valor) {
  const ps = partes(ruta);
  if (ps.length === 4) return tx('archivos', 'readwrite', (s) => (valor == null ? s.delete(ps.join('/')) : s.put(valor, ps.join('/'))));
  if (valor !== null) throw new Error('Escritura de archivo inválida');
  const pref = ps.join('/') + '/';
  return tx('archivos', 'readwrite', (s) => s.delete(IDBKeyRange.bound(pref, pref + '￿')));
}

/* ---------- Notificación a oyentes ---------- */
function afecta(a, b) {
  const pa = partes(a).join('/'), pb = partes(b).join('/');
  return pa === pb || pa.startsWith(pb + '/') || pb.startsWith(pa + '/') || !pa || !pb;
}
function notificar(rutas) {
  for (const [ruta, set] of oyentes) {
    if (!rutas.some((r) => afecta(r, ruta))) continue;
    for (const cb of set) {
      try { cb(puedeLeer(ruta) ? clonar(obtener(ruta)) : null); } catch (e) { console.error(e); }
    }
  }
}
canal && (canal.onmessage = async (e) => {
  if (e.data?.tipo === 'cambio') { await cargarArbol(); notificar(e.data.rutas); }
  if (e.data?.tipo === 'reloj') notificar(['']);
});
async function confirmar(rutas) {
  await guardarArbol();
  notificar(rutas);
  canal?.postMessage({ tipo: 'cambio', rutas });
}

/* ---------- API de base ---------- */
export async function leer(ruta) {
  if (!puedeLeer(ruta)) throw denegado(ruta);
  if (esArchivo(ruta)) return leerArchivo(ruta);
  return clonar(obtener(ruta));
}
export async function escribir(ruta, valor) {
  const v = resolverTS(clonar(valor));
  if (!puedeEscribir(ruta, v)) throw denegado(ruta);
  if (esArchivo(ruta)) return escribirArchivo(ruta, v);
  poner(ruta, v);
  await confirmar([ruta]);
}
export async function actualizar(ruta, cambios) {
  const base = partes(ruta).join('/');
  const lista = Object.entries(cambios).map(([k, v]) => [base ? `${base}/${k}` : k, resolverTS(clonar(v))]);
  for (const [r, v] of lista) if (!puedeEscribir(r, v)) throw denegado(r);
  const rutas = [];
  for (const [r, v] of lista) {
    if (esArchivo(r)) await escribirArchivo(r, v);
    else { poner(r, v); rutas.push(r); }
  }
  if (rutas.length) await confirmar(rutas);
}
export const borrar = (ruta) => escribir(ruta, null);

const ALFA = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
let ultimo = 0;
export function nuevaClave() {
  let t = ahora();
  if (t <= ultimo) t = ultimo + 1;
  ultimo = t;
  let s = '';
  for (let i = 0; i < 8; i++) { s = ALFA[t % 64] + s; t = Math.floor(t / 64); }
  const r = crypto.getRandomValues(new Uint8Array(12));
  for (const b of r) s += ALFA[b % 64];
  return s;
}
export async function agregar(ruta, valor) {
  const k = nuevaClave();
  await escribir(`${ruta}/${k}`, valor);
  return k;
}
export function escuchar(ruta, cb) {
  if (!oyentes.has(ruta)) oyentes.set(ruta, new Set());
  oyentes.get(ruta).add(cb);
  queueMicrotask(() => { try { cb(puedeLeer(ruta) ? clonar(obtener(ruta)) : null); } catch (e) { console.error(e); } });
  return () => oyentes.get(ruta)?.delete(cb);
}

/* ---------- Autenticación ---------- */
const te = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function derivar(clave, sal) {
  const k = await crypto.subtle.importKey('raw', te.encode(clave), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: te.encode(sal), iterations: 150000, hash: 'SHA-256' }, k, 256));
}
const normEmail = (e) => String(e || '').trim().toLowerCase();
const publico = () => (sesion ? { uid: sesion.uid, email: sesion.email, verificado: true, paciente: !!sesion.paciente } : null);
function emitirSesion() {
  const u = publico();
  oyentesSesion.forEach((cb) => cb(u));
}
function guardarSesion(recordar) {
  try {
    sessionStorage.removeItem(CLAVE_SESION); localStorage.removeItem(CLAVE_SESION);
    if (sesion) (recordar ? localStorage : sessionStorage).setItem(CLAVE_SESION, JSON.stringify(sesion));
  } catch { /* privado */ }
}
const errorAuth = (code) => Object.assign(new Error(code), { code });
async function abrirSesion(datos, recordar) {
  sesion = { ...datos, coord: !datos.paciente && (await esCorreoCoordinador(datos.email, CONFIG.coordinadorHash)) };
  guardarSesion(recordar);
  emitirSesion();
}

export function alCambiarSesion(cb) {
  oyentesSesion.add(cb);
  queueMicrotask(() => cb(publico()));
  return () => oyentesSesion.delete(cb);
}

/* Profesionales: correo y contraseña */
export async function ingresar(email, clave, recordar = false) {
  const e = normEmail(email);
  const c = await tx('cuentas', 'readonly', (s) => req(s.get(e)));
  // Mismo mensaje exista o no la cuenta (no revela qué correos están registrados)
  if (!c || !c.hash || (await derivar(clave, c.sal)) !== c.hash) throw errorAuth('auth/invalid-credential');
  await abrirSesion({ uid: c.uid, email: e }, recordar);
}
export async function registrar(email, clave) {
  const e = normEmail(email);
  const existe = await tx('cuentas', 'readonly', (s) => req(s.get(e)));
  if (existe) throw errorAuth('auth/email-already-in-use');
  const sal = hex(crypto.getRandomValues(new Uint8Array(16)));
  const uid = 'u' + nuevaClave().replace(/[-_]/g, 'x');
  const hash = await derivar(clave, sal); // fuera de la transacción: IndexedDB no espera promesas ajenas
  await tx('cuentas', 'readwrite', (s) => s.put({ uid, sal, hash }, e));
  await abrirSesion({ uid, email: e }, false);
  return { uid };
}

/* Pacientes: código de un solo uso por correo (en la demo el "correo" se muestra en pantalla) */
const codigos = new Map();
export async function pedirCodigo(email) {
  const e = normEmail(email);
  const previo = codigos.get(e);
  if (previo && ahora() - previo.enviado < 55000) throw errorAuth('codigo/espera');
  const c = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
  codigos.set(e, { c, exp: ahora() + CONFIG.minutosCodigo * 60000, intentos: 0, enviado: ahora() });
  return { demo: c };
}
export async function ingresarConCodigo(email, codigo, recordar = false) {
  const e = normEmail(email);
  const x = codigos.get(e);
  if (!x || x.exp < ahora()) throw errorAuth('codigo/vencido');
  if (x.c !== String(codigo).replace(/\D/g, '')) {
    x.intentos++;
    if (x.intentos >= 5) { codigos.delete(e); throw errorAuth('codigo/bloqueado'); }
    throw errorAuth('codigo/incorrecto');
  }
  codigos.delete(e);
  const cuenta = await tx('cuentas', 'readonly', (s) => req(s.get(e)));
  if (cuenta?.hash) throw errorAuth('codigo/es-profesional');
  const uid = cuenta?.uid || (await uidPaciente(e));
  if (!cuenta) await tx('cuentas', 'readwrite', (s) => s.put({ uid, tipo: 'paciente' }, e));
  await abrirSesion({ uid, email: e, paciente: true }, recordar);
}

export async function salir() {
  sesion = null;
  guardarSesion(false);
  emitirSesion();
}
export async function restablecer() { /* En la demo no hay correo: se informa igual de forma genérica. */ }
export async function reenviarVerificacion() { /* La demo da los correos por verificados. */ }
export async function recargarUsuario() { return publico(); }
export async function cambiarClave(actual, nueva) {
  if (!sesion || sesion.paciente) throw errorAuth('auth/no-session');
  const c = await tx('cuentas', 'readonly', (s) => req(s.get(sesion.email)));
  if (!c?.hash) throw errorAuth('auth/demo-account');
  if ((await derivar(actual, c.sal)) !== c.hash) throw errorAuth('auth/invalid-credential');
  const sal = hex(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await derivar(nueva, sal);
  await tx('cuentas', 'readwrite', (s) => s.put({ uid: c.uid, sal, hash }, sesion.email));
}
/** Cambio de correo de un profesional (en la demo se aplica al instante). */
export async function cambiarCorreo(clave, nuevo) {
  if (!sesion || sesion.paciente) throw errorAuth('auth/no-session');
  const e = normEmail(nuevo);
  const c = await tx('cuentas', 'readonly', (s) => req(s.get(sesion.email)));
  if (!c?.hash) throw errorAuth('auth/demo-account');
  if ((await derivar(clave, c.sal)) !== c.hash) throw errorAuth('auth/invalid-credential');
  if (await tx('cuentas', 'readonly', (s) => req(s.get(e)))) throw errorAuth('auth/email-already-in-use');
  await tx('cuentas', 'readwrite', (s) => { s.delete(sesion.email); s.put(c, e); });
  await abrirSesion({ uid: c.uid, email: e }, !!localStorage.getItem(CLAVE_SESION));
  return { inmediato: true };
}
export const usuario = () => publico();
/** En la demo no hay servidor de IA. */
export async function analizarIA() { throw Object.assign(new Error('sin servidor'), { code: 'ia/sin-servidor' }); }

/* ---------- Atajos de la demo ---------- */
export async function entrarComo(uid, email, paciente = false) {
  await abrirSesion({ uid, email, paciente }, false);
}
export async function reiniciarDemo() {
  idb.close();
  await new Promise((res) => { const r = indexedDB.deleteDatabase(DB_NOMBRE); r.onsuccess = r.onerror = r.onblocked = () => res(); });
  try { localStorage.removeItem(CLAVE_RELOJ); localStorage.removeItem(CLAVE_SESION); sessionStorage.removeItem(CLAVE_SESION); } catch { /* */ }
}
export const arbolVacio = () => !Object.keys(arbol).length;
/** Escritura sin reglas, solo para sembrar los datos de ejemplo. */
export async function sembrar(datos, archivos = {}, cuentas = {}) {
  arbol = resolverTS(datos);
  await guardarArbol();
  for (const [k, v] of Object.entries(archivos)) await tx('archivos', 'readwrite', (s) => s.put(v, k));
  for (const [k, v] of Object.entries(cuentas)) await tx('cuentas', 'readwrite', (s) => s.put(v, k));
}

export async function iniciar() {
  try { indexedDB.deleteDatabase('metria-demo'); } catch { /* versión anterior de la demo */ }
  idb = await abrir();
  await cargarArbol();
  try {
    const s = sessionStorage.getItem(CLAVE_SESION) || localStorage.getItem(CLAVE_SESION);
    if (s) sesion = JSON.parse(s);
  } catch { sesion = null; }
}
