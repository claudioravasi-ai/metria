/* ============================================================
   Estudios médicos
   - El paciente ve solo un bosquejo (miniatura borrosa) y los datos
     básicos. Al tocarlo, una ventana avisa que va a ver información
     sensible; recién ahí se "trae" el archivo de la base.
   - Al descargarlo empieza la cuenta regresiva: 72 h y se borra de
     la base. La app aconseja guardarlo en el dispositivo.
   - El médico sube archivos (PDF, imágenes, DICOM, video, texto,
     planillas, comprimidos) arrastrándolos o eligiéndolos.
   ============================================================ */

import { h } from '../core/dom.js';
import { icono } from '../core/iconos.js';
import { heroe, tarjeta, chip, aviso, modal, toast, confirmar, fecha, fechaHora, duracion, progreso, vacio, cargando } from '../core/ui.js';
import { CONFIG } from '../config.js';
import { backend, estadoEstudio, traerEstudio, marcarDescarga, subirEstudio, borrarEstudio } from '../data/servicio.js';
import { TIPOS, tipoDe, tamanoLegible, generarBosquejo, mostrarEnVisor, descargarBlob, ACEPTADOS } from '../data/archivos.js';

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
      : chip(esMedico ? 'Sin descargar' : 'Nuevo', 'ok', 'chispa');
  const boceto = m.bosquejo
    ? h('img.estudio-bosquejo', { src: m.bosquejo, alt: '', draggable: false })
    : h('div.estudio-bosquejo.estudio-bosquejo--icono', { style: { '--tipo': T.color } }, icono(T.icono, { tam: 40 }));
  return h('article.estudio', { style: { '--tipo': T.color } },
    h('button.estudio-abrir', { type: 'button', onclick: () => onAbrir(id, m), disabled: est.id === 'vencido' && !esMedico, 'aria-label': `Ver ${m.titulo}` },
      h('div.estudio-marco', boceto, h('span.estudio-tipo', T.nombre), h('span.estudio-candado', icono('candado', { tam: 16 })), h('span.estudio-ver', icono('ojo', { tam: 18 }), 'Ver estudio')),
      h('div.estudio-info',
        h('strong', m.titulo),
        h('small', `${nombreCat(m.categoria)} · ${m.fechaEstudio ? fecha(m.fechaEstudio) : fecha(m.subidoEn)} · ${tamanoLegible(m.tamano)}`),
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
        esPaciente ? h('li', h('strong', `Si lo descargás, queda disponible ${CONFIG.horasTrasDescarga / 24} días más y después se borra para siempre`), ' (así nadie más puede retirarlo).') : h('li', 'La apertura queda registrada en el historial de accesos del paciente.'),
        h('li', 'Queda registrado que lo abriste (sin copiar el contenido).'))),
  });
  if (!ok) return;

  const visor = h('div.visor');
  const barra = progreso();
  const carga = h('div.visor-carga', h('p', 'Trayendo el estudio de la base de datos…'), barra.el);
  visor.append(carga);
  let blob = null, limpiar = () => {};
  const btnDesc = h('button.btn.btn--primario', { type: 'button', disabled: true, onclick: () => descargar() }, icono('bajar', { tam: 18 }), 'Descargar');
  const slotChip = h('span.visor-chip', est.id === 'descargado' ? chip(`Se borra en ${duracion(est.resta)}`, 'aviso', 'reloj') : null);
  const pie = h('div.visor-pie', slotChip, btnDesc);
  const ventana = modal({
    titulo: m.titulo, ancho: 980, clase: 'modal--visor', color: ['#10b981', '#84cc16'],
    cuerpo: h('div', h('div.visor-meta', chip(TIPOS[tipoDe(m.mime, m.nombre)].nombre, 'info'), h('small', `${m.nombre} · ${tamanoLegible(m.tamano)}${m.fechaEstudio ? ' · ' + fecha(m.fechaEstudio) : ''}`)), m.nota ? aviso('info', m.nota) : null, visor),
    acciones: [pie],
    alCerrar: () => { limpiar(); blob = null; },
  });
  try {
    blob = await traerEstudio(pacUid, id, m, barra.set);
    limpiar = await mostrarEnVisor(blob, m, visor);
    btnDesc.disabled = false;
  } catch (e) {
    console.warn(e);
    visor.replaceChildren(vacio('candado', 'No disponible', e.code === 'VENCIDO' || /denegado|permission/i.test(e.message)
      ? 'El estudio venció y ya no se puede retirar. Si lo necesitás, pedíselo a tu médico.'
      : 'No se pudo traer el estudio. Revisá la conexión e intentá de nuevo.'));
  }

  async function descargar() {
    if (!blob) return;
    if (esPaciente && !m.descargadoEn) {
      const si = await confirmar({
        titulo: 'Antes de descargar', icono: 'reloj', color: ['#f59e0b', '#f97316'], si: 'Descargar y guardar', no: 'Cancelar',
        texto: h('div',
          h('p', `Al descargarlo, el estudio queda en la app ${CONFIG.horasTrasDescarga} horas más y después `, h('strong', 'se borra definitivamente de la base de datos'), '.'),
          h('p', h('strong', 'Guardalo en tu dispositivo'), ' (Archivos, Drive, una carpeta de la computadora) para tenerlo siempre. El original queda en la historia clínica de tu médico.')),
      });
      if (!si) return;
    }
    descargarBlob(blob, m.nombre);
    try {
      await marcarDescarga(pacUid, id, m, esPaciente);
      if (esPaciente && !m.descargadoEn) {
        m.descargadoEn = backend().ahora();
        slotChip.replaceChildren(chip(`Se borra en ${duracion(CONFIG.horasTrasDescarga * 3600000)}`, 'aviso', 'reloj'));
        toast('Descargado. Guardalo en tu dispositivo: en 3 días se borra de la app.', 'ok', 6000);
      }
    } catch (e) { console.warn(e); }
  }
  return ventana;
}

/* ---------- Vista del paciente ---------- */
export function vistaEstudiosPaciente({ uid, estudios }) {
  const lista = Object.entries(estudios || {}).sort((a, b) => (b[1].subidoEn || 0) - (a[1].subidoEn || 0));
  const nuevos = lista.filter(([, m]) => estadoEstudio(m).id === 'nuevo').length;
  return h('div.seccion',
    heroe('estudios', 'Mis estudios', 'Los estudios que te cargó tu médico. Tocá uno para verlo o descargarlo.', nuevos ? chip(`${nuevos} sin retirar`, 'ok', 'chispa') : null),
    tarjeta(null, { clase: 'card--aviso-estudios' },
      h('div.pasos-estudio',
        paso('ojo', 'Ver', 'Lo traemos de la base solo cuando lo abrís.'),
        paso('bajar', 'Descargar', 'Guardalo en tu teléfono o computadora.'),
        paso('reloj', `${CONFIG.horasTrasDescarga / 24} días`, 'Después de descargarlo, queda 3 días más.'),
        paso('basura', 'Se borra', 'Para que nadie más pueda retirarlo.'))),
    lista.length
      ? h('div.estudios-grid', ...lista.map(([id, m]) => tarjetaEstudio(id, m, { onAbrir: (i, mm) => abrirEstudio(uid, i, mm, { esPaciente: true }) })))
      : vacio('carpeta', 'Todavía no tenés estudios', 'Cuando tu médico cargue un estudio, aparece acá y te avisamos en Inicio.'),
    h('p.ayuda.centro', `Si nunca lo descargás, se borra igual a los ${CONFIG.diasRetencionMaxima} días de cargado.`));
}
const paso = (ic, t, d) => h('div.paso-est', h('span', icono(ic, { tam: 20 })), h('strong', t), h('small', d));

/* ---------- Vista del médico ---------- */
export function panelEstudiosMedico({ pacUid, paciente, estudios, verificado }) {
  const lista = Object.entries(estudios || {}).sort((a, b) => (b[1].subidoEn || 0) - (a[1].subidoEn || 0));
  const zona = h('label.zona-subida', { tabindex: 0 },
    icono('subir', { tam: 34 }), h('strong', 'Arrastrá los archivos o tocá para elegir'),
    h('small', `PDF, imágenes, DICOM, video, audio, texto, Word, Excel o ZIP · hasta ${CONFIG.tamanoMaximoMB} MB cada uno`));
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
    const fila = h('div.cola-item', prev,
      h('div.cola-campos', h('div.cola-nombre', h('strong', f.name), h('small', `${TIPOS[tipo].nombre} · ${tamanoLegible(f.size)}`)),
        h('div.cola-grid', titulo, cat, fch, nota), bar.el),
      h('div.cola-acc', btn, quitar));
    quitar.onclick = () => fila.remove();
    btn.onclick = async () => {
      btn.disabled = true; quitar.disabled = true;
      try {
        await subirEstudio(pacUid, f, { titulo: titulo.value, categoria: cat.value, fechaEstudio: fch.value, nota: nota.value, bosquejo }, bar.set);
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
