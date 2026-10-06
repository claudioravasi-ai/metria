/* ============================================================
   App del paciente
   Escucha sus ramas de la base en vivo: si el médico sube un estudio
   o cambia el plan desde otro equipo, se ve al instante.
   ============================================================ */

import { h, montar } from '../core/dom.js';
import { icono } from '../core/iconos.js';
import { tarjeta, chip, aviso, fmt, fmt0, fecha, duracion, estiloSeccion, SECCIONES, hoyISO, cerrarTodos } from '../core/ui.js';
import * as G from '../ui/graficos.js';
import { inclinar, contar, ecg } from '../ui/efectos.js';
import { evaluarPaciente } from '../engine/evaluar.js';
import * as GL from '../engine/glp1.js';
import { backend, estadoEstudio, purgarVencidos } from '../data/servicio.js';
import { marco, barraDemo } from './shell.js';
import { seccionMetabolismo, seccionCuerpo, seccionCorazon, seccionLaboratorio } from './secciones.js';
import { formularioDatos } from './datos-form.js';
import { vistaEstudiosPaciente } from './estudios.js';
import { vistaTratamientoPaciente } from './tratamiento.js';
import { vistaPrivacidad } from './legal.js';
import { vistaManual } from './manual.js';

const ITEMS = ['inicio', 'datos', 'metabolismo', 'cuerpo', 'corazon', 'laboratorio', 'tratamiento', 'estudios', 'privacidad', 'ayuda'];
const PRINCIPALES = ['inicio', 'cuerpo', 'corazon', 'estudios'];

export function appPaciente(perfil, { onSalir }) {
  const B = backend();
  const uid = perfil.uid;
  const S = { perfil: perfil.datos, pac: {}, estudios: {}, auditoria: {}, verificado: null, listo: { pac: false, est: false } };
  let form = null, pendiente = false, programado = false, inicioVisto = false;
  const bajas = [];

  const seccion = () => { const s = location.hash.slice(1); return ITEMS.includes(s) ? s : 'inicio'; };
  const ir = (id) => { if (location.hash.slice(1) === id) render(); else location.hash = id; };

  // Si la persona está escribiendo, el cambio que llega de otro equipo espera a que salga del campo
  let esperandoFoco = false;
  function programar() {
    if (programado) return;
    const act = document.activeElement;
    if (act?.closest?.('#contenido') && act.matches('input, textarea, select')) {
      if (!esperandoFoco) { esperandoFoco = true; act.addEventListener('blur', () => { esperandoFoco = false; setTimeout(programar, 120); }, { once: true }); }
      return;
    }
    programado = true;
    requestAnimationFrame(() => { programado = false; render(); });
  }

  bajas.push(B.escuchar(`pacientes/${uid}`, (v) => {
    S.pac = v || {}; if (v?.perfil) S.perfil = v.perfil; S.listo.pac = true;
    if (seccion() === 'datos' && form?.sucio) { pendiente = true; mostrarBanner(); return; }
    programar();
  }));
  bajas.push(B.escuchar(`estudios/${uid}`, (v) => { S.estudios = v || {}; S.listo.est = true; if (seccion() !== 'datos') programar(); }));
  bajas.push(B.escuchar(`auditoria/${uid}`, (v) => { S.auditoria = v || {}; if (seccion() === 'privacidad') programar(); }));
  window.addEventListener('hashchange', render);
  purgarVencidos(perfil).then((n) => n && console.info(`Se borraron ${n} estudios vencidos`));
  // El contador de vencimiento de los estudios se refresca cada minuto
  // y lo vencido se borra aunque la app quede abierta
  const reloj = setInterval(() => {
    if (Object.values(S.estudios).some((m) => estadoEstudio(m).id === 'vencido')) purgarVencidos(perfil);
    if (['estudios', 'inicio'].includes(seccion())) programar();
  }, 60000);

  function mostrarBanner() {
    const c = document.getElementById('contenido');
    if (!c || c.querySelector('.banner-remoto')) return;
    c.prepend(aviso('aviso', h('span', 'Tus datos se actualizaron desde otro equipo o por tu médico. ',
      h('button.btn-link', { type: 'button', onclick: () => { pendiente = false; form = null; render(); } }, 'Ver la versión nueva'), ' (se descartan los cambios sin guardar).')));
    c.firstChild.classList.add('banner-remoto');
  }

  function render() {
    if (!S.listo.pac || detenido) return;
    const id = seccion();
    const ev = evaluarPaciente(S.perfil, S.pac.clinica || {}, new Date(B.ahora()));
    const irDatos = () => ir('datos');
    let contenido;
    switch (id) {
      case 'datos':
        form = formularioDatos({ uid, perfil: S.perfil, clinica: S.pac.clinica, quien: { rol: 'paciente', uid }, onGuardado: () => { form = null; } });
        contenido = form.el;
        break;
      case 'metabolismo': contenido = seccionMetabolismo(ev, { rol: 'paciente', irDatos }); break;
      case 'cuerpo': contenido = seccionCuerpo(ev, { rol: 'paciente', mediciones: S.pac.mediciones, irDatos }); break;
      case 'corazon': contenido = seccionCorazon(ev, { rol: 'paciente', irDatos }); break;
      case 'laboratorio': contenido = seccionLaboratorio(ev, { rol: 'paciente', irDatos }); break;
      case 'tratamiento': contenido = vistaTratamientoPaciente({ ev, plan: S.pac.plan, tolerancia: S.pac.tolerancia, uid }); break;
      case 'estudios': contenido = vistaEstudiosPaciente({ uid, estudios: S.estudios }); break;
      case 'privacidad': contenido = vistaPrivacidad({ uid, perfil: S.perfil, auditoria: S.auditoria, estudios: S.estudios }); break;
      case 'ayuda': contenido = vistaManual('paciente'); break;
      default: contenido = inicio(ev);
    }
    if (id !== 'datos') form = null;
    const nuevos = Object.values(S.estudios).filter((m) => estadoEstudio(m).id === 'nuevo').length;
    const scroll = window.scrollY;
    const mismo = document.getElementById('contenido')?.dataset.sec === id;
    montar(document.getElementById('app'), marco({
      items: ITEMS.map((i) => ({ id: i, badge: i === 'estudios' && nuevos ? nuevos : null })),
      principales: PRINCIPALES, actual: id, onIr: ir, onSalir: salir,
      usuario: `${S.perfil.nombre} ${S.perfil.apellido}`, rolTexto: 'Paciente',
      extraTop: barraDemo(programar), contenido,
    }));
    document.getElementById('contenido').dataset.sec = id;
    if (mismo) window.scrollTo(0, scroll); else { window.scrollTo(0, 0); document.getElementById('contenido').focus({ preventScroll: true }); }
  }

  function inicio(ev) {
    const nombre = S.perfil.nombre;
    const hora = new Date().getHours();
    const saludo = hora < 12 ? 'Buen día' : hora < 20 ? 'Buenas tardes' : 'Buenas noches';
    const avisos = [];
    const lista = Object.entries(S.estudios);
    const nuevos = lista.filter(([, m]) => estadoEstudio(m).id === 'nuevo');
    const porVencer = lista.filter(([, m]) => estadoEstudio(m).id === 'descargado');
    if (nuevos.length) avisos.push(aviso('ok', h('span', h('strong', `Tenés ${nuevos.length === 1 ? 'un estudio nuevo' : nuevos.length + ' estudios nuevos'}. `), h('button.btn-link', { type: 'button', onclick: () => ir('estudios') }, 'Ver y descargar'))));
    for (const [, m] of porVencer) avisos.push(aviso('aviso', h('span', `«${m.titulo}» se borra en ${duracion(estadoEstudio(m).resta)}. ¿Lo guardaste en tu dispositivo?`)));
    if (ev.completitud.pct < 60) avisos.push(aviso('info', h('span', `Tu ficha está al ${ev.completitud.pct} %. `, h('button.btn-link', { type: 'button', onclick: () => ir('datos') }, 'Completala'), ' para que los cálculos sean precisos.')));
    const plan = S.pac.plan;
    if (plan?.estado === 'activo') {
      const vig = GL.pasoVigente(GL.esquema(plan.farmaco, plan.inicio), hoyISO(B.ahora()));
      const f = GL.farmaco(plan.farmaco);
      if (vig) avisos.push(aviso('info', h('span', h('strong', `Tu dosis: ${GL.fmtDosis(vig.dosis)} mg de ${f.generico} ${f.frecuencia === 'semanal' ? 'por semana' : 'por día'}. `), h('button.btn-link', { type: 'button', onclick: () => ir('tratamiento') }, 'Ver calendario'))));
    }
    const pesos = Object.values(S.pac.mediciones || {}).sort((a, b) => a.fecha - b.fecha).map((m) => m.peso).filter(Boolean);
    const p = ev.prevent;
    const labsMal = ev.labsInt.filter((l) => l.estado !== 'ok').length;

    // Los números suben desde 0 solo la primera vez que se abre Inicio (no en cada actualización en vivo)
    const animar = !inicioVisto;
    inicioVisto = true;
    const cifra = (v, f) => { const el = h('strong.num'); if (animar) contar(el, v, f, 1100); else el.textContent = f(v); return el; };
    const tile = (id, titulo, valor, sub, extra, grande = false) => inclinar(h(`button.tile${grande ? '.tile--grande' : ''}`, { type: 'button', style: estiloSeccion(id), onclick: () => ir(id) },
      h('div.tile-cab', h('span.tile-ico', icono(SECCIONES[id].icono, { tam: 20 })), h('span', titulo), icono('chevron', { tam: 16, clase: 'tile-ir' })),
      h('div.tile-valor', valor), sub ? h('div.tile-sub', sub) : null, extra || null), 5);

    const anilloComp = h('div.completo.completo--grande', h('svg', { viewBox: '0 0 36 36' }, h('circle', { cx: 18, cy: 18, r: 15.5, fill: 'none', stroke: 'rgba(255,255,255,.25)', 'stroke-width': 3 }), h('circle', { cx: 18, cy: 18, r: 15.5, fill: 'none', stroke: '#fff', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-dasharray': `${ev.completitud.pct} 100`, pathLength: 100, transform: 'rotate(-90 18 18)' })), h('span.num', `${ev.completitud.pct}%`));

    return h('div.seccion',
      h('section.bienvenida', { style: estiloSeccion('inicio') },
        h('div', h('small.fecha-larga', new Date(B.ahora()).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })), h('h1', `${saludo}, ${nombre}`), h('p', 'Este es el resumen de tu salud cardiometabólica.')),
        h('div.bienvenida-comp', anilloComp, h('small', 'Ficha completa')),
        ecg({ alto: 60 })),
      avisos.length ? h('div.avisos', ...avisos) : null,
      h('div.bento',
        tile('cuerpo', 'Cuerpo', ev.comp ? h('span', cifra(ev.comp.imc, (v) => fmt(v, 1)), h('small', ' IMC')) : '—', ev.comp ? chip(ev.comp.categoria.nombre, ev.comp.categoria.id === 'normal' ? 'ok' : ['sobrepeso', 'bajo'].includes(ev.comp.categoria.id) ? 'aviso' : 'peligro') : 'Cargá peso y talla', pesos.length > 1 ? G.mini(pesos, 'var(--c1)') : null, true),
        tile('metabolismo', 'Metabolismo', ev.ener ? h('span', cifra(ev.ener.tmb, fmt0), h('small', ' kcal basal')) : '—', ev.ener ? `Gasto total ≈ ${fmt0(ev.ener.get)} kcal/día` : 'Faltan datos'),
        tile('corazon', 'Corazón', ev.categoria ? h('strong', { style: { color: ev.categoria.color } }, ev.categoria.nombre) : '—', p.ok ? `${fmt(p.cvd10, 1)} % de riesgo a 10 años` : 'Completá presión y colesterol', null, true),
        tile('laboratorio', 'Laboratorio', ev.labsInt.length ? h('span', cifra(ev.labsInt.length - labsMal, fmt0), h('small', ` de ${ev.labsInt.length} en rango`)) : '—', ev.labs.fecha ? `Análisis del ${fecha(ev.labs.fecha)}` : 'Sin análisis cargados'),
        tile('tratamiento', 'Tratamiento', plan?.estado === 'activo' ? h('strong', GL.farmaco(plan.farmaco)?.comercial || 'Activo') : h('strong', 'Sin plan'), plan?.estado === 'activo' ? `Desde el ${fecha(plan.inicio)}` : 'Orientación según tus datos'),
        tile('estudios', 'Estudios', h('span', cifra(lista.length, fmt0), h('small', lista.length === 1 ? ' estudio' : ' estudios')), nuevos.length ? chip(`${nuevos.length} nuevos`, 'ok') : 'Al día'),
        tile('datos', 'Mis datos', h('strong.num', `${ev.completitud.pct} %`), ev.completitud.faltan.length ? `Falta: ${ev.completitud.faltan.slice(0, 2).join(', ')}` : 'Completo'),
        tile('privacidad', 'Privacidad', h('strong', 'Protegida'), 'Quién vio tus datos')),
      tarjeta('Varios equipos a la vez', { icono: 'dispositivos', clase: 'card--sutil' }, h('p.ayuda', 'Podés usar la app en el teléfono, la tablet y la computadora al mismo tiempo: los cambios se sincronizan solos.')));
  }

  let detenido = false;
  function detener() {
    if (detenido) return;
    detenido = true;
    cerrarTodos();
    bajas.forEach((f) => f && f());
    clearInterval(reloj);
    window.removeEventListener('hashchange', render);
  }
  async function salir() { detener(); await onSalir(); }

  render();
  return { detener };
}
