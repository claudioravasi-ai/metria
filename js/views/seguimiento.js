/* ============================================================
   Seguimiento a 10 años — pantallas
   Médico: búsqueda por DNI con la bandeja (AP pendientes, controles
   del mes, vencidos), calendario de 10 años, ficha de seguimiento del
   paciente, carga del estudio con sus hallazgos y conciliación con la
   anatomía patológica (frasco por frasco) con la fecha definitiva.
   Paciente: su próximo control, en palabras simples.
   ============================================================ */

import { h } from '../core/dom.js';
import { icono } from '../core/iconos.js';
import { heroe, tarjeta, chip, aviso, toast, modal, confirmar, fecha, fechaHora, vacio, hoyISO, dniMascara } from '../core/ui.js';
import { campo, segmentado } from '../ui/campos.js';
import { backend } from '../data/servicio.js';
import * as S from '../data/seguimiento.js';
import * as C from '../engine/calendario.js';
import { CATEGORIAS, textoIntervalo } from '../engine/vigilancia.js';

const B = () => backend();
const M = { tab: 'buscar', pac: null, anio: null, mes: null, tipos: ['veda', 'vcc', 'rsc'] };
const hoy = () => hoyISO(B().ahora());
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const mesAnio = (iso) => `${MESES[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
const nombrePac = (ctx, pac) => ctx.indice?.[pac]?.n || 'Paciente';
const segDe = (ctx, pac) => ctx.seguimiento?.[pac] || {};
/** Turno activo del paciente que cubre ese control (pedido desde Endoscopia). */
const turnoPara = (ctx, pac, tipo) => Object.values(ctx.turnos?.[pac] || {}).filter((t) => ['confirmado', 'admitido', 'suspendido'].includes(t.estado) && (t.tipo === tipo || t.tipo === 'doble')).sort((a, b) => a.fecha.localeCompare(b.fecha))[0] || null;
const chipTurno = (ctx, pac, tipo) => { const t = turnoPara(ctx, pac, tipo); return t ? chip(`Turno ${fecha(t.fecha)}`, 'ok', 'ticket') : null; };
const tipoChip = (t) => chip(C.NOMBRE_ESTUDIO[t] || t, t === 'veda' ? 'info' : 'ok');
const estadoChip = (c) => chip(C.ESTADOS_CONTROL[c.estado]?.nombre || c.estado, C.ESTADOS_CONTROL[c.estado]?.tono || 'neutro');
const casilla = (texto, valor, onChange) => h('label.check', h('input', { type: 'checkbox', checked: !!valor, onchange: (e) => onChange(e.target.checked) }), h('span', texto));
const sel = (etq, opciones, valor, onChange, props = {}) => {
  const c = campo(etq, { type: 'select', value: valor ?? '', opciones, ...props });
  c.querySelector('select').addEventListener('change', (e) => onChange(e.target.value));
  return c;
};
const entrada = (etq, valor, onChange, props = {}, extra = {}) => {
  const c = campo(etq, { value: valor ?? '', ...props }, extra);
  c.querySelector('input').addEventListener('input', (e) => onChange(e.target.value));
  return c;
};

/** Abrir la ficha de seguimiento de un paciente desde otra sección (p. ej. Endoscopia). */
export function irASeguimiento(pac) { M.tab = 'buscar'; M.pac = pac; }

/* ======================= VISTA DEL MÉDICO ======================= */

export function vistaSeguimientoMedico(ctx) {
  if (M.pac && !ctx.indice?.[M.pac]) M.pac = null;
  const tabs = [['buscar', 'DNI y bandeja', 'buscar'], ['calendario', 'Calendario 10 años', 'calendario']];
  return h('div.seccion.seg',
    heroe('seguimiento', 'Seguimiento endoscópico', 'Próximos controles de VEDA y VCC según los hallazgos y la anatomía patológica'),
    M.pac ? null : h('div.filtros', ...tabs.map(([k, t, ic]) => h('button.filtro', { type: 'button', 'aria-pressed': M.tab === k, onclick: () => { M.tab = k; ctx.render(); } }, icono(ic, { tam: 15 }), ` ${t}`))),
    M.pac ? fichaSeguimiento(ctx, M.pac) : M.tab === 'calendario' ? vistaCalendario(ctx) : vistaBuscar(ctx));
}

/* ---------- 1. Búsqueda por DNI y bandeja ---------- */
function vistaBuscar(ctx) {
  const inp = h('input.seg-dni-input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', placeholder: 'DNI del paciente', 'aria-label': 'DNI del paciente', maxlength: 12 });
  const msg = h('p.ayuda', { 'aria-live': 'polite' });
  const buscar = async () => {
    const dni = inp.value.replace(/\D/g, '');
    if (dni.length < 7) { msg.textContent = 'Escribí el DNI completo (7 u 8 números).'; return; }
    msg.textContent = 'Buscando…';
    const pac = await S.buscarPorDni(dni, ctx.indice);
    if (!pac) { msg.textContent = 'No hay ningún paciente registrado con ese DNI. El paciente tiene que crear su cuenta con su correo (le llega un código de ingreso).'; return; }
    const esperando = Object.entries(segDe(ctx, pac).estudios || {}).filter(([, e]) => e.estado === 'esperando-ap').sort((a, b) => b[1].fecha.localeCompare(a[1].fecha))[0];
    M.pac = pac;
    ctx.render();
    if (esperando) setTimeout(() => abrirConciliacion(ctx, pac, esperando[0]), 50);
  };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') buscar(); });
  setTimeout(() => inp.focus(), 80);
  const b = C.bandeja(ctx.seguimiento, hoy());
  const kpi = (t, v, ic, tono) => h(`div.endo-kpi${tono ? '.seg-kpi--' + tono : ''}`, icono(ic, { tam: 18 }), h('strong.num', String(v)), h('small', t));
  const fila = (pac, linea, chips, onclick) => h('button.seg-fila', { type: 'button', onclick },
    h('div', h('strong', nombrePac(ctx, pac)), h('small', `DNI ${dniMascara(ctx.indice?.[pac]?.d3)} · ${linea}`)), h('div.chips', ...chips), icono('chevron', { tam: 16 }));
  const avisar = B().modo === 'demo' ? Object.entries(ctx.seguimiento || {}).flatMap(([pac, s]) => C.controlesParaAvisar(s.controles, hoy()).map(([cid, c]) => ({ pac, cid, c }))) : [];
  return h('div.seg-buscar',
    tarjeta('Buscar paciente por DNI', { icono: 'buscar', seccion: 'seguimiento' },
      h('div.seg-dni', inp, h('button.btn.btn--primario', { type: 'button', onclick: buscar }, icono('buscar', { tam: 16 }), 'Buscar')),
      msg,
      h('p.ayuda', 'Si el paciente tiene un estudio esperando la anatomía patológica, se abre directo la conciliación. Si no, su ficha de seguimiento.')),
    h('div.endo-kpis', kpi('AP pendientes', b.ap.length, 'matraz', b.ap.some((x) => x.vencido) ? 'aviso' : null), kpi('conducta inmediata', b.inmediatos.length, 'alerta', b.inmediatos.length ? 'peligro' : null), kpi('controles vencidos', b.vencidos.length, 'reloj', b.vencidos.length ? 'peligro' : null), kpi('en los próximos 30 días', b.mes.length, 'calendario')),
    avisar.length ? aviso('info', h('span', `En producción el servidor avisa por correo a cada paciente 30 días antes de su control. En la demo hay ${avisar.length} aviso${avisar.length > 1 ? 's' : ''} para mandar: `, h('button.btn-link', { type: 'button', onclick: async () => { for (const x of avisar) await S.marcarAvisado(x.pac, x.cid); toast(`Avisos simulados: ${avisar.map((x) => nombrePac(ctx, x.pac)).join(', ')}`, 'ok', 6000); } }, 'simular el servidor ahora'))) : null,
    b.inmediatos.length ? tarjeta('Conducta inmediata', { icono: 'alerta', seccion: 'seguimiento' }, h('div.seg-lista', ...b.inmediatos.map((x) => fila(x.pac, x.c.regla.texto.slice(0, 90), [tipoChip(x.c.tipo), estadoChip(x.c)], () => { M.pac = x.pac; ctx.render(); })))) : null,
    tarjeta(`Anatomía patológica pendiente (${b.ap.length})`, { icono: 'matraz', seccion: 'seguimiento' },
      b.ap.length ? h('div.seg-lista', ...b.ap.map((x) => fila(x.pac, `${C.NOMBRE_ESTUDIO[x.e.tipo]} del ${fecha(x.e.fecha)}`, [chip(`${x.dias} día${x.dias === 1 ? '' : 's'}`, x.vencido ? 'aviso' : 'neutro', 'reloj'), x.vencido ? chip('Reclamar resultado', 'aviso') : null].filter(Boolean), () => { M.pac = x.pac; ctx.render(); setTimeout(() => abrirConciliacion(ctx, x.pac, x.id), 50); })))
        : h('p.ayuda', 'Ningún estudio espera anatomía patológica.')),
    b.vencidos.length ? tarjeta(`Controles vencidos (${b.vencidos.length})`, { icono: 'reloj', seccion: 'seguimiento' }, h('div.seg-lista', ...b.vencidos.map((x) => fila(x.pac, `debía hacerse en ${mesAnio(x.f)}`, [tipoChip(x.c.tipo), estadoChip(x.c), chipTurno(ctx, x.pac, x.c.tipo)].filter(Boolean), () => { M.pac = x.pac; ctx.render(); })))) : null,
    tarjeta('Controles de los próximos 30 días', { icono: 'calendario', seccion: 'seguimiento' },
      b.mes.length ? h('div.seg-lista', ...b.mes.map((x) => fila(x.pac, fecha(x.f), [tipoChip(x.c.tipo), estadoChip(x.c), x.c.avisado ? chip('Paciente avisado', 'info', 'campana') : null, chipTurno(ctx, x.pac, x.c.tipo)].filter(Boolean), () => { M.pac = x.pac; ctx.render(); })))
        : h('p.ayuda', 'No hay controles en los próximos 30 días.')));
}

/* ---------- 3. Calendario de 10 años ---------- */
function vistaCalendario(ctx) {
  const anio0 = +hoy().slice(0, 4);
  if (!M.anio) M.anio = anio0;
  const cal = C.calendario(ctx.seguimiento, { desde: `${anio0}-01-01`, anios: 10, tipos: M.tipos });
  const totalAnio = (a) => Object.values(cal[a] || {}).reduce((n, l) => n + l.length, 0);
  const anios = Array.from({ length: 11 }, (_, i) => anio0 + i);
  const max = Math.max(1, ...anios.map((a) => totalAnio(String(a))));
  const delAnio = cal[String(M.anio)] || {};
  const lista = M.mes ? (delAnio[M.mes] || []).sort((a, b) => a.f.localeCompare(b.f)) : [];
  const conteo = (l, t) => l.filter((x) => x.c.tipo === t).length;
  return h('div.seg-cal',
    h('div.filtros', ...[['veda', 'VEDA'], ['vcc', 'VCC'], ['rsc', 'Rectosigmoidoscopia']].map(([t, n]) => h('button.filtro', { type: 'button', 'aria-pressed': M.tipos.includes(t), onclick: () => { M.tipos = M.tipos.includes(t) ? M.tipos.filter((x) => x !== t) : [...M.tipos, t]; ctx.render(); } }, n))),
    tarjeta('Controles por año', { icono: 'grafico', seccion: 'seguimiento' },
      h('div.seg-anios', ...anios.map((a) => {
        const n = totalAnio(String(a));
        return h('button.seg-anio', { type: 'button', 'aria-pressed': a === M.anio, onclick: () => { M.anio = a; M.mes = null; ctx.render(); } },
          h('span.seg-anio-barra', h('i', { style: { height: `${Math.round((n / max) * 100)}%` } })), h('strong.num', String(n)), h('small.num', String(a)));
      }))),
    tarjeta(`${M.anio}`, { icono: 'calendario', seccion: 'seguimiento', extra: h('div.chips', h('span.seg-ley.seg-ley--veda', 'VEDA'), h('span.seg-ley.seg-ley--vcc', 'VCC'), h('span.seg-ley.seg-ley--proy', 'Proyectado')) },
      h('div.seg-meses', ...MESES.map((nm, i) => {
        const k = String(i + 1).padStart(2, '0');
        const l = delAnio[k] || [];
        const proy = l.filter((x) => x.c.estado === 'proyectado').length;
        return h('button.seg-mes', { type: 'button', 'aria-pressed': M.mes === k, disabled: !l.length, onclick: () => { M.mes = M.mes === k ? null : k; ctx.render(); } },
          h('strong', nm), h('div.seg-mes-n', conteo(l, 'veda') ? h('span.seg-ley.seg-ley--veda.num', String(conteo(l, 'veda'))) : null, conteo(l, 'vcc') + conteo(l, 'rsc') ? h('span.seg-ley.seg-ley--vcc.num', String(conteo(l, 'vcc') + conteo(l, 'rsc'))) : null, proy ? h('small', `${proy} proyectado${proy > 1 ? 's' : ''}`) : null, !l.length ? h('small', '—') : null));
      })),
      M.mes ? h('div.seg-lista', h('h4', `${MESES[+M.mes - 1]} ${M.anio}`), ...lista.map((x) => h('button.seg-fila', { type: 'button', onclick: () => { M.pac = x.pac; ctx.render(); } },
        h('div', h('strong', nombrePac(ctx, x.pac)), h('small', `${fecha(x.f)} · ${x.c.regla?.guia || ''}`)), h('div.chips', tipoChip(x.c.tipo), estadoChip(x.c)), icono('chevron', { tam: 16 })))) : h('p.ayuda', 'Tocá un mes para ver los pacientes.')));
}

/* ---------- 5. Ficha de seguimiento ---------- */
function fichaSeguimiento(ctx, pac) {
  const s = segDe(ctx, pac);
  const fila = ctx.indice[pac] || {};
  const edad = fila.nac ? C.edadEn(fila.nac, hoy()) : null;
  const estudios = Object.entries(s.estudios || {}).sort((a, b) => b[1].fecha.localeCompare(a[1].fecha));
  const controles = Object.entries(s.controles || {});
  const vigentes = controles.filter(([, c]) => C.VIGENTES.includes(c.estado)).sort((a, b) => C.fechaControl(a[1]).localeCompare(C.fechaControl(b[1])));
  const proyectados = controles.filter(([, c]) => c.estado === 'proyectado').sort((a, b) => a[1].fecha.localeCompare(b[1].fecha));
  const union = C.propuestaUnion(s.controles);
  const ant = { ...(s.antecedentes || {}) };
  const historial = Object.values(s.historial || {}).sort((a, b) => (b.cuando || 0) - (a.cuando || 0)).slice(0, 12);
  return h('div.seg-ficha',
    h('div.botones', h('button.btn.btn--suave', { type: 'button', onclick: () => { M.pac = null; ctx.render(); } }, icono('flechaIzq', { tam: 15 }), 'Volver a la bandeja'),
      ctx.abrirFicha ? h('button.btn.btn--suave', { type: 'button', onclick: () => ctx.abrirFicha(pac) }, icono('usuario', { tam: 15 }), 'Ficha clínica') : null,
      h('button.btn.btn--primario', { type: 'button', onclick: () => abrirEstudio(ctx, pac, {}) }, icono('mas', { tam: 15 }), 'Cargar estudio')),
    h('section.card.seg-cab', h('div', h('h2', fila.n || 'Paciente'), h('small', `${edad ?? '—'} años · DNI ${dniMascara(fila.d3)}`))),
    union ? aviso('info', h('span', `La VEDA y la VCC caen a ${Math.round(union.meses)} meses una de otra. `, h('button.btn-link', { type: 'button', onclick: async () => { await S.unirControles(pac, union.ids, union.fecha); toast(`VEDA y VCC unidas para el ${fecha(union.fecha)}`, 'ok'); } }, `Hacerlas juntas el ${fecha(union.fecha)}`))) : null,
    tarjeta('Próximos controles', { icono: 'calendario', seccion: 'seguimiento' },
      vigentes.length ? h('div.seg-controles', ...vigentes.map(([cid, c]) => tarjetaControl(ctx, pac, cid, c))) : h('p.ayuda', estudios.length ? 'Sin controles programados: según los hallazgos, no requiere vigilancia endoscópica.' : 'Todavía no hay estudios cargados para este paciente.')),
    estudios.length ? tarjeta('Línea de tiempo a 10 años', { icono: 'grafico', seccion: 'seguimiento' }, lineaTiempo(estudios, [...vigentes, ...proyectados])) : null,
    proyectados.length ? tarjeta('Controles proyectados (si cada control sale normal)', { icono: 'reloj', seccion: 'seguimiento' },
      h('ul.seg-proy', ...proyectados.map(([, c]) => h('li', h('strong.num', fecha(c.fecha)), tipoChip(c.tipo), h('small', `${textoIntervalo(c.intervalo)} después del anterior · ${c.regla.guia}`), c.nota ? h('small.seg-nota', c.nota) : null)))) : null,
    tarjeta('Estudios', { icono: 'endoscopio', seccion: 'seguimiento' },
      estudios.length ? h('div.seg-lista', ...estudios.map(([eid, e]) => h('div.seg-fila.seg-fila--estatica',
        h('div', h('strong', `${C.NOMBRE_ESTUDIO[e.tipo]} · ${fecha(e.fecha)}`), h('small', `${Object.keys(e.hallazgos || {}).length} hallazgo${Object.keys(e.hallazgos || {}).length === 1 ? '' : 's'}${e.histologia?.protocolo ? ` · AP ${e.histologia.protocolo}` : ''}`)),
        h('div.chips', chip(e.estado === 'esperando-ap' ? 'Esperando AP' : e.estado === 'definitivo' ? 'Con AP: definitivo' : 'Sin biopsias', e.estado === 'esperando-ap' ? 'aviso' : 'ok')),
        h('div.botones',
          e.estado !== 'sin-biopsias' ? h('button.btn.btn--primario', { type: 'button', onclick: () => abrirConciliacion(ctx, pac, eid) }, icono('matraz', { tam: 15 }), e.estado === 'esperando-ap' ? 'Cargar anatomía patológica' : 'Ver o corregir AP') : null,
          h('button.btn.btn--suave', { type: 'button', onclick: () => abrirEstudio(ctx, pac, { id: eid, estudio: e }) }, icono('editar', { tam: 15 }), 'Hallazgos')))))
        : vacio('endoscopio', 'Sin estudios', 'Cargá el estudio al terminar la endoscopia (o desde el turno realizado en Endoscopia).')),
    tarjeta('Antecedentes que cambian los intervalos', { icono: 'usuarios', seccion: 'seguimiento' },
      h('div.inf-checks', ...C.ANTECEDENTES_SEG.map(([k, t]) => casilla(t, ant[k], (v) => { ant[k] = v; }))),
      h('div.botones', h('button.btn.btn--suave', { type: 'button', onclick: async () => {
        await S.guardarAntecedentes(pac, ant);
        // Recalcula el último estudio de cada tipo con los antecedentes nuevos
        const ultimos = {};
        for (const [eid, e] of estudios) for (const t of (e.tipo === 'doble' ? ['veda', 'vcc'] : [e.tipo])) ultimos[t] ||= [eid, e];
        for (const [eid, e] of new Map(Object.values(ultimos).map((x) => [x[0], x[1]]))) {
          await S.guardarEstudio(pac, { id: eid, estudio: e, antecedentes: ant, nac: fila.nac, seguimientoActual: segDe(ctx, pac), que: 'Antecedentes actualizados: controles recalculados' });
        }
        toast('Antecedentes guardados y controles recalculados', 'ok');
      } }, icono('ok', { tam: 15 }), 'Guardar y recalcular'))),
    historial.length ? tarjeta('Historial', { icono: 'reloj', seccion: 'seguimiento' },
      h('ol.linea-estado', ...historial.map((x) => h('li', h('time', fechaHora(x.cuando)), h('span', x.que, ...(x.despues || []).map((d) => h('small', ` · ${C.NOMBRE_ESTUDIO[d.tipo]}: ${fecha(d.fecha)}${(x.antes || []).find((a) => a.parte === d.parte && a.fecha !== d.fecha) ? ` (antes ${fecha(x.antes.find((a) => a.parte === d.parte).fecha)})` : ''}`))))))) : null);
}

function tarjetaControl(ctx, pac, cid, c) {
  const f = C.fechaControl(c);
  const dias = C.diasEntre(hoy(), f);
  const cat = CATEGORIAS[c.riesgo];
  return h(`article.seg-control.vig--${c.riesgo || 'bajo'}`,
    h('header', tipoChip(c.tipo), estadoChip(c), cat ? chip(cat.nombre, cat.tono) : null, c.avisado ? chip('Paciente avisado', 'info', 'campana') : null),
    c.estado === 'inmediato' ? h('strong.seg-control-fecha', 'Conducta inmediata') : h('div.seg-control-fecha', h('strong.num', fecha(f)), h('small', dias < 0 ? `vencido hace ${-dias} días` : dias === 0 ? 'hoy' : `en ${dias < 60 ? `${dias} días` : textoIntervalo(Math.round(dias / 30.44)).replace('En ', '')}`)),
    c.ajuste ? h('small.seg-nota', `Fecha ajustada por el médico (sugerida: ${fecha(c.fecha)}). Motivo: ${c.ajuste.motivo}`) : null,
    h('p', c.regla.texto), h('small.ayuda', `${c.regla.guia} · ${c.regla.version}`),
    c.nota ? h('small.seg-nota', c.nota) : null,
    h('div.botones',
      c.estado !== 'inmediato' ? h('button.btn.btn--suave', { type: 'button', onclick: () => ajustar(pac, cid, c) }, icono('calendario', { tam: 15 }), 'Cambiar fecha') : null,
      h('button.btn-link.btn-peligro', { type: 'button', onclick: () => anular(pac, cid) }, 'Anular')));
}

function ajustar(pac, cid, c) {
  const d = { fecha: C.fechaControl(c), motivo: '' };
  const err = h('p.error', { 'aria-live': 'polite' });
  const m = modal({
    titulo: 'Cambiar la fecha del control', ancho: 480,
    cuerpo: h('div', h('p.ayuda', `Fecha sugerida por el motor: ${fecha(c.fecha)} (${c.regla.guia}).`),
      entrada('Nueva fecha', d.fecha, (v) => { d.fecha = v; }, { type: 'date' }), entrada('Motivo', '', (v) => { d.motivo = v; }, { maxlength: 300, placeholder: 'Ej.: coordinar con la VCC, pedido del paciente' }), err),
    acciones: [h('button.btn.btn--suave', { type: 'button', onclick: () => m.cerrar() }, 'Cancelar'), h('button.btn.btn--primario', { type: 'button', onclick: async () => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha)) { err.textContent = 'Elegí una fecha.'; return; }
      if (!d.motivo.trim()) { err.textContent = 'Escribí el motivo: queda en el historial.'; return; }
      await S.ajustarControl(pac, cid, d.fecha, d.motivo); m.cerrar(); toast('Fecha cambiada', 'ok');
    } }, 'Guardar')],
  });
}

async function anular(pac, cid) {
  let motivo = '';
  const m = modal({
    titulo: 'Anular el control', ancho: 480,
    cuerpo: h('div', entrada('Motivo', '', (v) => { motivo = v; }, { maxlength: 300, placeholder: 'Ej.: edad y comorbilidades, decisión compartida con el paciente' })),
    acciones: [h('button.btn.btn--suave', { type: 'button', onclick: () => m.cerrar() }, 'Volver'), h('button.btn.btn--peligro', { type: 'button', onclick: async () => {
      if (!motivo.trim()) { toast('Escribí el motivo', 'aviso'); return; }
      await S.anularControl(pac, cid, motivo); m.cerrar(); toast('Control anulado', 'ok');
    } }, 'Anular control')],
  });
}

/** Línea de tiempo: estudios realizados y controles (vigentes y proyectados), un carril por tipo. */
function lineaTiempo(estudios, controles) {
  const a0 = Math.min(+hoy().slice(0, 4), ...estudios.map(([, e]) => +e.fecha.slice(0, 4)));
  const a1 = Math.max(a0 + 10, ...controles.map(([, c]) => +C.fechaControl(c).slice(0, 4)));
  const W = 760, x0 = 110, x1 = W - 24;
  const X = (iso) => x0 + ((+iso.slice(0, 4) + (+iso.slice(5, 7) - 1) / 12 - a0) / (a1 + 1 - a0)) * (x1 - x0);
  const carriles = [['veda', 'VEDA', 60], ['vcc', 'VCC', 104]];
  const Y = (t) => (t === 'veda' ? 60 : 104);
  const svg = h('svg.seg-linea', { viewBox: `0 0 ${W} 150`, role: 'img', 'aria-label': 'Línea de tiempo de estudios y controles' },
    ...Array.from({ length: a1 - a0 + 2 }, (_, i) => a0 + i).map((a) => h('g', h('line', { x1: X(`${a}-01-01`), x2: X(`${a}-01-01`), y1: 30, y2: 124, class: 'seg-l-grid' }), a <= a1 ? h('text', { x: X(`${a}-07-01`), y: 142, 'text-anchor': 'middle', class: 'seg-l-anio' }, String(a)) : null)),
    ...carriles.map(([, n, y]) => h('g', h('line', { x1: x0, x2: x1, y1: y, y2: y, class: 'seg-l-eje' }), h('text', { x: 16, y: y + 4, class: 'seg-l-nombre' }, n))),
    h('line', { x1: X(hoy()), x2: X(hoy()), y1: 24, y2: 124, class: 'seg-l-hoy' }), h('text', { x: X(hoy()), y: 18, 'text-anchor': 'middle', class: 'seg-l-anio' }, 'Hoy'),
    ...estudios.flatMap(([, e]) => (e.tipo === 'doble' ? ['veda', 'vcc'] : [e.tipo === 'rsc' ? 'vcc' : e.tipo]).map((t) => h('rect', { x: X(e.fecha) - 6, y: Y(t) - 6, width: 12, height: 12, rx: 3, class: 'seg-l-estudio' }, h('title', `${C.NOMBRE_ESTUDIO[e.tipo]} realizada el ${fecha(e.fecha)}`)))),
    ...controles.map(([, c]) => h('circle', { cx: X(C.fechaControl(c)), cy: Y(c.tipo === 'rsc' ? 'vcc' : c.tipo), r: 7, class: `seg-l-ctl seg-l-ctl--${c.estado}` }, h('title', `${C.NOMBRE_ESTUDIO[c.tipo]} · ${fecha(C.fechaControl(c))} · ${C.ESTADOS_CONTROL[c.estado].nombre}`))));
  return h('div', svg, h('div.chips', h('span.seg-ley.seg-ley--estudio', 'Estudio realizado'), h('span.seg-ley.seg-ley--prox', 'Próximo control'), h('span.seg-ley.seg-ley--proy', 'Proyectado')));
}

/* ---------- 2. Carga del estudio con sus hallazgos ---------- */

/** Desde un turno realizado de Endoscopia. */
export function abrirEstudioDesdeTurno(ctx, x) {
  const s = segDe(ctx, x.pac);
  const previo = Object.entries(s.estudios || {}).find(([, e]) => e.turno === x.id);
  if (previo) return abrirEstudio(ctx, x.pac, { id: previo[0], estudio: previo[1] });
  return abrirEstudio(ctx, x.pac, { estudio: { tipo: x.t.tipo, fecha: x.t.fecha, turno: x.id } });
}

const NUEVO_HALLAZGO = (organo) => ({ organo, tipo: C.ORGANOS[organo].parte === 'alta' ? (organo === 'esofago' ? 'barrett' : 'atrofia') : 'polipo', cantidad: 1, tamano: '', tecnica: organo === 'colon' || organo === 'recto' ? 'asa-fria' : 'biopsia', presuntivo: null });

export function abrirEstudio(ctx, pac, { id = null, estudio = {} }) {
  const fila = ctx.indice[pac] || {};
  const e = JSON.parse(JSON.stringify({ tipo: 'vcc', fecha: hoy(), calidad: { preparacion: 'adecuada' }, hallazgos: {}, ...estudio }));
  e.calidad ||= { preparacion: 'adecuada' }; e.hallazgos ||= {};
  const ant = segDe(ctx, pac).antecedentes || {};
  const lista = h('div.seg-hallazgos');
  const resultado = h('div.seg-resultado');
  const calidad = h('div');
  const partesDe = (t) => (t === 'veda' ? ['alta'] : t === 'doble' ? ['alta', 'baja'] : ['baja']);
  const organosDe = (t) => Object.entries(C.ORGANOS).filter(([, o]) => partesDe(t).includes(o.parte)).map(([k]) => k);

  const recalcular = () => {
    const ev = C.evaluarEstudio(e, { antecedentes: ant, nac: fila.nac });
    const ctl = C.controlesDeEstudio('x', e, ev, { nac: fila.nac }).filter((k) => k.orden === 0);
    resultado.replaceChildren(
      h('h3', 'Fecha que propone el motor'),
      ev.pendienteAP ? aviso('aviso', h('span', h('strong', 'Provisoria. '), 'Hay material en anatomía patológica: la fecha se confirma o corrige cuando llegue el informe.')) : aviso('ok', 'Sin biopsias pendientes: la fecha queda definitiva al guardar.'),
      ...ev.resultado.partes.map((p) => {
        const k = ctl.find((x) => x.parte === p.id);
        return h(`article.vig-parte.vig--${p.riesgo}`, h('header', h('strong', p.nombre), chip(CATEGORIAS[p.riesgo].nombre, CATEGORIAS[p.riesgo].tono)),
          h('div.vig-cuando', h('strong', k ? (k.meses === 0 ? 'Conducta inmediata' : fecha(k.fecha)) : 'Sin vigilancia programada'), k && k.meses ? h('small', textoIntervalo(k.meses)) : null),
          h('ul', ...p.items.map((x) => h('li', x.texto, x.usmstf ? h('small', ` (${x.usmstf})`) : null, h('em', ` · ${x.guia}`)))));
      }));
  };
  const pintarCalidad = () => calidad.replaceChildren(partesDe(e.tipo).includes('baja') && e.tipo !== 'rsc' ? h('div.inf-grid',
    h('div.campo', h('label', 'Preparación (Boston)'), segmentado([{ valor: 'adecuada', texto: 'Adecuada (≥ 6 y cada segmento ≥ 2)' }, { valor: 'inadecuada', texto: 'Inadecuada' }], e.calidad.preparacion, (v) => { e.calidad.preparacion = v; recalcular(); }, { pequeno: true })),
    entrada('Boston total', e.calidad.boston, (v) => { e.calidad.boston = v; }, { type: 'number', maxlength: 1 }),
    casilla('Incompleta: no se llegó al ciego', e.calidad.incompleta, (v) => { e.calidad.incompleta = v; recalcular(); })) : e.tipo === 'rsc' ? h('div.inf-grid', h('div.campo', h('label', 'Preparación'), segmentado([{ valor: 'adecuada', texto: 'Adecuada' }, { valor: 'inadecuada', texto: 'Inadecuada' }], e.calidad.preparacion, (v) => { e.calidad.preparacion = v; recalcular(); }, { pequeno: true }))) : h('p.ayuda', 'Endoscopia alta: cargá los hallazgos de esófago, estómago y duodeno.'));

  const pintar = () => {
    const ids = Object.keys(e.hallazgos);
    lista.replaceChildren(
      ...ids.map((hid, n) => filaHallazgo(e, hid, n, { organos: organosDe(e.tipo), pintar, recalcular })),
      ids.length ? null : h('p.ayuda', 'Sin hallazgos: si el estudio fue normal, guardalo así.'),
      h('div.botones', ...organosDe(e.tipo).map((o) => h('button.btn.btn--suave', { type: 'button', onclick: () => { e.hallazgos[B().nuevaClave()] = NUEVO_HALLAZGO(o); pintar(); recalcular(); } }, icono('mas', { tam: 15 }), C.ORGANOS[o].nombre))));
  };

  const m = modal({
    titulo: `${id ? 'Hallazgos del estudio' : 'Cargar estudio'} · ${fila.n || ''}`, ancho: 1080, clase: 'modal--texto',
    cuerpo: h('div.informe-endo',
      h('div.inf-form',
        tarjeta('Estudio', { icono: 'endoscopio', seccion: 'seguimiento' },
          h('div.inf-grid',
            h('div.campo', h('label', 'Tipo'), segmentado([['veda', 'VEDA'], ['vcc', 'VCC'], ['doble', 'VEDA + VCC'], ['rsc', 'Rectoscopia']].map(([v, t]) => ({ valor: v, texto: t })), e.tipo, (v) => {
              e.tipo = v;
              for (const [k, hz] of Object.entries(e.hallazgos)) if (!organosDe(v).includes(hz.organo)) delete e.hallazgos[k];
              pintarCalidad(); pintar(); recalcular();
            }, { pequeno: true })),
            entrada('Fecha del estudio', e.fecha, (v) => { e.fecha = v; recalcular(); }, { type: 'date', disabled: !!e.turno }),
            entrada('Indicación', e.indicacion, (v) => { e.indicacion = v; }, { maxlength: 200, placeholder: 'Ej.: rastreo, anemia, vigilancia' })),
          calidad),
        tarjeta('Hallazgos (uno por lesión o grupo de lesiones iguales)', { icono: 'buscar', seccion: 'seguimiento' }, lista,
          h('p.ayuda', 'El diagnóstico presuntivo da la fecha provisoria. Cada lesión con material para anatomía patológica lleva su número de frasco: así la conciliación va frasco por frasco.')),
        tarjeta('Informe', { icono: 'texto', seccion: 'seguimiento' }, h('textarea', { rows: 3, maxlength: 2000, value: e.texto || '', 'aria-label': 'Texto del informe', placeholder: 'Hallazgos y conducta (texto libre del informe)', oninput: (ev) => { e.texto = ev.target.value; } }))),
      h('aside.inf-resultado', resultado)),
    acciones: [h('button.btn.btn--suave', { type: 'button', onclick: () => m.cerrar() }, 'Cancelar'),
      h('button.btn.btn--primario', { type: 'button', onclick: async (ev) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(e.fecha || '')) { toast('Elegí la fecha del estudio', 'aviso'); return; }
        // Número de frasco automático para las lesiones con material sin número
        const usados = new Set(Object.values(e.hallazgos).map((hz) => hz.frasco).filter(Boolean));
        let n = 1;
        for (const hz of Object.values(e.hallazgos)) {
          if (!hz.frasco && C.llevaFrasco(hz)) { while (usados.has(String(n))) n++; hz.frasco = String(n); usados.add(hz.frasco); }
        }
        ev.target.disabled = true;
        try {
          const r = await S.guardarEstudio(pac, { id, estudio: e, antecedentes: ant, nac: fila.nac, seguimientoActual: segDe(ctx, pac), que: id ? 'Hallazgos corregidos: controles recalculados' : null });
          if (e.turno && ctx.alGuardarTurno) await ctx.alGuardarTurno(pac, e.turno, r).catch((er) => console.warn(er));
          m.cerrar();
          const prox = Object.values(r.nuevos).filter((k) => k.orden === 0);
          toast(prox.length ? `Guardado. Próximo control: ${prox.map((k) => `${C.NOMBRE_ESTUDIO[k.tipo]} ${k.meses === 0 ? 'inmediato' : fecha(k.fecha)}`).join(' · ')}${r.evaluacion.pendienteAP ? ' (provisorio)' : ''}` : 'Guardado. Sin vigilancia programada.', 'ok', 6000);
          M.pac = pac; ctx.render();
        } catch (er) { console.error(er); toast('No se pudo guardar el estudio', 'error'); ev.target.disabled = false; }
      } }, icono('ok', { tam: 16 }), id ? 'Guardar y recalcular' : 'Guardar y agendar')],
  });
  pintarCalidad(); pintar(); recalcular();
  return m;
}

function filaHallazgo(e, hid, n, { organos, pintar, recalcular }) {
  const hz = e.hallazgos[hid];
  const tipos = Object.entries(C.TIPOS).filter(([, t]) => t.organos.includes(hz.organo));
  if (!tipos.some(([k]) => k === hz.tipo)) hz.tipo = tipos[0][0];
  const T = C.TIPOS[hz.tipo];
  const set = (k, estructura = false) => (v) => { hz[k] = v; if (estructura) pintar(); recalcular(); };
  const extras = [];
  if (hz.tipo === 'barrett') extras.push(entrada('Praga C', hz.pragaC, set('pragaC'), { type: 'number', maxlength: 2 }, { sufijo: 'cm' }), entrada('Praga M', hz.pragaM, set('pragaM'), { type: 'number', maxlength: 2 }, { sufijo: 'cm' }));
  if (hz.tipo === 'esofagitis') extras.push(sel('Los Ángeles', [['A', 'A'], ['B', 'B'], ['C', 'C'], ['D', 'D']], hz.losAngeles || 'A', set('losAngeles')));
  if (hz.tipo === 'atrofia') extras.push(sel('Extensión', [['antro', 'Limitada al antro'], ['extensa', 'Extensa (antro y cuerpo)']], hz.extension || 'antro', set('extension')));
  const conTamano = ['polipo', 'polipo-gastrico', 'ulcera', 'sospechosa'].includes(hz.tipo);
  return h('article.seg-hz',
    h('header', h('strong', `${n + 1}. ${C.ORGANOS[hz.organo].nombre}`), hz.frasco ? chip(`Frasco ${hz.frasco}`, 'info', 'matraz') : null,
      h('button.btn-icono', { type: 'button', 'aria-label': 'Quitar hallazgo', title: 'Quitar', onclick: () => { delete e.hallazgos[hid]; pintar(); recalcular(); } }, icono('basura', { tam: 16 }))),
    h('div.seg-hz-grid',
      organos.length > 1 ? sel('Órgano', organos.map((o) => [o, C.ORGANOS[o].nombre]), hz.organo, set('organo', true)) : null,
      sel('Hallazgo', tipos.map(([k, t]) => [k, t.nombre]), hz.tipo, (v) => { hz.tipo = v; hz.presuntivo = null; pintar(); recalcular(); }),
      sel('Segmento', [['', '—'], ...(C.SEGMENTOS[hz.organo] || []).map((s) => [s, s])], hz.segmento || '', set('segmento')),
      ['polipo', 'polipo-gastrico'].includes(hz.tipo) ? entrada('Cantidad', hz.cantidad, set('cantidad'), { type: 'number', maxlength: 2 }) : null,
      conTamano ? entrada('Tamaño (el mayor)', hz.tamano, set('tamano'), { type: 'number', maxlength: 3 }, { sufijo: 'mm' }) : null,
      ['polipo', 'polipo-gastrico', 'sospechosa'].includes(hz.tipo) ? sel('Paris', [['', '—'], ...C.PARIS.map((p) => [p, p])], hz.paris || '', set('paris')) : null,
      hz.tipo !== 'esofagitis' ? sel('Técnica', C.TECNICAS, hz.tecnica || 'ninguna', set('tecnica', true)) : null,
      C.llevaFrasco(hz) ? entrada('Frasco n°', hz.frasco, (v) => { hz.frasco = v; }, { maxlength: 6, placeholder: 'auto' }) : null,
      ...extras,
      T.dx.length ? sel('Diagnóstico presuntivo', [['', 'Elegir…'], ...T.dx.map((d) => [d, C.DX[d]])], hz.presuntivo || '', set('presuntivo'), { class: 'seg-presuntivo' }) : null));
}

/* ---------- 4. Conciliación con la anatomía patológica ---------- */
export function abrirConciliacion(ctx, pac, eid) {
  const s = segDe(ctx, pac);
  const original = s.estudios?.[eid];
  if (!original) { toast('No se encontró el estudio', 'error'); return; }
  const fila = ctx.indice[pac] || {};
  const e = JSON.parse(JSON.stringify(original));
  const ant = s.antecedentes || {};
  const hallazgos = Object.entries(e.hallazgos || {}).filter(([, hz]) => hz.frasco);
  const frascos = [...new Set(hallazgos.map(([, hz]) => hz.frasco))].sort((a, b) => (+a || 0) - (+b || 0) || a.localeCompare(b));
  e.histologia ||= { frascos: {} };
  e.histologia.frascos ||= {};
  for (const f of frascos) {
    const del = hallazgos.filter(([, hz]) => hz.frasco === f).map(([, hz]) => hz);
    e.histologia.frascos[f] ||= { dx: del[0]?.presuntivo || '', tamano: '', margenes: '', olga: 0 };
  }
  const antes = Object.values(s.controles || {}).filter((k) => k.estudio === eid && k.orden === 0 && C.VIGENTES.includes(k.estado));
  const ajustes = {};
  const comparacion = h('div.seg-comparacion');
  const cuerpoFrascos = h('div.seg-frascos');

  const evaluar = () => {
    const x = { ...e, histologia: { ...e.histologia, cargada: true } };
    const ev = C.evaluarEstudio(x, { antecedentes: ant, nac: fila.nac });
    return { ev, nuevos: C.controlesDeEstudio(eid, x, ev, { nac: fila.nac }).filter((k) => k.orden === 0) };
  };
  const pintarComparacion = () => {
    const { ev, nuevos } = evaluar();
    const dif = C.diferencias(antes, nuevos);
    comparacion.replaceChildren(
      h('h3', 'Fecha definitiva'),
      ...dif.map((d) => {
        const p = ev.resultado.partes.find((x) => x.id === d.parte) || {};
        const aj = ajustes[d.parte] ||= { fecha: '', motivo: '' };
        const fNueva = d.despues ? (d.despues.meses === 0 ? 'Conducta inmediata' : fecha(d.despues.fecha)) : 'Sin vigilancia';
        return h(`article.seg-dif${d.cambia ? '.seg-dif--cambia' : ''}`,
          h('header', h('strong', p.nombre || d.parte), d.cambia ? chip('Cambia la fecha', 'aviso') : chip('Se mantiene', 'ok')),
          h('div.seg-dif-fechas', h('div', h('small', 'Provisoria'), h('strong.num', d.antes ? fecha(C.fechaControl(d.antes)) : '—')), icono('flechaDer', { tam: 18 }), h('div', h('small', 'Con la AP'), h('strong.num', fNueva))),
          d.despues ? h('p', d.despues.regla.texto) : null, d.despues ? h('small.ayuda', d.despues.regla.guia) : null,
          d.despues && d.despues.meses ? h('details.seg-ajuste', h('summary', 'Acordar otra fecha'),
            entrada('Fecha acordada', aj.fecha, (v) => { aj.fecha = v; }, { type: 'date' }), entrada('Motivo', aj.motivo, (v) => { aj.motivo = v; }, { maxlength: 300 })) : null);
      }));
  };
  const pintarFrascos = () => cuerpoFrascos.replaceChildren(...frascos.map((f) => {
    const del = hallazgos.filter(([, hz]) => hz.frasco === f).map(([, hz]) => hz);
    const fh = e.histologia.frascos[f];
    const dxs = [...new Set(del.flatMap((hz) => C.TIPOS[hz.tipo]?.dx || []))];
    const presuntivo = del[0]?.presuntivo || '';
    const difiere = fh.dx && presuntivo && fh.dx !== presuntivo;
    const conAtrofia = del.some((hz) => hz.tipo === 'atrofia');
    const set = (k) => (v) => { fh[k] = v; pintarFrascos(); pintarComparacion(); };
    return h(`article.seg-frasco${difiere ? '.seg-frasco--difiere' : ''}`,
      h('header', chip(`Frasco ${f}`, 'info', 'matraz'), difiere ? chip('Distinto de lo presumido', 'aviso') : fh.dx ? chip('Coincide', 'ok') : null),
      h('div.seg-frasco-lados',
        h('div.seg-lado', h('small', 'Endoscopia'), ...del.map((hz) => h('p', h('strong', `${C.TIPOS[hz.tipo].nombre}`), ` · ${C.ORGANOS[hz.organo].nombre}${hz.segmento ? ` (${hz.segmento})` : ''}${hz.tamano ? ` · ${hz.tamano} mm` : ''}${(hz.cantidad || 1) > 1 ? ` · ${hz.cantidad} lesiones` : ''}${hz.tecnica && hz.tecnica !== 'ninguna' ? ` · ${C.TECNICAS.find(([k]) => k === hz.tecnica)?.[1].toLowerCase()}` : ''}`, h('br'), h('small', `Presuntivo: ${C.DX[hz.presuntivo] || 'sin elegir'}`)))),
        h('div.seg-lado.seg-lado--ap', h('small', 'Anatomía patológica'),
          dxs.length ? sel('Diagnóstico histológico', [['', 'Elegir…'], ...dxs.map((d) => [d, C.DX[d]])], fh.dx || '', set('dx')) : null,
          del.some((hz) => ['polipo', 'polipo-gastrico'].includes(hz.tipo)) ? h('div.seg-hz-grid',
            entrada('Tamaño informado', fh.tamano, (v) => { fh.tamano = v; pintarComparacion(); }, { type: 'number', maxlength: 3 }, { sufijo: 'mm' }),
            sel('Márgenes', [['', '—'], ['libres', 'Libres'], ['comprometidos', 'Comprometidos'], ['no-evaluables', 'No evaluables']], fh.margenes || '', set('margenes'))) : null,
          conAtrofia ? h('div.seg-hz-grid', sel('OLGA / OLGIM', [['0', 'Sin dato'], ['1', 'I'], ['2', 'II'], ['3', 'III'], ['4', 'IV']], String(fh.olga || 0), (v) => { fh.olga = +v; pintarComparacion(); }), casilla('Metaplasia intestinal incompleta', fh.miIncompleta, set('miIncompleta'))) : null,
          casilla('H. pylori positivo', fh.hp, set('hp')),
          fh.margenes === 'comprometidos' ? aviso('aviso', 'Márgenes comprometidos: considerá un control del sitio a los 3-6 meses (ajustá la fecha abajo).') : null)));
  }));

  const datos = e.histologia;
  const m = modal({
    titulo: `Anatomía patológica · ${fila.n || ''} · ${C.NOMBRE_ESTUDIO[e.tipo]} del ${fecha(e.fecha)}`, ancho: 1080, clase: 'modal--texto',
    cuerpo: h('div.informe-endo',
      h('div.inf-form',
        tarjeta('Informe de anatomía patológica', { icono: 'matraz', seccion: 'seguimiento' },
          h('div.grid-form',
            entrada('Laboratorio', datos.laboratorio, (v) => { datos.laboratorio = v; }, { maxlength: 80 }),
            entrada('N° de protocolo', datos.protocolo, (v) => { datos.protocolo = v; }, { maxlength: 40 }),
            entrada('Fecha del informe', datos.fechaInforme, (v) => { datos.fechaInforme = v; }, { type: 'date' })),
          frascos.length ? null : aviso('aviso', 'Este estudio no tiene frascos cargados. Volvé a «Hallazgos» y marcá qué lesiones fueron a anatomía patológica.'),
          h('p.ayuda', 'El PDF del informe se puede subir en la ficha clínica, pestaña Estudios.')),
        cuerpoFrascos),
      h('aside.inf-resultado', comparacion)),
    acciones: [h('button.btn.btn--suave', { type: 'button', onclick: () => m.cerrar() }, 'Cancelar'),
      h('button.btn.btn--suave', { type: 'button', onclick: () => {
        for (const f of frascos) { const del = hallazgos.find(([, hz]) => hz.frasco === f)?.[1]; if (del?.presuntivo) e.histologia.frascos[f].dx = del.presuntivo; }
        pintarFrascos(); pintarComparacion(); toast('Cargado igual a lo presumido: revisá y firmá', 'info');
      } }, icono('okCirculo', { tam: 16 }), 'Todo coincide'),
      h('button.btn.btn--primario', { type: 'button', onclick: async (ev) => {
        const falta = frascos.filter((f) => C.TIPOS[hallazgos.find(([, hz]) => hz.frasco === f)?.[1].tipo]?.dx.length && !e.histologia.frascos[f].dx);
        if (falta.length) { toast(`Falta el diagnóstico del frasco ${falta.join(', ')}`, 'aviso'); return; }
        for (const [parte, aj] of Object.entries(ajustes)) if (aj.fecha && !aj.motivo.trim()) { toast('Escribí el motivo de la fecha acordada', 'aviso'); return; }
        e.histologia.cargada = true;
        const coincide = frascos.every((f) => e.histologia.frascos[f].dx === hallazgos.find(([, hz]) => hz.frasco === f)?.[1].presuntivo);
        ev.target.disabled = true;
        try {
          const r = await S.guardarEstudio(pac, { id: eid, estudio: e, antecedentes: ant, nac: fila.nac, ajustes, seguimientoActual: segDe(ctx, pac), que: coincide ? 'Anatomía patológica coincide con lo presumido: fecha confirmada' : 'Anatomía patológica distinta de lo presumido: fecha recalculada' });
          if (e.turno && ctx.alGuardarTurno) await ctx.alGuardarTurno(pac, e.turno, r).catch((er) => console.warn(er));
          m.cerrar(); toast('Fecha definitiva firmada', 'ok');
        } catch (er) { console.error(er); toast('No se pudo guardar', 'error'); ev.target.disabled = false; }
      } }, icono('ok', { tam: 16 }), 'Firmar fecha definitiva')],
  });
  pintarFrascos(); pintarComparacion();
  return m;
}

/* ======================= VISTA DEL PACIENTE ======================= */

/** Tarjeta para el inicio y la sección Endoscopia del paciente. */
export function tarjetaControlesPaciente(seg) {
  const controles = Object.values(seg?.controles || {}).filter((c) => C.VIGENTES.includes(c.estado)).sort((a, b) => C.fechaControl(a).localeCompare(C.fechaControl(b)));
  const esperando = Object.values(seg?.estudios || {}).filter((e) => e.estado === 'esperando-ap');
  if (!controles.length && !esperando.length) return null;
  return tarjeta('Tus próximos controles', { icono: 'calendario', seccion: 'endoscopia' },
    esperando.length ? aviso('aviso', h('span', h('strong', 'Traé el informe de anatomía patológica. '), `De tu ${C.NOMBRE_ESTUDIO[esperando[0].tipo]} del ${fecha(esperando[0].fecha)} se enviaron muestras al laboratorio. Cuando tengas el resultado, llevalo a la consulta: tu médico confirma o ajusta la fecha de tu próximo control.`)) : null,
    ...controles.map((c) => {
      const pasado = c.estado !== 'inmediato' && c.estado !== 'turno' && C.fechaControl(c) < hoy();
      return h('div.seg-pac-control',
        h('div', h('strong', C.NOMBRE_ESTUDIO[c.tipo]), h('small', c.estado === 'inmediato' ? 'Tu médico te va a indicar los pasos a seguir.' : pasado ? `Te correspondía en ${mesAnio(C.fechaControl(c)).toLowerCase()}: pedí tu turno.` : `${mesAnio(C.fechaControl(c))}${c.estado === 'provisorio' ? ' (fecha provisoria, puede cambiar con la anatomía patológica)' : ''}`)),
        c.estado === 'inmediato' ? chip('Consultá a tu médico', 'peligro') : pasado ? chip('Pendiente', 'aviso') : chip(c.estado === 'turno' ? 'Con turno' : c.estado === 'provisorio' ? 'Provisorio' : 'Confirmado', c.estado === 'provisorio' ? 'aviso' : 'ok'));
    }),
    h('p.ayuda', 'Te vamos a avisar por correo un mes antes. Es una orientación según las guías; la indicación final es la de tu médico.'));
}
