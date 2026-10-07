/* ============================================================
   App del profesional
   Panel con indicadores en vivo, lista de pacientes, ficha completa
   con el motor clínico, estudios, notas, accesos y (para el titular)
   la habilitación de otros profesionales.
   ============================================================ */

import { h, montar } from '../core/dom.js';
import { icono } from '../core/iconos.js';
import { heroe, tarjeta, chip, aviso, toast, confirmar, fmt, fmt0, fecha, fechaHora, vacio, estiloSeccion, SECCIONES, dniMascara, cargando, cerrarTodos } from '../core/ui.js';
import { evaluarPaciente } from '../engine/evaluar.js';
import { edad as calcEdad } from '../engine/anthro.js';
import * as GL from '../engine/glp1.js';
import { backend, purgarVencidos, purgarRetencion, verificarIdentidad, guardarNota } from '../data/servicio.js';
import { marco, barraDemo, ambiente } from './shell.js';
import { inclinar } from '../ui/efectos.js';
import { seccionMetabolismo, seccionCuerpo, seccionCorazon, seccionLaboratorio } from './secciones.js';
import { formularioDatos } from './datos-form.js';
import { panelEstudiosMedico } from './estudios.js';
import { panelGlp1Medico } from './tratamiento.js';
import { vistaManual } from './manual.js';
import { vistaPlan } from './plan.js';
import { imprimirInforme } from './informe.js';
import { cambioClave, cambioCorreo, POLITICA, TERMINOS, verTexto } from './legal.js';

const RIESGO = { 'muy-alto': ['Muy alto', 'peligro'], alto: ['Alto', 'peligro'], intermedio: ['Intermedio', 'aviso'], limite: ['Limítrofe', 'aviso'], bajo: ['Bajo', 'ok'] };
const GLP = { indicado: ['Candidato', 'ok'], precaucion: ['Candidato c/ precaución', 'aviso'], 'no-indicado': ['No indicado', 'neutro'], contraindicado: ['Contraindicado', 'peligro'] };
const PESTANAS = [
  ['resumen', 'Resumen', 'grafico', 'panel'], ['datos', 'Datos', 'datos', 'datos'], ['metabolismo', 'Metabolismo', 'llama', 'metabolismo'], ['cuerpo', 'Cuerpo', 'cuerpo', 'cuerpo'],
  ['corazon', 'Corazón', 'corazon', 'corazon'], ['laboratorio', 'Laboratorio', 'matraz', 'laboratorio'], ['tratamiento', 'Tratamiento', 'jeringa', 'tratamiento'], ['plan', 'Plan integral', 'objetivo', 'plan'],
  ['estudios', 'Estudios', 'carpeta', 'estudios'], ['notas', 'Notas', 'editar', 'ayuda'], ['accesos', 'Accesos', 'ojo', 'privacidad'],
];

export function appMedico(perfil, { onSalir }) {
  const B = backend();
  const S = { indice: {}, solicitudes: {}, medicos: {}, estados: {}, ficha: null, filtro: 'todos', busqueda: '' };
  const bajas = [];
  let bajasFicha = [];
  let form = null, programado = false;

  const items = () => [
    { id: 'panel' }, { id: 'pacientes', badge: null },
    ...(perfil.titular ? [{ id: 'medicos', badge: Object.values(S.estados).filter((e) => e === 'pendiente').length || null }] : []),
    { id: 'privacidad', nombre: 'Mi cuenta' }, { id: 'ayuda' },
  ];
  const ruta = () => {
    const [a, b] = location.hash.slice(1).split('/');
    if (a === 'ficha' && S.ficha) return { sec: 'pacientes', tab: PESTANAS.some(([k]) => k === b) ? b : 'resumen' };
    return { sec: ['panel', 'pacientes', 'medicos', 'privacidad', 'ayuda'].includes(a) ? a : 'panel' };
  };
  const ir = (id) => { if (id !== 'pacientes') cerrarFicha(); if (location.hash.slice(1) === id) render(); else location.hash = id; };
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

  bajas.push(B.escuchar('indice', (v) => { S.indice = v || {}; if (!S.ficha) programar(); }));
  bajas.push(B.escuchar('solicitudes', (v) => { S.solicitudes = v || {}; if (ruta().sec === 'panel') programar(); }));
  if (perfil.titular) {
    bajas.push(B.escuchar('medicos', (v) => { S.medicos = v || {}; programar(); }));
    bajas.push(B.escuchar('medicosEstado', (v) => { S.estados = v || {}; programar(); }));
  }
  window.addEventListener('hashchange', render);
  purgarVencidos(perfil).then((n) => n && toast(`Se borraron ${n} estudios vencidos`, 'info'));
  const purga = setInterval(() => purgarVencidos(perfil), 10 * 60000);

  /* ---------- Ficha ---------- */
  function abrirFicha(uid) {
    cerrarFicha();
    S.ficha = { uid, pac: null, estudios: {}, auditoria: {}, verif: null, notas: {} };
    try { sessionStorage.setItem('metria-ficha', uid); } catch { /* */ }
    const F = S.ficha;
    bajasFicha.push(B.escuchar(`pacientes/${uid}`, (v) => {
      F.pac = v || {};
      if (ruta().tab === 'datos' && form?.sucio) { toast('El paciente actualizó su ficha desde otro equipo. Guardá o recargá la pestaña Datos.', 'info', 6000); return; }
      programar();
    }));
    bajasFicha.push(B.escuchar(`estudios/${uid}`, (v) => { F.estudios = v || {}; if (ruta().tab !== 'datos') programar(); }));
    bajasFicha.push(B.escuchar(`auditoria/${uid}`, (v) => { F.auditoria = v || {}; if (ruta().tab === 'accesos') programar(); }));
    bajasFicha.push(B.escuchar(`verificados/${uid}`, (v) => { F.verif = v; if (ruta().tab !== 'datos') programar(); }));
    bajasFicha.push(B.escuchar(`evaluaciones/${uid}`, (v) => { F.notas = v || {}; if (ruta().tab === 'notas') programar(); }));
    location.hash = 'ficha/resumen';
  }
  function cerrarFicha() {
    bajasFicha.forEach((f) => f && f());
    bajasFicha = [];
    S.ficha = null;
    try { sessionStorage.removeItem('metria-ficha'); } catch { /* */ }
  }

  function render() {
    if (detenido) return;
    // Cualquier dirección que no sea de ficha (p. ej. «Pacientes») cierra la ficha abierta
    if (S.ficha && !location.hash.startsWith('#ficha')) cerrarFicha();
    const r = ruta();
    let contenido;
    if (r.sec === 'pacientes' && S.ficha) contenido = vistaFicha(r.tab);
    else if (r.sec === 'pacientes') contenido = vistaPacientes();
    else if (r.sec === 'medicos' && perfil.titular) contenido = vistaMedicos();
    else if (r.sec === 'privacidad') contenido = vistaCuenta();
    else if (r.sec === 'ayuda') contenido = vistaManual('medico');
    else contenido = vistaPanel();
    if (!(r.sec === 'pacientes' && r.tab === 'datos')) form = null;
    const clave = `${r.sec}/${r.tab || ''}`;
    const mismo = document.getElementById('contenido')?.dataset.sec === clave;
    const scroll = window.scrollY;
    montar(document.getElementById('app'), marco({
      items: items(), principales: ['panel', 'pacientes', 'ayuda'], actual: r.sec, onIr: ir, onSalir: salir,
      usuario: `${perfil.datos.nombre} ${perfil.datos.apellido}`, rolTexto: `${perfil.datos.matricula.tipo} ${perfil.datos.matricula.numero}${perfil.titular ? ' · Coordinador' : ''}`,
      extraTop: barraDemo(programar), contenido,
    }));
    const c = document.getElementById('contenido');
    c.dataset.sec = clave;
    if (r.tab) {
      const sec = PESTANAS.find(([k]) => k === r.tab)[3];
      c.setAttribute('style', Object.entries(estiloSeccion(sec)).map(([k, v]) => `${k}:${v}`).join(';'));
      ambiente(sec);
      // La pestaña activa siempre a la vista (en el teléfono las pestañas se deslizan)
      const pes = c.querySelector('.pestanas'), act = pes?.querySelector('[aria-current="page"]');
      if (pes && act) pes.scrollLeft = act.offsetLeft - pes.clientWidth / 2 + act.clientWidth / 2;
      pes?.dispatchEvent(new Event('scroll')); // muestra u oculta las flechas ya montadas
    }
    if (mismo) window.scrollTo(0, scroll); else window.scrollTo(0, 0);
  }

  /* ---------- Panel ---------- */
  function vistaPanel() {
    const filas = Object.values(S.indice);
    const cuenta = (f) => filas.filter(f).length;
    const altos = cuenta((p) => ['alto', 'muy-alto'].includes(p.riesgo));
    const cand = cuenta((p) => ['indicado', 'precaucion'].includes(p.glp1));
    const pend = Object.entries(S.solicitudes).flatMap(([uid, s]) => Object.entries(s || {}).filter(([, x]) => x.estado === 'pendiente').map(([id, x]) => ({ uid, id, ...x })));
    const kpi = (id, t, v, sub, onclick) => inclinar(h('button.kpi-tile', { type: 'button', style: estiloSeccion(id), onclick },
      h('span.tile-ico', icono(SECCIONES[id].icono, { tam: 20 })), h('small', t), h('strong.num', String(v)), h('em', sub)), 5);
    const dist = (campo, orden, nombres, colores) => {
      const tot = filas.length || 1;
      return h('div.dist', ...orden.map((k) => {
        const n = cuenta((p) => p[campo] === k);
        return h('div.dist-fila', h('span', nombres[k]), h('div.dist-pista', h('div', { style: { width: `${(n / tot) * 100}%`, background: colores[k] } })), h('strong.num', String(n)));
      }));
    };
    const imcCat = (v) => (!v ? null : v < 18.5 ? 'bajo' : v < 25 ? 'normal' : v < 30 ? 'sobrepeso' : v < 35 ? 'ob1' : v < 40 ? 'ob2' : 'ob3');
    filas.forEach((p) => { p._imc = imcCat(p.imc); });
    const esperan = perfil.titular ? Object.entries(S.estados).filter(([, e]) => e === 'pendiente').map(([uid]) => S.medicos[uid]).filter(Boolean) : [];
    return h('div.seccion',
      heroe('panel', `Hola, ${perfil.datos.nombre}`, perfil.titular ? 'Coordinación · indicadores del consultorio en vivo' : 'Indicadores del consultorio, actualizados en vivo'),
      esperan.length ? h('section.card.card--alerta-pro', { style: estiloSeccion('medicos') },
        h('div.alerta-pro', h('span.alerta-pro-ico.latido', icono('estetoscopio', { tam: 24 })),
          h('div', h('strong', esperan.length === 1 ? 'Un profesional espera tu autorización' : `${esperan.length} profesionales esperan tu autorización`),
            h('p', esperan.map((m) => `${m.nombre} ${m.apellido} (${m.matricula.tipo} ${m.matricula.numero})`).join(' · '))),
          h('button.btn.btn--primario', { type: 'button', onclick: () => ir('medicos') }, 'Revisar'))) : null,
      h('div.kpis',
        kpi('pacientes', 'Pacientes', filas.length, 'registrados', () => ir('pacientes')),
        kpi('corazon', 'Riesgo alto o muy alto', altos, 'cardiovascular', () => { S.filtro = 'riesgo'; ir('pacientes'); }),
        kpi('tratamiento', 'Candidatos GLP-1', cand, 'según el motor', () => { S.filtro = 'glp1'; ir('pacientes'); }),
        kpi('privacidad', 'Pedidos de pacientes', pend.length, 'acceso, rectificación, baja', null)),
      h('div.grid-2',
        tarjeta('Riesgo cardiovascular', { icono: 'corazon', seccion: 'corazon' }, dist('riesgo', ['muy-alto', 'alto', 'intermedio', 'limite', 'bajo'],
          { 'muy-alto': 'Muy alto', alto: 'Alto', intermedio: 'Intermedio', limite: 'Limítrofe', bajo: 'Bajo' },
          { 'muy-alto': '#be123c', alto: '#ef4444', intermedio: '#f97316', limite: '#eab308', bajo: '#22c55e' })),
        tarjeta('Índice de masa corporal', { icono: 'cuerpo', seccion: 'cuerpo' }, dist('_imc', ['bajo', 'normal', 'sobrepeso', 'ob1', 'ob2', 'ob3'],
          { bajo: 'Bajo peso', normal: 'Normal', sobrepeso: 'Sobrepeso', ob1: 'Obesidad I', ob2: 'Obesidad II', ob3: 'Obesidad III' },
          { bajo: '#38bdf8', normal: '#22c55e', sobrepeso: '#eab308', ob1: '#f97316', ob2: '#ef4444', ob3: '#be123c' }))),
      tarjeta('Pedidos de los pacientes (Ley 25.326)', { icono: 'escudo', seccion: 'privacidad' },
        pend.length ? h('ul.pedidos', ...pend.map((p) => h('li.pedido',
          chip({ acceso: 'Acceso', rectificacion: 'Rectificación', baja: 'Supresión', revocacion: 'Revocación' }[p.tipo] || p.tipo, p.tipo === 'baja' ? 'peligro' : 'info'),
          h('div', h('strong', S.indice[p.uid]?.n || 'Paciente'), h('p', p.texto || '—'), h('small', `${fechaHora(p.cuando)} · plazo legal: ${p.tipo === 'acceso' ? '10 días corridos' : '5 días hábiles'}`)),
          h('div.botones', S.indice[p.uid] ? h('button.btn.btn--suave', { type: 'button', onclick: () => abrirFicha(p.uid) }, 'Abrir ficha') : null,
            h('button.btn.btn--primario', { type: 'button', onclick: async () => { await B.escribir(`solicitudes/${p.uid}/${p.id}/estado`, 'atendido'); toast('Pedido marcado como atendido', 'ok'); } }, 'Marcar atendido'))))) : vacio('okCirculo', 'Sin pedidos pendientes', '')),
      tarjeta('Mantenimiento', { icono: 'basura' },
        h('p.ayuda', 'Los estudios vencidos se borran solos al abrir la app. Con este botón se revisan todos los estudios de todos los pacientes (incluidos los nunca descargados de más de 90 días).'),
        h('button.btn.btn--suave', { type: 'button', onclick: async (e) => { e.target.disabled = true; const n = await purgarRetencion().catch(() => 0); toast(n ? `Se borraron ${n} estudios vencidos` : 'No había estudios vencidos', 'ok'); e.target.disabled = false; } }, icono('basura', { tam: 16 }), 'Barrer estudios vencidos')));
  }

  /* ---------- Lista de pacientes ---------- */
  function vistaPacientes() {
    const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const lista = h('div.lista-pacientes');
    const filtros = [['todos', 'Todos'], ['riesgo', 'Riesgo alto'], ['glp1', 'Candidatos GLP-1'], ['incompletos', 'Ficha incompleta']];
    const pintar = () => {
      const q = norm(S.busqueda);
      const filas = Object.entries(S.indice)
        .filter(([, p]) => !q || norm(p.n).includes(q) || (p.d3 && p.d3 === q.replace(/\D/g, '').slice(-3) && q.replace(/\D/g, '').length === 3))
        .filter(([, p]) => S.filtro === 'todos' || (S.filtro === 'riesgo' && ['alto', 'muy-alto'].includes(p.riesgo)) || (S.filtro === 'glp1' && ['indicado', 'precaucion'].includes(p.glp1)) || (S.filtro === 'incompletos' && (p.completo ?? 0) < 60))
        .sort((a, b) => a[1].n.localeCompare(b[1].n, 'es'));
      lista.replaceChildren(...(filas.length ? filas.map(([uid, p]) => {
        const e = calcEdad(p.nac, new Date(B.ahora()));
        const ri = RIESGO[p.riesgo], gl = GLP[p.glp1];
        return h('button.pac', { type: 'button', onclick: () => abrirFicha(uid) },
          h('span.avatar', p.n.split(', ').reverse().map((x) => x[0]).join('').slice(0, 2)),
          h('div.pac-nombre', h('strong', p.n), h('small', `${e ?? '—'} años · ${p.sx === 'M' ? 'Varón' : 'Mujer'} · DNI ${dniMascara(p.d3)}`)),
          h('div.pac-datos',
            h('span.pac-dato', h('small', 'IMC'), h('strong.num', p.imc ? fmt(p.imc, 1) : '—')),
            ri ? chip(ri[0], ri[1], 'corazon') : chip('Riesgo s/d', 'neutro'),
            gl ? chip(gl[0], gl[1], 'jeringa') : null,
            h('span.pac-comp', { title: 'Ficha completa' }, h('i', { style: { width: `${p.completo ?? 0}%` } }))),
          icono('chevron', { tam: 18, clase: 'pac-ir' }));
      }) : [vacio('buscar', 'Sin resultados', S.busqueda ? 'Probá con otro apellido o con los 3 últimos dígitos del DNI.' : 'Todavía no hay pacientes registrados.')]));
    };
    const buscador = h('input', { type: 'search', placeholder: 'Buscar por apellido, nombre o 3 últimos dígitos del DNI', value: S.busqueda, 'aria-label': 'Buscar paciente' });
    buscador.addEventListener('input', () => { S.busqueda = buscador.value; pintar(); });
    const chipsF = h('div.filtros', ...filtros.map(([k, t]) => {
      const b = h('button.filtro', { type: 'button', 'aria-pressed': S.filtro === k }, t);
      b.onclick = () => { S.filtro = k; chipsF.querySelectorAll('.filtro').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); pintar(); };
      return b;
    }));
    pintar();
    return h('div.seccion', heroe('pacientes', 'Pacientes', `${Object.keys(S.indice).length} registrados · la lista se actualiza en vivo`),
      h('div.buscador', icono('buscar', { tam: 18 }), buscador), chipsF, lista);
  }

  /* ---------- Ficha ---------- */
  function vistaFicha(tab) {
    const F = S.ficha;
    if (!F.pac) return cargando('Abriendo la ficha…');
    const per = F.pac.perfil || {};
    const ev = evaluarPaciente(per, F.pac.clinica || {}, new Date(B.ahora()), { planActivo: F.pac.plan?.estado === 'activo' });
    const nombre = `${per.nombre} ${per.apellido}`;
    const dniEl = h('span.num', `DNI ${dniMascara(per.dni)}`);
    const verDni = h('button.btn-link', { type: 'button', onclick: () => { dniEl.textContent = `DNI ${Number(per.dni).toLocaleString('es-AR')}`; verDni.remove(); } }, 'mostrar');
    const cab = h('header.ficha-cab',
      h('button.btn-icono', { type: 'button', 'aria-label': 'Volver a la lista', onclick: () => { cerrarFicha(); location.hash = 'pacientes'; } }, icono('flechaIzq')),
      h('span.avatar.avatar--grande', `${per.nombre?.[0] || ''}${per.apellido?.[0] || ''}`),
      h('div.ficha-id', h('h2', nombre), h('small', `${ev.edad ?? '—'} años · ${per.sexo === 'M' ? 'Varón' : 'Mujer'} · `, dniEl, ' ', verDni, ` · ${per.email || ''}`)),
      h('div.ficha-acc',
        F.verif ? chip(`Identidad verificada ${fecha(F.verif.cuando)}`, 'ok', 'okCirculo') : h('button.btn.btn--primario', { type: 'button', onclick: async () => {
          if (await confirmar({ titulo: 'Verificar identidad', icono: 'huella', si: 'Sí, lo verifiqué', texto: `¿Constataste en la consulta el DNI ${Number(per.dni).toLocaleString('es-AR')} de ${nombre} con su documento?` })) {
            await verificarIdentidad(F.uid, perfil, true); toast('Identidad verificada', 'ok');
          }
        } }, icono('huella', { tam: 16 }), 'Verificar identidad'),
        h('button.btn.btn--suave', { type: 'button', onclick: () => imprimirInforme({ ev, F, medico: perfil }) }, icono('imprimir', { tam: 16 }), 'Imprimir informe')));
    const nav = h('nav.pestanas', { 'aria-label': 'Secciones de la ficha' }, ...PESTANAS.map(([k, t, ic, sec]) => h('a.pestana', { href: `#ficha/${k}`, 'aria-current': k === tab ? 'page' : null, style: estiloSeccion(sec) }, icono(ic, { tam: 16 }), t,
      k === 'estudios' && Object.keys(F.estudios).length ? h('span.nav-badge', String(Object.keys(F.estudios).length)) : null)));
    const tabs = conFlechas(nav);
    const irDatos = () => { location.hash = 'ficha/datos'; };
    let cuerpo;
    switch (tab) {
      case 'datos':
        form = formularioDatos({ uid: F.uid, perfil: per, clinica: F.pac.clinica, quien: { rol: 'medico', uid: perfil.uid }, titulo: 'Datos clínicos', onGuardado: () => { form = null; } });
        cuerpo = form.el; break;
      case 'metabolismo': cuerpo = seccionMetabolismo(ev, { rol: 'medico', irDatos }); break;
      case 'cuerpo': cuerpo = seccionCuerpo(ev, { rol: 'medico', mediciones: F.pac.mediciones, irDatos }); break;
      case 'corazon': cuerpo = seccionCorazon(ev, { rol: 'medico', irDatos }); break;
      case 'laboratorio': cuerpo = seccionLaboratorio(ev, { rol: 'medico', irDatos }); break;
      case 'tratamiento': cuerpo = panelGlp1Medico({ ev, plan: F.pac.plan, tolerancia: F.pac.tolerancia, pacUid: F.uid, medico: perfil, paciente: nombre }); break;
      case 'plan': cuerpo = vistaPlan(ev, { rol: 'medico', pacUid: F.uid, medico: perfil }); break;
      case 'estudios': cuerpo = panelEstudiosMedico({ pacUid: F.uid, paciente: nombre, estudios: F.estudios, verificado: !!F.verif }); break;
      case 'notas': cuerpo = vistaNotas(F); break;
      case 'accesos': cuerpo = vistaAccesos(F); break;
      default: cuerpo = resumen(ev, F);
    }
    return h('div.expediente', cab, tabs, h('div.ficha-cuerpo', cuerpo));
  }

  function resumen(ev, F) {
    const p = ev.prevent, g = ev.glp1;
    const dato = (sec, t, v, sub, tono) => h('div.res-dato', { style: estiloSeccion(sec) }, h('small', t), h('strong.num', v), sub ? h(`em${tono ? '.t-' + tono : ''}`, sub) : null);
    const alertas = [
      ...(g.contraindicaciones?.absolutas || []).map((c) => aviso('peligro', `Contraindicación GLP-1: ${c.texto}`)),
      ...(g.interacciones || []).filter((i) => i.severidad === 'alta').map((i) => aviso('aviso', `Interacción: ${i.farmaco} — ${i.conducta}`)),
      ev.glucemia?.id === 'dm-lab' ? aviso('aviso', 'Laboratorio en rango de diabetes sin diagnóstico cargado.') : null,
      ev.der.fib4 > 2.67 ? aviso('aviso', `FIB-4 ${fmt(ev.der.fib4, 2)}: probable fibrosis avanzada.`) : null,
      ev.pa?.id === 'crisis' ? aviso('peligro', 'Presión ≥ 180/120: evaluar urgencia hipertensiva.') : null,
    ].filter(Boolean);
    const plan = F.pac.plan;
    return h('div.seccion',
      alertas.length ? h('div.avisos', ...alertas) : null,
      h('div.res-grid',
        dato('cuerpo', 'IMC', ev.comp ? fmt(ev.comp.imc, 1) : '—', ev.comp?.categoria.nombre),
        dato('cuerpo', 'Cintura', ev.antropo.cintura ? `${ev.antropo.cintura} cm` : '—', ev.comp?.ict ? `ICT ${fmt(ev.comp.ict.valor, 2)}` : null),
        dato('metabolismo', 'TMB / GET', ev.ener ? `${fmt0(ev.ener.tmb)} / ${fmt0(ev.ener.get)}` : '—', 'kcal/día (Mifflin)'),
        dato('corazon', 'Riesgo CV', ev.categoria?.nombre || '—', p.ok ? `PREVENT ECV ${fmt(p.cvd10, 1)} % · ASCVD ${fmt(p.ascvd10, 1)} %` : 'PREVENT: faltan datos'),
        dato('corazon', 'Presión', ev.vitales.pas ? `${ev.vitales.pas}/${ev.vitales.pad}` : '—', ev.pa?.nombre),
        dato('laboratorio', 'LDL', Number.isFinite(ev.der.ldl) ? `${fmt0(ev.der.ldl)} mg/dL` : '—', ev.ldlObjetivo ? `Objetivo < ${ev.ldlObjetivo}` : null, Number.isFinite(ev.der.ldl) && ev.ldlObjetivo && ev.der.ldl >= ev.ldlObjetivo ? 'mal' : 'bien'),
        dato('laboratorio', 'HbA1c / glucemia', `${ev.labs.hba1c ? fmt(ev.labs.hba1c, 1) + ' %' : '—'} / ${ev.labs.glucosa ?? '—'}`, ev.glucemia?.nombre),
        dato('laboratorio', 'Filtrado (CKD-EPI)', Number.isFinite(ev.der.tfg) ? fmt0(ev.der.tfg) : '—', ev.der.erc ? `Estadio ${ev.der.erc.texto}` : null),
        dato('tratamiento', 'Motor GLP-1', GLP[g.veredicto]?.[0] || g.titulo, g.opciones?.[0] ? `Sugerida: ${g.opciones[0].farmaco.generico} (${g.opciones[0].farmaco.comercial})` : null),
        dato('tratamiento', 'Plan', plan ? `${GL.farmaco(plan.farmaco)?.comercial} · ${plan.estado}` : 'Sin plan', plan ? `Desde ${fecha(plan.inicio)}` : null),
        dato('cuerpo', 'Obesidad (Lancet 2025)', ev.lancet?.nombre || '—', `Edmonton estadio ${ev.eoss.estadio}`),
        dato('datos', 'Ficha', `${ev.completitud.pct} %`, F.pac.clinica?.actualizado ? `Actualizada ${fechaHora(F.pac.clinica.actualizado)} por ${F.pac.clinica.actualizadoPor === 'medico' ? 'un médico' : 'el paciente'}` : 'Sin datos clínicos')),
      tarjeta('Medicación', { icono: 'pildora' }, ev.meds.length ? h('ul.lista', ...ev.meds.map((m) => h('li', m.nombre))) : h('p.ayuda', 'Sin medicación cargada.')),
      tarjeta('Antecedentes', { icono: 'corazon' }, Object.keys(ev.pat).length ? h('div.chips', ...Object.keys(ev.pat).map((k) => chip(k.replace(/([A-Z])/g, ' $1').toLowerCase(), 'neutro'))) : h('p.ayuda', 'Sin antecedentes cargados.')));
  }

  function vistaNotas(F) {
    const ta = h('textarea', { rows: 4, maxlength: 4000, 'aria-label': 'Nueva nota', placeholder: 'Evolución, decisiones, pedidos de estudios… (solo la ven los profesionales)' });
    const btn = h('button.btn.btn--primario', { type: 'button' }, icono('ok', { tam: 16 }), 'Guardar nota');
    btn.onclick = async () => { if (!ta.value.trim()) return; btn.disabled = true; try { await guardarNota(F.uid, ta.value.trim(), perfil); ta.value = ''; toast('Nota guardada', 'ok'); } catch { toast('No se pudo guardar', 'error'); } btn.disabled = false; };
    const notas = Object.values(F.notas || {}).sort((a, b) => b.cuando - a.cuando);
    return h('div.seccion', heroe('ayuda', 'Notas del equipo', 'Visibles solo para profesionales. No reemplazan la historia clínica oficial.'),
      tarjeta('Nueva nota', { icono: 'editar' }, ta, h('div.botones', btn)),
      notas.length ? h('div.notas', ...notas.map((n) => h('article.nota', h('header', h('strong', n.nombre), h('time', fechaHora(n.cuando))), h('p', n.texto)))) : vacio('editar', 'Sin notas', ''));
  }

  function vistaAccesos(F) {
    const reg = Object.values(F.auditoria || {}).sort((a, b) => b.cuando - a.cuando);
    const ACC = { 'alta-cuenta': 'Creó la cuenta', subio: 'Subió un estudio', abrio: 'Abrió un estudio', descargo: 'Descargó un estudio', borro: 'Borró un estudio', 'borrado-automatico': 'Borrado automático', plan: 'Plan indicado', 'verifico-identidad': 'Verificó identidad', 'quito-verificacion': 'Quitó verificación' };
    const tit = (id) => F.estudios[id]?.titulo || (id ? 'estudio ya borrado' : '');
    return h('div.seccion', heroe('privacidad', 'Registro de accesos', 'Quién abrió, descargó, subió o borró, y cuándo. El paciente ve este mismo registro.'),
      reg.length ? h('ul.auditoria', ...reg.map((r) => h('li', h('span.aud-ico', icono(r.accion === 'descargo' ? 'bajar' : r.accion === 'abrio' ? 'ojo' : 'info', { tam: 16 })),
        h('div', h('strong', ACC[r.accion] || r.accion), h('small', `${r.quien === F.uid ? 'Paciente' : r.quien === perfil.uid ? 'Vos' : r.quien === 'sistema' ? 'Sistema' : 'Otro profesional'}${r.estudio ? ' · ' + tit(r.estudio) : ''}`)), h('time', fechaHora(r.cuando))))) : vacio('ojo', 'Sin registros', ''));
  }

  /* ---------- Profesionales (solo el coordinador: "titular" en el código) ---------- */
  function vistaMedicos() {
    const lista = Object.entries(S.medicos).sort((a, b) => (S.estados[a[0]] === 'pendiente' ? -1 : 1) - (S.estados[b[0]] === 'pendiente' ? -1 : 1));
    const cambiar = async (uid, estado, m) => {
      if (estado === 'aprobado' && !(await confirmar({ titulo: 'Autorizar profesional', icono: 'estetoscopio', si: 'Autorizar', texto: `¿Verificaste la matrícula ${m.matricula.tipo} ${m.matricula.numero} de ${m.nombre} ${m.apellido} en SISA / REFEPS? Al autorizarlo podrá ver los datos de todos los pacientes.` }))) return;
      await B.escribir(`medicosEstado/${uid}`, estado);
      toast(estado === 'aprobado' ? 'Profesional autorizado: ya puede entrar' : 'Profesional suspendido: ya no puede entrar', 'ok');
    };
    return h('div.seccion', heroe('medicos', 'Profesionales', 'Como coordinador, autorizás a cada profesional: sin tu OK no puede entrar ni ver pacientes.'),
      aviso('info', h('span', 'Verificá cada matrícula en el ', h('a', { href: 'https://sisa.msal.gov.ar/sisa/#sisa', target: '_blank', rel: 'noopener' }, 'registro oficial (SISA / REFEPS)'), ' antes de autorizar.')),
      h('div.lista-medicos', ...lista.map(([uid, m]) => {
        const est = uid === perfil.uid ? 'titular' : S.estados[uid] || 'pendiente';
        return h('article.medico-fila',
          h('span.avatar', `${m.nombre[0]}${m.apellido[0]}`),
          h('div', h('strong', `${m.nombre} ${m.apellido}`), h('small', `${m.especialidad} · ${m.matricula.tipo} ${m.matricula.numero}${m.matricula.provincia ? ' (' + m.matricula.provincia + ')' : ''} · ${m.email}`)),
          chip({ titular: 'Coordinador', aprobado: 'Autorizado', pendiente: 'Esperando tu OK', suspendido: 'Suspendido' }[est], { titular: 'info', aprobado: 'ok', pendiente: 'aviso', suspendido: 'peligro' }[est]),
          est === 'titular' ? null : h('div.botones',
            est !== 'aprobado' ? h('button.btn.btn--primario', { type: 'button', onclick: () => cambiar(uid, 'aprobado', m) }, icono('ok', { tam: 16 }), 'Autorizar') : null,
            est === 'aprobado' ? h('button.btn.btn--suave', { type: 'button', onclick: () => cambiar(uid, 'suspendido', m) }, 'Suspender') : null));
      })));
  }

  function vistaCuenta() {
    return h('div.seccion', heroe('privacidad', 'Mi cuenta', 'Seguridad y documentos'),
      tarjeta('Datos profesionales', { icono: 'estetoscopio' }, h('p', h('strong', `${perfil.datos.nombre} ${perfil.datos.apellido}`), ` · ${perfil.datos.especialidad} · ${perfil.datos.matricula.tipo} ${perfil.datos.matricula.numero} · ${perfil.email}`)),
      tarjeta('Correo de ingreso', { icono: 'campana' }, cambioCorreo(perfil)),
      tarjeta('Contraseña', { icono: 'candado' }, cambioClave()),
      tarjeta('Compromiso de confidencialidad', { icono: 'escudo' }, h('p', 'Aceptaste resguardar la confidencialidad de los datos (Ley 25.326, art. 10) y el secreto profesional (Ley 17.132, art. 11). Cada apertura o descarga de un estudio queda registrada y la ve el paciente.'),
        h('div.botones', h('button.btn.btn--suave', { type: 'button', onclick: () => verTexto('Política de privacidad', POLITICA()) }, 'Política de privacidad'), h('button.btn.btn--suave', { type: 'button', onclick: () => verTexto('Términos de uso', TERMINOS()) }, 'Términos de uso'))));
  }

  let detenido = false;
  function detener() {
    if (detenido) return;
    detenido = true;
    cerrarTodos();
    cerrarFicha();
    bajas.forEach((f) => f && f());
    clearInterval(purga);
    window.removeEventListener('hashchange', render);
  }
  async function salir() { detener(); await onSalir(); }

  // Reabrir la ficha si se recargó la página
  let previa = null;
  try { previa = sessionStorage.getItem('metria-ficha'); } catch { /* */ }
  if (previa && location.hash.startsWith('#ficha')) { const tab = location.hash.split('/')[1]; abrirFicha(previa); location.hash = `ficha/${tab || 'resumen'}`; }
  else render();
  return { detener };
}

/* Flechas ‹ › para recorrer las pestañas cuando no entran (con mouse no hay otra forma de deslizarlas). */
function conFlechas(nav) {
  const flecha = (dir) => h(`button.pestanas-flecha.pestanas-flecha--${dir < 0 ? 'izq' : 'der'}`, {
    type: 'button', 'aria-label': dir < 0 ? 'Ver pestañas anteriores' : 'Ver más pestañas', tabindex: '-1',
    onclick: () => nav.scrollBy({ left: dir * Math.max(120, nav.clientWidth * 0.7), behavior: 'smooth' }),
  }, icono(dir < 0 ? 'flechaIzq' : 'flechaDer', { tam: 16 }));
  const marco = h('div.pestanas-marco', flecha(-1), nav, flecha(1));
  const actualizar = () => {
    const max = nav.scrollWidth - nav.clientWidth;
    marco.classList.toggle('hay-antes', nav.scrollLeft > 4);
    marco.classList.toggle('hay-despues', nav.scrollLeft < max - 4);
  };
  nav.addEventListener('scroll', actualizar, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(actualizar).observe(nav);
  window.addEventListener('resize', () => { if (nav.isConnected) actualizar(); }, { passive: true });
  return marco;
}
