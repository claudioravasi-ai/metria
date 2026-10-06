/* ============================================================
   Archivos de estudios en el navegador:
   tipo, bosquejo (miniatura borrosa), visor y descarga.
   El bosquejo es deliberadamente ilegible: muestra la forma del
   estudio sin revelar su contenido (minimización de datos).
   ============================================================ */

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';

export const TIPOS = {
  imagen: { nombre: 'Imagen', color: '#ec4899', icono: 'imagen' },
  pdf: { nombre: 'PDF', color: '#ef4444', icono: 'pdf' },
  video: { nombre: 'Video', color: '#8b5cf6', icono: 'video' },
  audio: { nombre: 'Audio', color: '#06b6d4', icono: 'audio' },
  texto: { nombre: 'Texto', color: '#64748b', icono: 'texto' },
  dicom: { nombre: 'DICOM', color: '#0ea5e9', icono: 'dicom' },
  documento: { nombre: 'Documento', color: '#2563eb', icono: 'texto' },
  planilla: { nombre: 'Planilla', color: '#16a34a', icono: 'tabla' },
  comprimido: { nombre: 'Comprimido', color: '#a16207', icono: 'caja' },
  otro: { nombre: 'Archivo', color: '#64748b', icono: 'archivo' },
};

export const ACEPTADOS = '.pdf,.jpg,.jpeg,.png,.webp,.gif,.heic,.dcm,.dicom,.mp4,.webm,.mov,.mp3,.wav,.m4a,.txt,.csv,.doc,.docx,.xls,.xlsx,.odt,.zip,.rar,.7z';

export function tipoDe(mime = '', nombre = '') {
  const ext = (nombre.split('.').pop() || '').toLowerCase();
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime === 'application/dicom' || ext === 'dcm' || ext === 'dicom') return 'dicom';
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'].includes(ext)) return 'imagen';
  if (mime.startsWith('video/') || ['mp4', 'webm', 'mov'].includes(ext)) return 'video';
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'm4a'].includes(ext)) return 'audio';
  if (mime.startsWith('text/') || ['txt', 'csv'].includes(ext)) return 'texto';
  if (['doc', 'docx', 'odt'].includes(ext)) return 'documento';
  if (['xls', 'xlsx', 'ods'].includes(ext)) return 'planilla';
  if (['zip', 'rar', '7z'].includes(ext)) return 'comprimido';
  return 'otro';
}

export const tamanoLegible = (b) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1).replace('.', ',')} MB`);

/* ---------- pdf.js a pedido ---------- */
let pdfjs = null;
export function cargarPdfJs() {
  if (pdfjs) return pdfjs;
  pdfjs = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = PDFJS + 'pdf.min.js';
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; res(window.pdfjsLib); };
    s.onerror = () => { pdfjs = null; rej(new Error('No se pudo cargar el visor de PDF')); };
    document.head.appendChild(s);
  });
  return pdfjs;
}

/* ---------- Bosquejo ---------- */
const W = 120, H = 160;
function pixelar(fuente, sw, sh) {
  // Reduce a 20×27 y vuelve a agrandar: queda la silueta, no el contenido.
  const chico = document.createElement('canvas');
  chico.width = 20; chico.height = 27;
  const c1 = chico.getContext('2d');
  c1.fillStyle = '#fff'; c1.fillRect(0, 0, 20, 27);
  const esc = Math.min(20 / sw, 27 / sh);
  c1.drawImage(fuente, 0, 0, sw, sh, (20 - sw * esc) / 2, (27 - sh * esc) / 2, sw * esc, sh * esc);
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const c2 = out.getContext('2d');
  c2.imageSmoothingEnabled = true;
  c2.imageSmoothingQuality = 'high';
  c2.filter = 'blur(2px)';
  c2.drawImage(chico, 0, 0, W, H);
  return out.toDataURL('image/jpeg', 0.7);
}

function cargarImagen(url) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
}

/** Devuelve un dataURL (~3–6 KB) o null si el formato no se puede dibujar. */
export async function generarBosquejo(archivo) {
  const tipo = tipoDe(archivo.type, archivo.name);
  const url = URL.createObjectURL(archivo);
  try {
    if (tipo === 'imagen') {
      const img = await cargarImagen(url);
      return pixelar(img, img.naturalWidth, img.naturalHeight);
    }
    if (tipo === 'pdf') {
      const lib = await cargarPdfJs();
      const doc = await lib.getDocument({ data: new Uint8Array(await archivo.arrayBuffer()) }).promise;
      const pag = await doc.getPage(1);
      const vp = pag.getViewport({ scale: 0.4 });
      const cv = document.createElement('canvas');
      cv.width = vp.width; cv.height = vp.height;
      await pag.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
      doc.destroy();
      return pixelar(cv, cv.width, cv.height);
    }
    if (tipo === 'video') {
      const v = document.createElement('video');
      v.muted = true; v.preload = 'auto'; v.src = url;
      await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = rej; setTimeout(rej, 4000); });
      v.currentTime = Math.min(1, v.duration / 2 || 0);
      await new Promise((res) => { v.onseeked = res; setTimeout(res, 1500); });
      return pixelar(v, v.videoWidth, v.videoHeight);
    }
    if (tipo === 'texto') {
      const txt = (await archivo.slice(0, 2000).text()).split('\n').slice(0, 30);
      const cv = document.createElement('canvas');
      cv.width = 300; cv.height = 400;
      const c = cv.getContext('2d');
      c.fillStyle = '#fff'; c.fillRect(0, 0, 300, 400);
      c.fillStyle = '#333'; c.font = '11px monospace';
      txt.forEach((l, i) => c.fillText(l.slice(0, 48), 10, 18 + i * 13));
      return pixelar(cv, 300, 400);
    }
  } catch (e) {
    console.warn('Sin bosquejo', e);
  } finally {
    URL.revokeObjectURL(url);
  }
  return null;
}

/* ---------- Visor ---------- */
/**
 * Muestra el blob dentro de `cont`. Devuelve una función de limpieza
 * que libera la memoria (se llama al cerrar la ventana).
 */
export async function mostrarEnVisor(blob, meta, cont) {
  const tipo = tipoDe(meta.mime, meta.nombre);
  const url = URL.createObjectURL(blob);
  const limpiar = () => { URL.revokeObjectURL(url); cont.replaceChildren(); };
  cont.replaceChildren();
  const add = (el) => (cont.appendChild(el), el);
  if (tipo === 'imagen') {
    const img = add(document.createElement('img'));
    img.src = url; img.alt = meta.titulo; img.className = 'visor-img';
  } else if (tipo === 'pdf') {
    try {
      const lib = await cargarPdfJs();
      const doc = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
      const ancho = Math.min(cont.clientWidth || 800, 1000);
      for (let i = 1; i <= Math.min(doc.numPages, 30); i++) {
        const pag = await doc.getPage(i);
        const base = pag.getViewport({ scale: 1 });
        const escala = (ancho / base.width) * (window.devicePixelRatio || 1);
        const vp = pag.getViewport({ scale: escala });
        const cv = add(document.createElement('canvas'));
        cv.className = 'visor-pagina';
        cv.width = vp.width; cv.height = vp.height;
        await pag.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
      }
      if (doc.numPages > 30) add(Object.assign(document.createElement('p'), { className: 'visor-nota', textContent: `Se muestran 30 de ${doc.numPages} páginas. Descargalo para verlo completo.` }));
      doc.destroy();
    } catch {
      const f = add(document.createElement('iframe'));
      f.src = url; f.title = meta.titulo; f.className = 'visor-iframe';
    }
  } else if (tipo === 'video') {
    const v = add(document.createElement('video'));
    v.src = url; v.controls = true; v.className = 'visor-img';
  } else if (tipo === 'audio') {
    const a = add(document.createElement('audio'));
    a.src = url; a.controls = true;
  } else if (tipo === 'texto') {
    const pre = add(document.createElement('pre'));
    pre.className = 'visor-texto';
    pre.textContent = (await blob.slice(0, 200000).text());
  } else {
    add(Object.assign(document.createElement('p'), {
      className: 'visor-nota',
      textContent: `La vista previa no está disponible para archivos ${TIPOS[tipo].nombre}. Descargalo para abrirlo con la aplicación adecuada${tipo === 'dicom' ? ' (un visor DICOM)' : ''}.`,
    }));
  }
  return limpiar;
}

export function descargarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombre || 'estudio';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
