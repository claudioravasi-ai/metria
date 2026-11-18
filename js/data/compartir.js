/* ============================================================
   Compartir un estudio con otro médico (pedido de Claudio, 18-11-2026)
   - El paciente crea un enlace con contraseña desde el visor.
   - El archivo se CIFRA en su teléfono (AES-GCM 256, clave derivada de la
     contraseña con PBKDF2-SHA-256): la base guarda solo datos ilegibles y
     la contraseña nunca sale del teléfono.
   - Vence solo (como máximo 72 h y nunca después que el estudio) y el
     servidor lo borra. El paciente lo puede anular antes.
   Base:
     compartidos/<tok>          { pac, estudio, vence, creado, partes, sal, iv, ivMeta, metaCif, tamano, listo, vistas/<k> }
     compartidosArchivos/<tok>/<i>   partes cifradas (base64)
     compartidosPac/<pac>/<tok> { estudio, titulo, vence, creado }   (para que el paciente vea y anule los suyos)
   ============================================================ */

import { CONFIG, MS_HORA } from '../config.js';
import { backend, PARTE, auditar } from './servicio.js';

const B = () => backend();
const te = new TextEncoder();
const td = new TextDecoder();
const ITER = 210000;
const LETRAS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I/L para dictarla sin errores

const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const deB64 = (s) => { const x = atob(s); const o = new Uint8Array(x.length); for (let i = 0; i < x.length; i++) o[i] = x.charCodeAt(i); return o; };
const b64url = (u8) => b64(u8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const normalizarClave = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
function nuevaContrasena() {
  const r = crypto.getRandomValues(new Uint8Array(8));
  const c = [...r].map((b) => LETRAS[b % LETRAS.length]).join('');
  return `${c.slice(0, 4)}-${c.slice(4)}`;
}
async function claveDe(contrasena, sal) {
  const base = await crypto.subtle.importKey('raw', te.encode(normalizarClave(contrasena)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: sal, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export const enlaceDe = (tok) => `${location.origin}${location.pathname}#c/${tok}`;

/** Crea el enlace. `vence` ya viene acotado por quien llama (horas pedidas y vencimiento del estudio). */
export async function compartirEstudio(pacUid, id, meta, blob, { horas = CONFIG.horasCompartir, venceEstudio = Infinity } = {}, progreso = () => {}) {
  const tok = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const contrasena = nuevaContrasena();
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ivMeta = crypto.getRandomValues(new Uint8Array(12));
  const clave = await claveDe(contrasena, sal);
  const cif = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, clave, await blob.arrayBuffer()));
  const metaCif = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ivMeta }, clave, te.encode(JSON.stringify({ titulo: meta.titulo, nombre: meta.nombre, mime: meta.mime, fechaEstudio: meta.fechaEstudio || null }))));
  const texto = b64(cif);
  const partes = Math.max(1, Math.ceil(texto.length / PARTE));
  const vence = Math.min(B().ahora() + Math.min(horas, CONFIG.horasCompartir) * MS_HORA, venceEstudio);
  if (vence <= B().ahora() + 10 * 60000) throw Object.assign(new Error('El estudio vence en minutos'), { code: 'VENCE-YA' });
  // 1) la ficha (sin «listo»: nadie la puede leer todavía), 2) las partes, 3) «listo»
  await B().escribir(`compartidos/${tok}`, { pac: pacUid, estudio: id, vence, creado: B().TS, partes, sal: b64(sal), iv: b64(iv), ivMeta: b64(ivMeta), metaCif: b64(metaCif), tamano: blob.size, listo: false });
  for (let i = 0; i < partes; i++) {
    await B().escribir(`compartidosArchivos/${tok}/${i}`, texto.slice(i * PARTE, (i + 1) * PARTE));
    progreso((i + 1) / partes);
  }
  await B().escribir(`compartidos/${tok}/listo`, true);
  await B().escribir(`compartidosPac/${pacUid}/${tok}`, { estudio: id, titulo: String(meta.titulo || '').slice(0, 120), vence, creado: B().TS });
  await auditar(pacUid, 'compartio', id, { estudioTitulo: meta.titulo });
  return { tok, contrasena, enlace: enlaceDe(tok), vence };
}

/** El paciente anula un enlace antes de que venza. */
export async function anularEnlace(pacUid, tok, titulo = null) {
  const vistas = Object.keys((await B().leer(`compartidos/${tok}/vistas`).catch(() => null)) || {}).length;
  await B().borrar(`compartidosArchivos/${tok}`).catch(() => {});
  await B().borrar(`compartidos/${tok}`).catch(() => {});
  await B().borrar(`compartidosPac/${pacUid}/${tok}`);
  await auditar(pacUid, 'anulo-enlace', null, { estudioTitulo: titulo, detalle: `el otro médico lo abrió ${vistas === 1 ? '1 vez' : `${vistas} veces`}` });
}

/** Lado del médico que recibe el enlace (sin cuenta). */
export async function leerCompartido(tok) {
  try { return await B().leer(`compartidos/${tok}`); } catch { return null; }
}
export async function abrirCompartido(tok, c, contrasena, progreso = () => {}) {
  const clave = await claveDe(contrasena, deB64(c.sal));
  let meta;
  try { meta = JSON.parse(td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(c.ivMeta) }, clave, deB64(c.metaCif)))); } catch { throw Object.assign(new Error('Contraseña incorrecta'), { code: 'CLAVE' }); }
  let texto = '';
  for (let i = 0; i < c.partes; i++) {
    const t = await B().leer(`compartidosArchivos/${tok}/${i}`);
    if (typeof t !== 'string') throw Object.assign(new Error('El enlace ya no está disponible'), { code: 'VENCIDO' });
    texto += t;
    progreso((i + 1) / c.partes);
  }
  const datos = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(c.iv) }, clave, deB64(texto));
  // Constancia de que se abrió (la ve el paciente). Sin datos de quién: el que abre no tiene cuenta.
  B().escribir(`compartidos/${tok}/vistas/${B().nuevaClave()}`, B().TS).catch(() => {});
  return { meta, blob: new Blob([datos], { type: meta.mime || 'application/octet-stream' }) };
}
