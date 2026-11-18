/* ============================================================
   Estudios médicos
   - El paciente ve solo un bosquejo (miniatura borrosa) y los datos
     básicos. Al tocarlo, una ventana avisa que va a ver información
     sensible; recién ahí se "trae" el archivo de la base.
   - Al abrirlo o descargarlo por primera vez empieza la cuenta regresiva:
     72 h y se borra de la base (18-11-2026: antes solo con «Descargar»).
     La app aconseja guardarlo en el dispositivo.
   - El médico sube archivos (PDF, imágenes, DICOM, video, texto,
     planillas, comprimidos) arrastrándolos o eligiéndolos.
   ============================================================ */

import { h } from '../core/dom.js';
import { icono } from '../core/iconos.js';
import { heroe, tarjeta, chip, aviso, modal, toast, confirmar, fecha, fechaHora, duracion, progreso, vacio, cargando } from '../core/ui.js';
import { CONFIG } from '../config.js';
import { backend, estadoEstudio, traerEstudio, marcarDescarga, marcarRetiro, subirEstudio, borrarEstudio } from '../data/servicio.js';
import { compartirEstudio, anularEnlace } from '../data/compartir.js';
import { TIPOS, tipoDe, tamanoLegible, generarBosquejo, mostrarEnVisor, descargarBlob, ACEPTADOS, achicarImagen } from '../data/archivos.js';

export const CATEGORIAS = [
  ['laboratorio', 'Laboratorio'], ['imagenes', 'Imágenes'], ['cardiologia', 'Cardiología'], ['informe', 'Informe médico'],
  ['receta', 'Indicaciones'], ['otro', 'Otro'],
];
const nombreCat = (c) => (CATEGORIAS.find(([k]) => k === c) || [, 'Otro'])[1];

/* ---------- Tarjeta de estudio (bosquejo) ---------- */
function tarjetaEstudio(id, m, { onAbrir, onBorrar, esMedico }) {
  const tipo = tipoDe(m.mime, m.nombre);
  const T = TIPOS[tipo];
  const est = estadoEstudio(m);
  const estado = est.id === 'descargado'
    ? chip(`Se borra en ${duracion(est.resta)}`, est.resta < 86400000 ? 'peligro' : 'aviso', 'reloj')
    : est.id === 'vencido' ? chip('Vencido', 'neutro', 'candado')
      : chip(esMedico ? 'Sin abrir' : 'Nuevo', 'ok', 'chispa');
  const boceto = m.bosquejo
    ? h('img.estudio-bosquejo', { src: m.bosquejo, alt: '', draggable: false })
    : h('div.estudio-bosquejo.estudio-bosquejo--icono', { style: { '--tipo': T.color } }, icono(T.icono, { tam: 40 }));
  return h('article.estudio', { style: { '--tipo': T.color } },
    h('button.estudio-abrir', { type: 'button', onclick: () => onAbrir(id, m), disabled: est.id === 'vencido' && !esMedico, 'aria-label': `Ver ${m.titulo}` },
      h('div.estudio-marco', boceto, h('span.estudio-tipo', T.nombre), h('span.estudio-candado', icono('candado', { tam: 16 })), h('span.estudio-ver', icono('ojo', { tam: 18 }), 'Ver estudio')),
      h('div.estudio-info',
        h('strong', m.titulo),
        h('small', `${nombreCat(m.categoria)} · ${m.fechaEstudio ? fecha(m.fechaEstudio) : fecha(m.subidoEn)} · ${tamanoLegible(m.tamano)}${m.descargas ? ` · Descargas: ${m.descargas} de ${CONFIG.maxDescargas}` : ''}`),
        estado)),
    esMedico && onBorrar ? h('button.btn-icono.estudio-borrar', { type: 'button', 'aria-label': `Borrar ${m.titulo}`, onclick: () => onBorrar(id, m) }, icono('basura', { tam: 16 })) : null);
}

/* ---------- Abrir: aviso → traer → visor → descargar ---------- */
export async function abrirEstudio(pacUid, id, m, { esPaciente }) {
  const est = estadoEstudio(m);
  if (est.id === 'vencido' && esPaciente) { toast('Este estudio ya venció y se borró por seguridad. Pedíselo a tu médico si lo necesitás.', 'info', 5000); return; }

  const ok = await confirmar({
    titulo: 'Vas a ver un estudio médico',
    icono: 'candado',
    color: ['#10b981', '#84cc16'],
    si: 'Traer y ver', no: 'Ahora no',
    texto: h('div',
      h('p', h('strong', 'Contiene información de salud sensible.'), ' Asegurate de estar en un lugar privado y de que nadie más vea tu pantalla.'),
      h('ul.lista.lista--chica',
        h('li', 'El archivo se trae de la base de datos solo a este equipo y no se guarda en la app.'),
        esPaciente
          ? (m.descargadoEn
            ? h('li', h('strong', `Ya lo retiraste: se borra en ${duracion(est.resta)}.`), ' Descargalo y guardalo en tu dispositivo.')
            : h('li', h('strong', `Al abrirlo empieza la cuenta: queda disponible ${CONFIG.horasTrasDescarga / 24} días más (podés volver a verlo y descargarlo hasta ${CONFIG.maxDescargas} veces) y después se borra para siempre`), ' (así nadie más puede retirarlo).'))
          : h('li', 'La apertura queda registrada en el historial de accesos del paciente.'),
        h('li', 'Queda registrado que lo abriste (sin copiar el contenido).'))),
  });
  if (!ok) return;

  const visor = h('div.visor');
  const barra = progreso();
  const carga = h('div.visor-carga', h('p', 'Trayendo el estudio de la base de datos…'), barra.el);
  visor.append(carga);
  let blob = null, limpiar = () => {};
  const btnDesc = h('button.btn.btn--primario', { type: 'button', disabled: true, onclick: () => descargar() }, icono('bajar', { tam: 18 }), 'Descargar');
  const quedan = () => CONFIG.maxDescargas - (m.descargas || 0);
  const btnTxt = () => { if (esPaciente) btnDesc.lastChild.textContent = `Descargar (${quedan()} de ${CONFIG.maxDescargas})`; };
  btnTxt();
  const slotChip = h('span.visor-chip', est.id === 'descargado' ? chip(`Se borra en ${duracion(est.resta)}`, 'aviso', 'reloj') : null);
  const btnComp = esPaciente ? h('button.btn.btn--suave', { type: 'button', disabled: true, onclick: () => compartir() }, icono('copiar', { tam: 18 }), 'Compartir con otro médico') : null;
  const pie = h('div.visor-pie', slotChip, btnComp, btnDesc);
  const ventana = modal({
    titulo: m.titulo, ancho: 980, clase: 'modal--visor', color: ['#10b981', '#84cc16'],
    cuerpo: h('div', h('div.visor-meta', chip(TIPOS[tipoDe(m.mime, m.nombre)].nombre, 'info'), h('small', `${m.nombre} · ${tamanoLegible(m.tamano)}${m.fechaEstudio ? ' · ' + fecha(m.fechaEstudio) : ''}`)), m.nota ? aviso('info', m.nota) : null, visor),
    acciones: [pie],
    alCerrar: () => { limpiar(); blob = null; },
  });
  try {
    blob = await traerEstudio(pacUid, id, m, barra.set);
    if (esPaciente && !m.descargadoEn) await retirado();
    limpiar = await mostrarEnVisor(blob, m, visor);
    btnDesc.disabled = false;
    if (btnComp) btnComp.disabled = false;
  } catch (e) {
    console.warn(e);
    visor.replaceChildren(vacio('candado', 'No disponible', e.code === 'VENCIDO' || /denegado|permission/i.test(e.message)
      ? 'El estudio venció y ya no se puede retirar. Si lo necesitás, pedíselo a tu médico.'
      : 'No se pudo traer el estudio. Revisá la conexión e intentá de nuevo.'));
  }

  /* La marca se guarda ANTES de mostrar o entregar el archivo: si el teléfono corta después, la cuenta ya empezó. */
  async function retirado() {
    try {
      await marcarRetiro(pacUid, id, m);
      m.descargadoEn = backend().ahora();
      slotChip.replaceChildren(chip(`Se borra en ${duracion(estadoEstudio(m).resta)}`, 'aviso', 'reloj'));
    } catch (e) { console.warn('No se pudo marcar el retiro', e.code || e); }
  }
  /* Compartir con otro médico: enlace + contraseña, cifrado en este teléfono, vence solo (18-11-2026) */
  async function compartir() {
    if (!blob) return;
    const venceEst = estadoEstudio(m).vence;
    const maxH = Math.max(1, Math.min(CONFIG.horasCompartir, Math.floor((venceEst - backend().ahora()) / 3600000)));
    const opciones = [24, 48, 72].filter((x) => x <= maxH);
    if (!opciones.includes(maxH) && maxH < CONFIG.horasCompartir) opciones.push(maxH); // «hasta que se borre el estudio»
    let horas = opciones[opciones.length - 1];
    const seg = h('div.filtros', ...opciones.map((x) => {
      const b = h('button.filtro', { type: 'button', 'aria-pressed': x === horas }, x === maxH && maxH < CONFIG.horasCompartir ? `Hasta que se borre (${x} h)` : `${x / 24} ${x === 24 ? 'día' : 'días'}`);
      b.onclick = () => { horas = x; seg.querySelectorAll('.filtro').forEach((y) => y.setAttribute('aria-pressed', String(y === b))); };
      return b;
    }));
    const barra2 = progreso();
    const crear = h('button.btn.btn--primario', { type: 'button' }, icono('candado', { tam: 18 }), 'Crear enlace');
    const cuerpo = h('div',
      h('p', 'Se arma un enlace con contraseña para que otro médico vea y descargue ', h('strong', m.titulo), '. El archivo se cifra en tu teléfono: sin la contraseña nadie lo puede abrir.'),
      h('p', h('strong', '¿Cuánto tiempo?'), ' Después se borra solo.'), seg,
      h('p.ayuda', `Nunca dura más que el estudio (se borra en ${duracion(venceEst - backend().ahora())}). Podés anularlo antes desde «Mis estudios».`));
    const v = modal({ titulo: 'Compartir con otro médico', ancho: 520, color: ['#0891b2', '#22c55e'], cuerpo, acciones: [crear] });
    crear.onclick = async () => {
      crear.disabled = true; cuerpo.append(barra2.el);
      try {
        const r = await compartirEstudio(pacUid, id, m, blob, { horas, venceEstudio: venceEst }, barra2.set);
        v.cerrar();
        mostrarEnlace(r, m.titulo);
      } catch (e) {
        console.warn(e); crear.disabled = false; barra2.el.remove();
        toast(e.code === 'VENCE-YA' ? 'El estudio está por borrarse: descargalo y mandáselo directamente.' : 'No se pudo crear el enlace. Revisá la conexión.', 'error', 6000);
      }
    };
  }

  async function descargar() {
    if (!blob) return;
    if (esPaciente && quedan() <= 0) { toast('Ya usaste las descargas de este estudio. Si lo necesitás, pedíselo a tu médico.', 'info', 6000); return; }
    if (esPaciente && quedan() === 1 && !(await confirmar({
      titulo: 'Es la última descarga', icono: 'alerta', color: ['#f59e0b', '#f97316'], si: 'Descargar y guardar', no: 'Cancelar',
      texto: h('p', 'Después de esta descarga ', h('strong', 'el estudio se borra de la app'), '. Guardalo en un lugar seguro (Archivos, Drive o la computadora). El original queda en la historia clínica de tu médico.'),
    }))) return;
    const primera = esPaciente && !m.descargadoEn;
    try { await marcarDescarga(pacUid, id, m, esPaciente); } catch (e) { console.warn(e); }
    if (primera && !m.descargadoEn) { m.descargadoEn = backend().ahora(); slotChip.replaceChildren(chip(`Se borra en ${duracion(estadoEstudio(m).resta)}`, 'aviso', 'reloj')); }
    descargarBlob(blob, m.nombre);
    btnTxt();
    if (esPaciente && quedan() <= 0) { btnDesc.disabled = true; toast('Descargado. Era la última descarga: el estudio se borra de la app.', 'ok', 7000); }
    else if (esPaciente) toast(`Descargado (te quedan ${quedan()}). Guardalo en tu dispositivo: se borra de la app en ${duracion(estadoEstudio(m).resta)}.`, 'ok', 6000);
  }
  return ventana;
}

/* ---------- Enlace creado: copiar y mandar ---------- */
function mostrarEnlace(r, titulo) {
  const copiar = async (texto, que) => { try { await navigator.clipboard.writeText(texto); toast(`${que} copiado`, 'ok'); } catch { toast('No se pudo copiar: mantené apretado el texto y copialo', 'info'); } };
  const mensaje = `Te comparto mi estudio «${titulo}» de Metria. Enlace (vence el ${fechaHora(r.vence)}): ${r.enlace}`;
  modal({
    titulo: 'Enlace listo', ancho: 560, color: ['#0891b2', '#22c55e'],
    cuerpo: h('div.compartir-datos',
      aviso('aviso', h('span', h('strong', 'Mandá la contraseña por otro camino'), ' (por ejemplo, el enlace por WhatsApp y la contraseña dictada o por SMS). Anotala: no se puede volver a ver.')),
      h('div.compartir-dato', h('div', h('small', 'Enlace'), h('code', r.enlace)), h('button.btn.btn--suave', { type: 'button', onclick: () => copiar(r.enlace, 'Enlace') }, icono('copiar', { tam: 16 }), 'Copiar')),
      h('div.compartir-dato.compartir-dato--clave', h('div', h('small', 'Contraseña'), h('code', r.contrasena)), h('button.btn.btn--suave', { type: 'button', onclick: () => copiar(r.contrasena, 'Contraseña') }, icono('copiar', { tam: 16 }), 'Copiar')),
      h('p.ayuda', `Vence el ${fechaHora(r.vence)} y se borra solo. Queda en tu registro de accesos.`)),
    acciones: [
      h('a.btn.btn--suave', { href: `https://wa.me/?text=${encodeURIComponent(mensaje)}`, target: '_blank', rel: 'noopener' }, 'Mandar enlace por WhatsApp'),
      navigator.share ? h('button.btn.btn--primario', { type: 'button', onclick: () => navigator.share({ title: 'Estudio de Metria', text: mensaje }).catch(() => {}) }, 'Compartir enlace') : null,
    ].filter(Boolean),
  });
}

/* ---------- Vista del paciente ---------- */
export function vistaEstudiosPaciente({ uid, estudios, compartidos = {} }) {
  const lista = Object.entries(estudios || {}).sort((a, b) => (b[1].subidoEn || 0) - (a[1].subidoEn || 0));
  const nuevos = lista.filter(([, m]) => estadoEstudio(m).id === 'nuevo').length;
  return h('div.seccion',
    heroe('estudios', 'Mis estudios', 'Los estudios que te cargó tu médico. Tocá uno para verlo o descargarlo.', nuevos ? chip(`${nuevos} sin retirar`, 'ok', 'chispa') : null),
    tarjeta(null, { clase: 'card--aviso-estudios' },
      h('div.pasos-estudio',
        paso('ojo', 'Ver', 'Lo traemos de la base solo cuando lo abrís.'),
        paso('bajar', 'Descargar', 'Guardalo en tu teléfono o computadora.'),
        paso('reloj', `${CONFIG.horasTrasDescarga / 24} días`, `Desde que lo abrís, queda ${CONFIG.horasTrasDescarga / 24} días más y lo podés descargar hasta ${CONFIG.maxDescargas} veces.`),
        paso('basura', 'Se borra', 'Para que nadie más pueda retirarlo.'))),
    lista.length
      ? h('div.estudios-grid', ...lista.map(([id, m]) => tarjetaEstudio(id, m, { onAbrir: (i, mm) => abrirEstudio(uid, i, mm, { esPaciente: true }) })))
      : vacio('carpeta', 'Todavía no tenés estudios', 'Cuando tu médico cargue un estudio, aparece acá y te avisamos en Inicio.'),
    enlacesActivos(uid, compartidos),
    h('p.ayuda.centro', `Si nunca lo abrís, se borra igual a los ${CONFIG.diasRetencionMaxima} días de cargado.`));
}
/** Enlaces para otro médico que siguen vigentes, con «Anular». */
function enlacesActivos(uid, compartidos) {
  const ahora = backend().ahora();
  const lista = Object.entries(compartidos || {}).filter(([, c]) => c && c.vence > ahora).sort((a, b) => a[1].vence - b[1].vence);
  if (!lista.length) return null;
  return tarjeta('Enlaces compartidos con otro médico', { icono: 'copiar' },
    h('div.enlaces-activos', ...lista.map(([tok, c]) => h('div.enlace-activo',
      icono('candado', { tam: 18 }),
      h('div', h('strong', c.titulo || 'Estudio'), h('small', `Vence en ${duracion(c.vence - ahora)} · ${fechaHora(c.vence)}`)),
      h('button.btn.btn--suave', { type: 'button', onclick: async (e) => {
        if (!(await confirmar({ titulo: 'Anular enlace', icono: 'candado', si: 'Anular', texto: `El médico ya no va a poder abrir «${c.titulo}» con ese enlace.` }))) return;
        e.target.disabled = true;
        try { await anularEnlace(uid, tok, c.titulo); toast('Enlace anulado', 'ok'); } catch { toast('No se pudo anular', 'error'); e.target.disabled = false; }
      } }, 'Anular')))),
    h('p.ayuda', 'Cuando vencen se borran solos.'));
}
const paso = (ic, t, d) => h('div.paso-est', h('span', icono(ic, { tam: 20 })), h('strong', t), h('small', d));

/* ---------- Vista del médico ---------- */
/* 10-11-2026 · La zona de subida y su cola se arman UNA vez por paciente y se reusan: la ficha se
   redibuja sola cada vez que llega un estudio, y antes, al subir el primero de varios archivos, los
   demás desaparecían de la cola sin subirse. */
const SUBIDAS = new Map();
export function panelEstudiosMedico({ pacUid, paciente, estudios, verificado }) {
  const lista = Object.entries(estudios || {}).sort((a, b) => (b[1].subidoEn || 0) - (a[1].subidoEn || 0));
  if (!SUBIDAS.has(pacUid)) { SUBIDAS.clear(); SUBIDAS.set(pacUid, crearSubida(pacUid)); }
  const { zona, cola } = SUBIDAS.get(pacUid);
  return panelMedico({ pacUid, paciente, lista, verificado, zona, cola });
}
function crearSubida(pacUid) {
  const zona = h('label.zona-subida', { tabindex: 0 },
    icono('subir', { tam: 34 }), h('strong', 'Arrastrá los archivos o tocá para elegir'),
    h('small', `PDF, imágenes, DICOM, video, audio, texto, Word, Excel o ZIP · hasta ${CONFIG.tamanoMaximoMB} MB cada uno · las fotos se achican solas`));
  const input = h('input', { type: 'file', multiple: true, accept: ACEPTADOS, hidden: true });
  zona.append(input);
  const cola = h('div.cola');
  const elegir = (files) => { for (const f of files) prepararSubida(f); };
  input.addEventListener('change', () => { elegir(input.files); input.value = ''; });
  zona.addEventListener('dragover', (e) => { e.preventDefault(); zona.classList.add('zona-subida--sobre'); });
  zona.addEventListener('dragleave', () => zona.classList.remove('zona-subida--sobre'));
  zona.addEventListener('drop', (e) => { e.preventDefault(); zona.classList.remove('zona-subida--sobre'); elegir(e.dataTransfer.files); });
  zona.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });

  function prepararSubida(f) {
    if (f.size > CONFIG.tamanoMaximoMB * 1048576) { toast(`${f.name}: supera ${CONFIG.tamanoMaximoMB} MB`, 'error'); return; }
    const tipo = tipoDe(f.type, f.name);
    const titulo = h('input', { type: 'text', value: f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').slice(0, 80), 'aria-label': 'Título del estudio' });
    const cat = h('select', { 'aria-label': 'Categoría' }, ...CATEGORIAS.map(([k, t]) => h('option', { value: k, selected: tipo === 'pdf' ? k === 'laboratorio' : tipo === 'imagen' || tipo === 'dicom' ? k === 'imagenes' : k === 'otro' }, t)));
    const fch = h('input', { type: 'date', value: new Date().toISOString().slice(0, 10), 'aria-label': 'Fecha del estudio' });
    const nota = h('input', { type: 'text', placeholder: 'Nota para el paciente (opcional)', maxlength: 300, 'aria-label': 'Nota' });
    const bar = progreso();
    const prev = h('div.cola-prev', { style: { '--tipo': TIPOS[tipo].color } }, icono(TIPOS[tipo].icono, { tam: 26 }));
    let bosquejo = null;
    generarBosquejo(f).then((b) => { bosquejo = b; if (b) prev.replaceChildren(h('img', { src: b, alt: '' })); });
    const btn = h('button.btn.btn--primario', { type: 'button' }, icono('subir', { tam: 16 }), 'Subir');
    const quitar = h('button.btn-icono', { type: 'button', 'aria-label': 'Quitar de la cola' }, icono('x', { tam: 16 }));
    // Las fotos se achican solas antes de subir (más livianas, se ven igual en el teléfono).
    const detalle = h('small', `${TIPOS[tipo].nombre} · ${tamanoLegible(f.size)}`);
    let arch = f, listo = Promise.resolve();
    if (tipo === 'imagen') {
      detalle.textContent = `${TIPOS[tipo].nombre} · ${tamanoLegible(f.size)} · achicando…`;
      listo = achicarImagen(f).then((g) => { arch = g; detalle.textContent = g !== f ? `${TIPOS[tipo].nombre} · ${tamanoLegible(f.size)} → ${tamanoLegible(g.size)} (liviana)` : `${TIPOS[tipo].nombre} · ${tamanoLegible(f.size)}`; });
    }
    const fila = h('div.cola-item', prev,
      h('div.cola-campos', h('div.cola-nombre', h('strong', f.name), detalle),
        h('div.cola-grid', titulo, cat, fch, nota), bar.el),
      h('div.cola-acc', btn, quitar));
    quitar.onclick = () => fila.remove();
    btn.onclick = async () => {
      btn.disabled = true; quitar.disabled = true;
      try {
        await listo;
        await subirEstudio(pacUid, arch, { titulo: titulo.value, categoria: cat.value, fechaEstudio: fch.value, nota: nota.value, bosquejo }, bar.set);
        toast(`«${titulo.value}» subido. El paciente ya lo ve en su app.`, 'ok');
        fila.remove();
      } catch (e) {
        console.error(e);
        toast(e.message?.includes('MB') ? e.message : 'No se pudo subir el estudio.', 'error');
        btn.disabled = false; quitar.disabled = false;
      }
    };
    cola.append(fila);
  }
  return { zona, cola };
}
function panelMedico({ pacUid, paciente, lista, verificado, zona, cola }) {
  return h('div.seccion',
    heroe('estudios', 'Estudios', `Cargá estudios para ${paciente}. El paciente ve un bosquejo y los retira cuando quiere.`),
    verificado ? null : aviso('aviso', h('span', h('strong', 'Identidad sin constatar. '), 'Antes de cargar estudios, verificá el DNI del paciente en la consulta (botón «Verificar identidad» arriba). Así te asegurás de que la cuenta es de esa persona.')),
    verificado ? tarjeta('Subir estudios', { icono: 'subir' }, zona, cola) : null,
    tarjeta(`Estudios cargados (${lista.length})`, { icono: 'carpeta' },
      lista.length ? h('div.estudios-grid', ...lista.map(([id, m]) => tarjetaEstudio(id, m, {
        esMedico: true,
        onAbrir: (i, mm) => abrirEstudio(pacUid, i, mm, { esPaciente: false }),
        onBorrar: async (i, mm) => {
          if (await confirmar({ titulo: 'Borrar estudio', texto: `Se borra «${mm.titulo}» de la base de datos. El paciente ya no podrá verlo.`, si: 'Borrar', peligro: true })) {
            await borrarEstudio(pacUid, i).then(() => toast('Estudio borrado', 'ok')).catch(() => toast('No se pudo borrar', 'error'));
          }
        },
      }))) : vacio('carpeta', 'Sin estudios', 'Los que subas aparecen acá y en la app del paciente al instante.')));
}

export { cargando, fechaHora };
