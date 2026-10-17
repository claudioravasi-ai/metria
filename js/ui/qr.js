/* ============================================================
   Código QR (librería qrcode-generator, MIT, de cdnjs: se carga
   solo cuando se necesita) y lector con la cámara (BarcodeDetector,
   disponible en Chrome y Android; si no está, se escribe el código).
   ============================================================ */

import { h } from '../core/dom.js';

const URL_QR = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
let carga;
function cargar() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  carga ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = URL_QR; s.async = true; s.crossOrigin = 'anonymous';
    s.onload = () => res(window.qrcode); s.onerror = () => { carga = null; rej(new Error('qr')); };
    document.head.appendChild(s);
  });
  return carga;
}

/** Matriz de módulos del QR (true = negro). */
async function matriz(texto) {
  const qrcode = await cargar();
  const q = qrcode(0, 'M');
  q.addData(texto);
  q.make();
  const n = q.getModuleCount();
  return { n, oscuro: (f, c) => q.isDark(f, c) };
}

/** QR en SVG (nítido en pantalla e impresión). Devuelve un contenedor que se completa solo. */
export function qrSVG(texto, { tam = 160, color = '#0f172a', fondo = '#fff' } = {}) {
  const caja = h('div.qr', { style: { width: `${tam}px`, height: `${tam}px` }, role: 'img', 'aria-label': 'Código QR del turno' });
  matriz(texto).then(({ n, oscuro }) => {
    const m = 2; // margen en módulos
    let d = '';
    for (let f = 0; f < n; f++) for (let c = 0; c < n; c++) if (oscuro(f, c)) d += `M${c + m} ${f + m}h1v1h-1z`;
    caja.replaceChildren(h('svg', { viewBox: `0 0 ${n + 2 * m} ${n + 2 * m}`, width: tam, height: tam, 'shape-rendering': 'crispEdges' },
      h('rect', { width: n + 2 * m, height: n + 2 * m, fill: fondo }), h('path', { d, fill: color })));
  }).catch(() => caja.replaceChildren(h('small.qr-error', 'QR no disponible sin conexión: usá el código.')));
  return caja;
}

/** QR como imagen PNG en base64 (para adjuntarlo al correo). */
export async function qrPNG(texto, tam = 360) {
  const { n, oscuro } = await matriz(texto);
  const m = 2, k = Math.floor(tam / (n + 2 * m));
  const cv = document.createElement('canvas');
  cv.width = cv.height = k * (n + 2 * m);
  const c = cv.getContext('2d');
  c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height);
  c.fillStyle = '#0f172a';
  for (let f = 0; f < n; f++) for (let co = 0; co < n; co++) if (oscuro(f, co)) c.fillRect((co + m) * k, (f + m) * k, k, k);
  return cv.toDataURL('image/png').split(',')[1];
}

/* ---------- Lector con la cámara ----------
   1) BarcodeDetector nativo (Chrome / Android).
   2) Si no existe (iPhone, iPad, Safari, Firefox): jsQR, incluido en la app (js/vendor, Apache-2.0). */
let cargaJsQR;
function cargarJsQR() {
  if (window.jsQR) return Promise.resolve(window.jsQR);
  cargaJsQR ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'js/vendor/jsQR.min.js'; s.async = true;
    s.onload = () => res(window.jsQR); s.onerror = () => { cargaJsQR = null; rej(new Error('jsqr')); };
    document.head.appendChild(s);
  });
  return cargaJsQR;
}

export const puedeEscanear = () => !!navigator.mediaDevices?.getUserMedia;

/** Abre la cámara y llama a alLeer(texto) con el primer QR que encuentra. Devuelve { el, detener }. */
export function lectorQR(alLeer) {
  const video = h('video', { playsinline: true, muted: true, autoplay: true });
  video.setAttribute('playsinline', ''); // iPhone: que no abra el video a pantalla completa
  const estado = h('small.lector-estado', 'Abriendo la cámara…');
  const el = h('div.lector-qr', video, h('div.lector-mira'), estado);
  let stream, vivo = true;
  const detener = () => { vivo = false; stream?.getTracks().forEach((t) => t.stop()); };
  (async () => {
    try {
      const nativo = 'BarcodeDetector' in window ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null;
      const jsQR = nativo ? null : await cargarJsQR();
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (!vivo) { detener(); return; }
      video.srcObject = stream;
      await video.play();
      estado.textContent = 'Apuntá al QR del ticket';
      const lienzo = document.createElement('canvas');
      const ctx = lienzo.getContext('2d', { willReadFrequently: true });
      const leerCuadro = async () => {
        if (nativo) { const r = await nativo.detect(video); return r[0]?.rawValue || null; }
        const w = video.videoWidth, hh = video.videoHeight;
        if (!w || !hh) return null;
        const k = Math.min(1, 640 / Math.max(w, hh)); // cuadro chico: rápido y suficiente
        lienzo.width = Math.round(w * k); lienzo.height = Math.round(hh * k);
        ctx.drawImage(video, 0, 0, lienzo.width, lienzo.height);
        const img = ctx.getImageData(0, 0, lienzo.width, lienzo.height);
        return jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data || null;
      };
      const ciclo = async () => {
        if (!vivo || !el.isConnected) { detener(); return; }
        try { const txt = await leerCuadro(); if (txt) { detener(); navigator.vibrate?.(60); alLeer(txt); return; } } catch { /* cuadro sin QR */ }
        setTimeout(ciclo, 200);
      };
      ciclo();
    } catch (e) {
      console.warn(e);
      el.replaceChildren(h('p.ayuda', e?.name === 'NotAllowedError' ? 'No diste permiso para usar la cámara. Activalo en la configuración del navegador o escribí el código a mano.' : 'No se pudo abrir la cámara. Escribí el código a mano.'));
    }
  })();
  return { el, detener };
}

/** Lee un QR desde una foto (respaldo para cualquier celular: «Sacar foto del QR»). */
export async function leerQRImagen(archivo) {
  const jsQR = await cargarJsQR();
  const img = await createImageBitmap(archivo);
  const k = Math.min(1, 1200 / Math.max(img.width, img.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
  const c = cv.getContext('2d', { willReadFrequently: true });
  c.drawImage(img, 0, 0, cv.width, cv.height);
  const d = c.getImageData(0, 0, cv.width, cv.height);
  return jsQR(d.data, d.width, d.height, { inversionAttempts: 'attemptBoth' })?.data || null;
}
