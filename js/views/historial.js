/* ============================================================
   Historial general (solo el coordinador) — pedido de Claudio, 18-11-2026
   Quién entró, salió, abrió una ficha, miró, descargó, subió o borró
   estudios, y quién dio de baja pacientes, con nombre y hora.
   Queda aunque el paciente ya no exista. Lo protegen las reglas de la
   base: solo el coordinador lo lee y nadie lo puede cambiar ni borrar.
   ============================================================ */

import { h } from '../core/dom.js';
import { icono } from '../core/iconos.js';
import { heroe, vacio, fechaHora } from '../core/ui.js';
import { descargarBlob } from '../data/archivos.js';

const VERBO = {
  ingreso: 'entró a la app',
  salida: 'cerró la sesión',
  'salida-inactividad': 'salió por inactividad (cierre automático)',
  'abrio-ficha': 'abrió la ficha del paciente',
  abrio: 'miró el estudio',
  descargo: 'descargó el estudio',
  subio: 'subió el estudio',
  borro: 'eliminó el estudio',
  'borrado-automatico': 'borrado automático del estudio',
  'baja-paciente': 'eliminó al paciente',
  'alta-cuenta': 'creó su cuenta',
  'edito-datos': 'editó los datos personales',
  plan: 'indicó un plan',
  'verifico-identidad': 'verificó la identidad',
  'quito-verificacion': 'quitó la verificación de identidad',
  'turno-endoscopia': 'sacó un turno de endoscopia',
  'orden-prequirurgico': 'emitió órdenes del prequirúrgico',
  'informe-endoscopia': 'cargó el informe de endoscopia',
  'seguimiento-estudio': 'cargó un estudio del seguimiento',
  'seguimiento-histologia': 'cargó la anatomía patológica',
  compartio: 'compartió con otro médico el estudio',
  'anulo-enlace': 'anuló el enlace compartido del estudio',
};
const ICONO = { ingreso: 'usuario', salida: 'salir', 'salida-inactividad': 'salir', abrio: 'ojo', 'abrio-ficha': 'ojo', descargo: 'bajar', subio: 'subir', borro: 'basura', compartio: 'copiar', 'anulo-enlace': 'candado', 'enlace-vencio': 'candado', 'borrado-automatico': 'basura', 'baja-paciente': 'basura' };
const ROL = { coordinador: 'Coordinador', profesional: 'Profesional', paciente: 'Paciente', sistema: 'Sistema' };
const GRUPOS = [
  ['todo', 'Todo', () => true],
  ['sesiones', 'Entradas y salidas', (r) => ['ingreso', 'salida', 'salida-inactividad'].includes(r.accion)],
  ['estudios', 'Miró, descargó o compartió', (r) => ['abrio', 'descargo', 'abrio-ficha', 'compartio', 'anulo-enlace', 'enlace-vencio'].includes(r.accion)],
  ['borrados', 'Eliminaciones', (r) => ['borro', 'borrado-automatico', 'baja-paciente'].includes(r.accion)],
  ['pacientes', 'Lo que hicieron los pacientes', (r) => r.rol === 'paciente'],
];
const POR_PAGINA = 200;
const E = { q: '', grupo: 'todo', cuantos: POR_PAGINA };

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const frase = (r) => (r.accion === 'borrado-automatico'
  ? `Se borró solo el estudio${r.estudioTitulo ? ` «${r.estudioTitulo}»` : ''}${r.rol === 'sistema' ? '' : ` (al abrir la app ${r.nombre})`}`
  : r.accion === 'enlace-vencio' ? `Venció el enlace compartido del estudio${r.estudioTitulo ? ` «${r.estudioTitulo}»` : ''}`
    : `${r.nombre || 'Alguien'} ${VERBO[r.accion] || r.accion}${r.estudioTitulo ? ` «${r.estudioTitulo}»` : ''}`) + (r.detalle ? ` — ${r.detalle}` : '');
const dia = (t) => { const d = new Date(t).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); return d.charAt(0).toUpperCase() + d.slice(1); };

export function vistaHistorial({ registros }) {
  const todos = Object.values(registros || {}).filter((r) => r && r.cuando).sort((a, b) => b.cuando - a.cuando);
  const lista = h('div.historial');
  const pie = h('div.botones.centro');

  const pintar = () => {
    const q = norm(E.q);
    const filtro = GRUPOS.find(([k]) => k === E.grupo)[2];
    const filas = todos.filter(filtro).filter((r) => !q || norm(`${frase(r)} ${r.pacNombre || ''} ${ROL[r.rol] || ''}`).includes(q));
    if (!filas.length) { lista.replaceChildren(vacio('reloj', 'Sin movimientos', E.q ? 'Probá con otro nombre, DNI o palabra (p. ej. «eliminó»).' : 'Acá aparecen las entradas, salidas, estudios mirados, descargas y eliminaciones.')); pie.replaceChildren(); return; }
    const ver = filas.slice(0, E.cuantos);
    const bloques = [];
    let actual = null, ul = null;
    for (const r of ver) {
      const d = dia(r.cuando);
      if (d !== actual) { actual = d; ul = h('ul.auditoria'); bloques.push(h('section.hist-dia', h('h3', d), ul)); }
      const borra = ['borro', 'borrado-automatico', 'baja-paciente'].includes(r.accion);
      ul.append(h(borra ? 'li.hist-borrado' : 'li',
        h('span.aud-ico', icono(ICONO[r.accion] || 'info', { tam: 16 })),
        h('div', h('strong', frase(r)),
          h('small', [ROL[r.rol] || r.rol, r.pacNombre && !(r.rol === 'paciente' && r.quien === r.pac) ? `Paciente: ${r.pacNombre}` : r.rol === 'paciente' && r.pacNombre ? r.pacNombre : null].filter(Boolean).join(' · '))),
        h('time', new Date(r.cuando).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }))));
    }
    lista.replaceChildren(...bloques);
    pie.replaceChildren(filas.length > E.cuantos
      ? h('button.btn.btn--suave', { type: 'button', onclick: () => { E.cuantos += POR_PAGINA; pintar(); } }, `Ver más (${filas.length - E.cuantos} restantes)`)
      : h('small.ayuda', `${filas.length} ${filas.length === 1 ? 'movimiento' : 'movimientos'}`));
  };

  const buscador = h('input', { type: 'search', placeholder: 'Buscar por nombre, DNI, estudio o acción', value: E.q, 'aria-label': 'Buscar en el historial' });
  buscador.addEventListener('input', () => { E.q = buscador.value; E.cuantos = POR_PAGINA; pintar(); });
  const chipsF = h('div.filtros', ...GRUPOS.map(([k, t]) => {
    const b = h('button.filtro', { type: 'button', 'aria-pressed': E.grupo === k }, t);
    b.onclick = () => { E.grupo = k; E.cuantos = POR_PAGINA; chipsF.querySelectorAll('.filtro').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); pintar(); };
    return b;
  }));
  const exportar = () => {
    const c = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const filas = [['Fecha y hora', 'Quién', 'Rol', 'Qué hizo', 'Estudio', 'Detalle', 'Paciente'].map(c).join(';'),
      ...todos.map((r) => [fechaHora(r.cuando), r.nombre, ROL[r.rol] || r.rol, VERBO[r.accion] || r.accion, r.estudioTitulo, r.detalle, r.pacNombre].map(c).join(';'))];
    descargarBlob(new Blob(['﻿' + filas.join('\r\n')], { type: 'text/csv;charset=utf-8' }), `historial-metria-${new Date().toISOString().slice(0, 10)}.csv`);
  };
  pintar();
  return h('div.seccion',
    heroe('historial', 'Historial', 'Todo lo que pasa en la app, con nombre y hora. Lo ves solo vos; nadie puede cambiarlo ni borrarlo y queda aunque se elimine el paciente.',
      h('button.btn.btn--suave', { type: 'button', onclick: exportar }, icono('bajar', { tam: 16 }), 'Descargar (Excel)')),
    h('div.buscador', icono('buscar', { tam: 18 }), buscador), chipsF, lista, pie);
}
