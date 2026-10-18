/* ============================================================
   Turnos de endoscopia digestiva — pantallas
   Paciente: 1 Datos → 2 Prequirúrgico (o órdenes firmadas si falta
   algo) → 3 Turno (fechas abiertas por el médico) → 4 Consentimiento
   y preparación con firma → ticket tipo pase de embarque con QR.
   Médico: turnos por día, agenda, admisión con QR y configuración.
   Estado público: quien tiene el código o el QR ve si el turno está
   confirmado, suspendido o reprogramado (sin nombre ni DNI).
   ============================================================ */

import { h, montar } from '../core/dom.js';
import { icono } from '../core/iconos.js';
import { heroe, tarjeta, chip, aviso, toast, modal, confirmar, fecha, fechaHora, vacio, estiloSeccion, hoyISO, cargando } from '../core/ui.js';
import { campo, segmentado, fichas } from '../ui/campos.js';
import { CONFIG } from '../config.js';
import * as E from '../engine/endoscopia.js';
import { clasesDe } from '../engine/meds.js';
import { edad as calcEdad } from '../engine/anthro.js';
import { backend } from '../data/servicio.js';
import * as D from '../data/endoscopia.js';
import { qrSVG, qrPNG, puedeEscanear, lectorQR, leerQRImagen } from '../ui/qr.js';
import { panelFirma } from '../ui/firma.js';
import { logo } from './shell.js';
import * as V from '../engine/vigilancia.js';
import { abrirEstudioDesdeTurno, tarjetaControlesPaciente } from './seguimiento.js';

const B = () => backend();
const urlTurno = (codigo) => `${location.origin}${location.pathname}?turno=${encodeURIComponent(codigo)}`;
const descargar = (nombre, texto, tipo) => { const a = h('a', { href: URL.createObjectURL(new Blob([texto], { type: tipo })), download: nombre }); document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };

/* ======================= TICKET (pase de embarque) ======================= */

export function ticket(t, { config, paciente, chico = false } = {}) {
  const e = E.ESTUDIOS[t.tipo];
  const est = E.estadoVisible(t);
  const info = E.ESTADOS[est];
  const cfg = D.configCompleta(config);
  const dato = (k, v, clase = '') => h(`div.tk-dato${clase}`, h('small', k), h('strong', v));
  const dt = new Date(`${t.fecha}T12:00:00`);
  const fechaTk = `${dt.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '')} ${dt.getDate()} ${dt.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')}`.toUpperCase();
  return h(`article.ticket${chico ? '.ticket--chico' : ''}.ticket--${est}`, { style: { '--c1': e.c1, '--c2': e.c2 }, 'aria-label': `Ticket del turno ${t.codigo}` },
    h('div.tk-cuerpo',
      h('header.tk-cab', h('span.tk-marca', icono('endoscopio', { tam: 18 }), `${CONFIG.app} · Endoscopia`), h('span.tk-pase', 'PASE DE INGRESO')),
      h('div.tk-ruta',
        h('div', h('small', 'Desde'), h('strong.tk-sigla', 'ADM'), h('span', 'Admisión')),
        h('div.tk-vuelo', h('span.tk-linea'), icono('endoscopio', { tam: 22 }), h('span.tk-linea')),
        h('div', h('small', 'Hacia'), h('strong.tk-sigla', e.corto.replace(' + ', '+')), h('span', 'Sala de endoscopia'))),
      h('div.tk-grilla',
        dato('Paciente', paciente || t.paciente?.n || '—', '.tk-dato--ancho'),
        dato('Estudio', e.nombre, '.tk-dato--ancho'),
        dato('Fecha', fechaTk),
        dato('Hora', E.hora(t.hora)),
        dato('Presentarse', E.hora(E.deMin(E.aMin(t.hora) - 30))),
        dato('Turno', e.simple ? 'Simple' : 'Doble')),
      h('div.tk-lugar', icono('inicio', { tam: 14 }), `${cfg.lugar.nombre}${cfg.lugar.direccion ? ' · ' + cfg.lugar.direccion : ''}`)),
    h('div.tk-corte', { 'aria-hidden': 'true' }),
    h('div.tk-talon',
      qrSVG(urlTurno(t.codigo), { tam: chico ? 96 : 132 }),
      h('strong.tk-codigo.num', t.codigo),
      h(`span.tk-estado.tk-estado--${info.tono}`, info.nombre),
      h('small', 'Mostralo en Admisión y en Egresos')));
}

/* ======================= DOCUMENTOS ======================= */

function bloqueDocs(docs, ia) {
  return h('div.endo-docs',
    tarjeta('Tu estudio en pocas palabras', { icono: 'info', seccion: 'endoscopia' }, h('ul.lista-check', ...docs.resumen.map((t) => h('li', icono('ok', { tam: 15 }), t)))),
    ia ? tarjeta('Explicado para vos', { icono: 'chispa', seccion: 'endoscopia', extra: chip('Generado con IA', 'info', 'chispa') },
      h('p', ia.resumen), ia.claves?.length ? h('ul.lista-check', ...ia.claves.map((t) => h('li', icono('ok', { tam: 15 }), t))) : null,
      h('p.ayuda', 'Texto de apoyo generado por IA a partir de tus respuestas, sin tu nombre ni DNI. Ante cualquier diferencia, vale lo que indique tu médico.')) : null,
    tarjeta('Preparación paso a paso', { icono: 'calendario', seccion: 'endoscopia' },
      h('ol.linea-tiempo', ...docs.pasos.map((p) => h('li', h('strong', p.cuando), h('ul', ...p.que.map((q) => h('li', q))))))),
    tarjeta('Recomendaciones médicas', { icono: 'escudo', seccion: 'endoscopia' },
      h('div.recos', ...docs.recomendaciones.map((r) => h(`div.reco.reco--${r.tono}`, h('strong', r.titulo), h('p', r.texto)))),
      h('details.fuentes', h('summary', 'Guías en las que se basa'), h('ul', ...docs.fuentes.map((f) => h('li', f))))));
}

/** Huella y sello del consentimiento, con botón para verificar que no se alteró. */
function selloConsentimiento(t) {
  const c = t.consentimiento;
  if (!c?.huella) return null;
  const res = h('span.sello-res');
  const btn = h('button.btn.btn--suave', { type: 'button', onclick: async () => {
    btn.disabled = true; res.replaceChildren(h('span', 'Verificando…'));
    const r = await D.verificarConsentimiento(t);
    res.replaceChildren(r.estado === 'integro' ? chip(r.sello ? 'Íntegro: coincide con el sello del servidor' : 'Íntegro: no fue modificado', 'ok', 'okCirculo') : chip('ALTERADO: el texto o la firma no coinciden con la huella', 'peligro', 'alerta'));
    btn.disabled = false;
  } }, icono('huella', { tam: 15 }), 'Verificar integridad');
  return h('div.sello',
    h('div.sello-cab', icono('escudo', { tam: 18 }), h('strong', 'Firmado electrónicamente con huella digital')),
    h('dl',
      h('div', h('dt', 'Fecha y hora (servidor)'), h('dd', fechaHora(c.fecha))),
      h('div', h('dt', 'Firmó'), h('dd', `${c.aclaracion || '—'}${c.metodo ? ` · ${c.metodo === 'teclado' ? 'firma escrita con el teclado' : 'firma manuscrita (dedo, lápiz o mouse)'}` : ''}`)),
      h('div', h('dt', `Huella ${c.algoritmo || 'SHA-256'}`), h('dd.num.sello-hash', c.huella))),
    h('div.botones', btn, res));
}

function textoConsentimiento(docs) {
  return h('div.consentimiento-texto', ...docs.consentimiento.map(([t, p]) => h('section', h('h4', t), h('p', p))));
}

/** Correo del turno: en producción lo manda el servidor; en la demo se muestra. */
/** Arma las secciones de texto que recibe el paciente (correo, PDF y Word). */
function seccionesDe({ docs, ordenes, t }) {
  const secciones = [];
  if (docs) {
    secciones.push(['Tu estudio', docs.resumen]);
    docs.pasos.forEach((p) => secciones.push([`Preparación · ${p.cuando}`, p.que]));
    secciones.push(['Recomendaciones', docs.recomendaciones.map((r) => `${r.titulo}: ${r.texto}`)]);
    secciones.push(['Consentimiento informado (firmado en la app)', [...docs.consentimiento.map(([a, b]) => `${a}: ${b}`), ...(t?.consentimiento?.huella ? [`Huella digital SHA-256 del consentimiento firmado: ${t.consentimiento.huella}`] : [])]]);
  }
  if (ordenes) ordenes.forEach((o) => secciones.push([`Orden: ${o.titulo}`, [...o.rp.map((x) => `Rp/ ${x}`), `Diagnóstico: ${o.dx}`]]));
  return secciones;
}

/**
 * Prepara el correo al paciente. Si el médico pidió revisar los envíos (Configuración), queda en
 * Endoscopia → Envíos para verlo en PDF o Word, editarlo y aprobarlo; si no, sale directo.
 */
async function mandarCorreo({ tipo, uid, t, id, docs, ordenes, paciente, config, email, directo = false }) {
  const secciones = seccionesDe({ docs, ordenes, t });
  const cfg = D.configCompleta(config);
  const datos = {
    tipo, pac: uid, turno: id || null, codigo: t?.codigo || null, secciones,
    ticket: t ? { estudio: E.ESTUDIOS[t.tipo].nombre, fecha: E.fechaLarga(t.fecha), hora: E.hora(t.hora), presentarse: E.hora(E.deMin(E.aMin(t.hora) - 30)), lugar: `${cfg.lugar.nombre}${cfg.lugar.direccion ? ', ' + cfg.lugar.direccion : ''}`, estado: E.ESTADOS[E.estadoVisible(t)].nombre, url: urlTurno(t.codigo), paciente } : null,
    qr: t ? await qrPNG(urlTurno(t.codigo)).catch(() => null) : null,
    medico: ordenes ? { nombre: cfg.medico.nombre, matricula: cfg.medico.matricula } : null,
  };
  if (cfg.revisarEnvios !== false && ['turno', 'ordenes', 'reprogramado'].includes(tipo) && !directo) {
    try { await D.encolarEnvio({ ...datos, paciente: paciente || null, email: email || null }); }
    catch (e) { console.warn(e); toast('No se pudo preparar el envío', 'error'); return { error: true }; }
    toast(B().usuario()?.paciente ? 'Tu médico revisa la documentación y te la manda por correo.' : 'Quedó en Endoscopia → Envíos para que lo revises y lo apruebes.', 'info', 6000);
    return { enCola: true };
  }
  const r = await D.enviarCorreo(datos).catch((e) => { console.warn(e); return { error: true }; });
  if (r?.demo) buzonDemo({ tipo, t, secciones, paciente, config, email });
  else if (r?.error) toast('No se pudo enviar el correo ahora. Lo podés reenviar desde tu turno.', 'error', 6000);
  else toast('Te lo mandamos a tu correo', 'ok');
  return r;
}

/* ======================= DOCUMENTO PARA REVISAR (PDF y Word) ======================= */
const TIT_ENVIO = { turno: 'Confirmación del turno, preparación y consentimiento', ordenes: 'Órdenes del prequirúrgico', reprogramado: 'Turno reprogramado: preparación y consentimiento', recordatorio: 'Recordatorio 48 h antes', espera: 'Aviso de lugar libre (lista de espera)' };
const ICONO_SEC = (t) => (/^Tu estudio/.test(t) ? '🩺' : /^Preparación/.test(t) ? '🥤' : /^Recomendaciones/.test(t) ? '⭐' : /^Consentimiento/.test(t) ? '✍️' : /^Orden/.test(t) ? '📋' : '📌');

/** Hoja A4 prolija con lo que va a recibir el paciente (sirve para imprimir o guardar en PDF). */
function hojaEnvio(envio, { t, config }) {
  const cfg = D.configCompleta(config);
  return h('div.doc-envio',
    h('header.doc-cab',
      h('div.doc-marca', h('img', { src: 'icons/logo-256.png', alt: '' }), h('div', h('strong', CONFIG.app.toUpperCase()), h('small', 'Endoscopia digestiva'))),
      h('div.doc-tit', h('h1', TIT_ENVIO[envio.tipo] || 'Documento para el paciente'), h('p', `${envio.paciente || 'Paciente'}${envio.codigo ? ` · Turno ${envio.codigo}` : ''}`)),
      h('div.doc-fecha', new Date(B().ahora()).toLocaleDateString('es-AR'))),
    envio.estado === 'pendiente' ? h('p.doc-borrador', 'BORRADOR PARA REVISIÓN DEL MÉDICO — todavía no se envió al paciente') : null,
    t ? ticket(t, { config, paciente: envio.paciente }) : null,
    ...(envio.secciones || []).map(([tit, lineas], i) => h(`section.doc-sec.doc-sec--${i % 5}`,
      h('h2', h('span.doc-ico', ICONO_SEC(tit)), tit),
      h('ul', ...(lineas || []).map((x) => h('li', x))))),
    h('footer.doc-pie', h('span', `${cfg.medico.nombre || 'Médico/a actuante'}${cfg.medico.matricula ? ' · ' + cfg.medico.matricula : ''}`), h('span', `${cfg.lugar.nombre}${cfg.lugar.direccion ? ' · ' + cfg.lugar.direccion : ''}`), h('span', 'Emergencias: 107')));
}

const escH = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** El mismo documento en Word (.doc): se abre y se edita en Microsoft Word, Pages o Google Docs. */
function wordEnvio(envio, { config }) {
  const cfg = D.configCompleta(config);
  const colores = ['#0891b2', '#ea580c', '#7c3aed', '#be185d', '#475569'];
  const tk = envio.ticket;
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${escH(TIT_ENVIO[envio.tipo])}</title>
<style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1f2937} h1{color:#be185d;font-size:18pt;margin:0} h2{font-size:13pt;margin:16pt 0 4pt;padding:4pt 8pt;color:#fff} li{margin:2pt 0} .cab{border-bottom:3pt solid #be185d;padding-bottom:6pt;margin-bottom:10pt} .tk{border:2pt dashed #be185d;padding:8pt;margin:8pt 0;background:#fdf2f8} .pie{margin-top:18pt;border-top:1pt solid #cbd5e1;padding-top:6pt;color:#64748b;font-size:9pt}</style></head><body>
<div class="cab"><b style="color:#4283aa;letter-spacing:2pt">${escH(CONFIG.app.toUpperCase())} · ENDOSCOPIA DIGESTIVA</b><h1>${escH(TIT_ENVIO[envio.tipo] || 'Documento para el paciente')}</h1><p>${escH(envio.paciente || 'Paciente')}${envio.codigo ? ' · Turno <b>' + escH(envio.codigo) + '</b>' : ''} · ${new Date(B().ahora()).toLocaleDateString('es-AR')}</p></div>
${tk ? `<div class="tk"><b>${escH(tk.estudio)}</b><br>Fecha: <b>${escH(tk.fecha)}</b> · Hora: <b>${escH(tk.hora)} h</b> · Presentarse: <b>${escH(tk.presentarse)} h</b><br>Lugar: ${escH(tk.lugar)}<br>Código del turno: <b>${escH(envio.codigo)}</b></div>` : ''}
${(envio.secciones || []).map(([tit, l], i) => `<h2 style="background:${colores[i % 5]}">${escH(tit)}</h2><ul>${(l || []).map((x) => `<li>${escH(x)}</li>`).join('')}</ul>`).join('\n')}
<p class="pie">${escH(cfg.medico.nombre || '')} ${escH(cfg.medico.matricula || '')} · ${escH(cfg.lugar.nombre)} ${escH(cfg.lugar.direccion || '')} · Emergencias: 107</p></body></html>`;
  descargar(`${(envio.paciente || 'paciente').replace(/[^\wáéíóúñ ,.-]/gi, '')} - ${TIT_ENVIO[envio.tipo] || 'documento'}.doc`, '\ufeff' + html, 'application/msword');
}

function buzonDemo({ tipo, t, secciones, paciente, config, email }) {
  const asunto = { turno: `Tu turno ${t?.codigo} está confirmado`, ordenes: 'Tus órdenes para el prequirúrgico', reprogramado: `Tu turno ${t?.codigo} se reprogramó`, recordatorio: `Recordatorio: tu estudio es el ${t ? E.fechaCorta(t.fecha) : ''} a las ${t ? E.hora(t.hora) : ''}`, espera: 'Se liberó un lugar para tu estudio' }[tipo] || 'Metria';
  const m = modal({
    titulo: 'Correo de prueba', ancho: 640, clase: 'modal--texto',
    cuerpo: h('div.correo-demo',
      aviso('info', 'En la demo no se envían correos: así le llega al paciente.'),
      h('div.correo-cab', h('span', h('strong', 'Para: '), email || 'paciente'), h('span', h('strong', 'Asunto: '), asunto)),
      t ? ticket(t, { config, paciente, chico: true }) : null,
      ...secciones.map(([ti, l]) => h('section', h('h4', ti), h('ul', ...l.map((x) => h('li', x)))))),
    acciones: [h('button.btn.btn--primario', { type: 'button', onclick: () => m.cerrar() }, 'Cerrar')],
  });
}

/* ======================= IMPRESIÓN ======================= */

function imprimir(doc, nombre) {
  document.getElementById('informe-impresion')?.remove();
  doc.id = 'informe-impresion';
  document.body.appendChild(doc);
  document.documentElement.classList.add('imprimiendo');
  const titulo = document.title;
  document.title = nombre;
  const fin = () => { document.documentElement.classList.remove('imprimiendo'); doc.remove(); document.title = titulo; window.removeEventListener('afterprint', fin); };
  window.addEventListener('afterprint', fin);
  setTimeout(() => { try { window.print(); } catch { fin(); } }, 400); // deja que se dibuje el QR
}

function hojaOrdenes(ords, { perfil, datos, config }) {
  const cfg = D.configCompleta(config);
  const hoy = new Date(B().ahora()).toLocaleDateString('es-AR');
  return h('div.ordenes-impresion', ...ords.map((o, i) => h('section.orden-hoja',
    h('header.orden-cab', h('div', h('strong', cfg.lugar.nombre), h('small', cfg.lugar.direccion || '')), h('div.orden-n', `Orden ${i + 1}/${ords.length}`, h('small', hoy))),
    h('dl.orden-pac',
      h('div', h('dt', 'Paciente'), h('dd', `${perfil.apellido}, ${perfil.nombre}`)),
      h('div', h('dt', 'DNI'), h('dd', Number(perfil.dni).toLocaleString('es-AR'))),
      h('div', h('dt', 'Cobertura'), h('dd', `${datos.cobertura || 'Particular'}${datos.afiliado ? ' · N.º ' + datos.afiliado : ''}`)),
      h('div', h('dt', 'Fecha'), h('dd', hoy))),
    h('h2.orden-tit', o.titulo),
    h('div.orden-rp', h('span.orden-rp-sig', 'Rp/'), h('ul', ...o.rp.map((x) => h('li', x)))),
    h('p.orden-dx', h('strong', 'Diagnóstico / motivo: '), o.dx),
    h('div.orden-firma', cfg.medico.firma ? h('img', { src: cfg.medico.firma, alt: 'Firma del médico' }) : h('span.orden-sin-firma'),
      h('strong', cfg.medico.nombre || 'Médico/a actuante'), h('small', [cfg.medico.especialidad, cfg.medico.matricula].filter(Boolean).join(' · '))),
    h('p.orden-legal', `Orden generada por ${CONFIG.app} a pedido del paciente con la firma autorizada del médico actuante. Consultá con tu cobertura si acepta órdenes digitales; si no, pedí la orden en papel en el consultorio.`))));
}

function hojaTurno(t, { docs, paciente, config }) {
  return h('div.turno-impresion', ticket(t, { config, paciente }),
    h('section', h('h3', 'Preparación'), ...docs.pasos.map((p) => h('div', h('strong', p.cuando), h('ul', ...p.que.map((q) => h('li', q)))))),
    h('section', h('h3', 'Recomendaciones'), h('ul', ...docs.recomendaciones.map((r) => h('li', h('strong', `${r.titulo}: `), r.texto)))),
    h('section', h('h3', 'Consentimiento informado'), textoConsentimiento(docs),
      t.consentimiento?.firma ? h('div.orden-firma', h('img', { src: t.consentimiento.firma, alt: 'Firma del paciente' }), h('strong', t.consentimiento.aclaracion || paciente), h('small', `Firmado en la app el ${fechaHora(t.consentimiento.fecha)}`)) : null,
      t.consentimiento?.huella ? h('p.orden-legal', `Huella SHA-256 del consentimiento firmado: ${t.consentimiento.huella}. Sirve para comprobar que el texto y la firma no se modificaron.`) : null));
}

/* ======================= PACIENTE ======================= */

const W = { uid: null }; // borrador del asistente (sobrevive a las actualizaciones en vivo)
/** Al volver a la sección desde otra, el ticket recién sacado deja lugar a «Mis turnos». */
export function alEntrarEndo() { if (W.paso === 'ticket') W.paso = null; }

function prellenar(perfil, pac) {
  const cl = pac.clinica || {};
  const cls = clasesDe(cl.meds || []);
  const prev = pac.endo?.datos || {};
  const ant = { ...(prev.antecedentes || {}) };
  if (!pac.endo?.datos) {
    if (cls.has('avk') || cls.has('doac')) ant.anticoagulante = true;
    if (cls.has('antiagregante')) ant.antiagregante = true;
    if (cls.has('insulina')) ant.insulina = true;
    if (['sulfonilurea', 'metformina', 'dpp4', 'sglt2', 'meglitinida', 'pioglitazona'].some((c) => cls.has(c))) ant.antidiabeticos = true;
    if (cls.has('glp1') || pac.plan?.estado === 'activo') ant.glp1 = true;
    if (cl.patologias?.erc) ant.renal = true;
    if (cl.patologias?.sahos) ant.apnea = true;
  }
  return {
    cobertura: '', afiliado: '', acompNombre: '', acompTel: '', motivo: '', motivoTexto: '', derivante: '', alergias: '', medicacion: (cl.meds || []).map((m) => m.nombre).join(', '),
    ...prev, telefono: prev.telefono || perfil.telefono || '', peso: prev.peso || cl.antropo?.peso || '', talla: prev.talla || cl.antropo?.talla || '', antecedentes: ant,
  };
}

/**
 * Sección «Endoscopia» del paciente.
 * ctx: { uid, perfil, pac, turnos, config, agenda, ocupacion, render }
 */
export function vistaEndoPaciente(ctx) {
  const { uid, perfil, pac } = ctx;
  if (W.uid !== uid) Object.assign(W, { uid, paso: null, d: null, pre: null, tipo: null, fecha: null, libre: null, ia: undefined, ultimo: null });
  W.d ||= prellenar(perfil, pac);
  W.pre ||= JSON.parse(JSON.stringify(pac.endo?.pre || {}));
  const cfg = D.configCompleta(ctx.config);
  const activos = Object.entries(ctx.turnos || {}).filter(([, t]) => E.turnoActivo(t)).sort((a, b) => a[1].fecha.localeCompare(b[1].fecha));
  const conInforme = Object.values(ctx.turnos || {}).some((t) => t.informe?.resultado);
  if (!W.paso) W.paso = activos.length || conInforme ? 'mis' : 'inicio';
  // Se suelta el foco del campo de texto: si no, la pantalla espera a que el usuario salga del campo (Safari / iPhone)
  const ir = (p) => { document.activeElement?.blur?.(); W.paso = p; ctx.render(); window.scrollTo(0, 0); };

  const cab0 = heroe('endoscopia', 'Turnos de endoscopia', 'Pedí tu turno de endoscopia alta, baja o ambas en 4 pasos, desde el teléfono, la tablet o la computadora.');
  const cab = ['docs', 'ticket'].includes(W.paso) ? cab0 : h('div.endo-cab', cab0, bloqueEspera(ctx, ir, cfg));
  switch (W.paso) {
    case 'datos': return h('div.seccion', cab, pasosEndo(0), pasoDatos(ctx, ir));
    case 'pre': return h('div.seccion', cab, pasosEndo(1), pasoPre(ctx, ir, cfg));
    case 'ordenes': return h('div.seccion', cab, pasosEndo(1), pasoOrdenes(ctx, ir, cfg));
    case 'turno': return h('div.seccion', cab, pasosEndo(2), pasoTurno(ctx, ir, cfg));
    case 'docs': return h('div.seccion', cab, pasosEndo(3), pasoDocs(ctx, ir, cfg));
    case 'ticket': return h('div.seccion', pasoTicket(ctx, ir, cfg));
    case 'mis': if (activos.length || conInforme) return h('div.seccion', cab, misTurnos(ctx, ir, cfg, activos));
    // fall through
    default: return h('div.seccion', cab, portadaEndo(ctx, ir, cfg, activos));
  }
}

/* ---------- Lista de espera (paciente) ---------- */
function bloqueEspera(ctx, ir, cfg) {
  const e = ctx.espera;
  if (!e) return null;
  const ahora = B().ahora();
  const o = e.oferta && e.oferta.vence > ahora ? e.oferta : null;
  const libre = o && E.horariosLibres(ctx.agenda?.[o.fecha], ctx.ocupacion?.[o.fecha], o.tipo, { ahora, fecha: o.fecha }).find((l) => l.hora === o.hora);
  if (o && libre) {
    const est = E.ESTUDIOS[o.tipo];
    return h('section.oferta', { style: { '--c1': est.c1, '--c2': est.c2 } },
      h('span.oferta-ico.latido', icono('campana', { tam: 26 })),
      h('div', h('small', 'LISTA DE ESPERA · SE LIBERÓ UN LUGAR'), h('h2', `${E.fechaLarga(o.fecha)} · ${E.hora(o.hora)} h`),
        h('p', `${est.nombre}. Te lo ofrecemos primero a vos hasta el ${fechaHora(o.vence)}.${e.turno && ctx.turnos?.[e.turno] && E.turnoActivo(ctx.turnos[e.turno]) ? ' Si lo tomás, tu turno anterior se cancela solo.' : ''}`)),
      h('div.botones',
        h('button.btn.btn--vidrio.btn--grande', { type: 'button', onclick: () => {
          const ev = E.evaluarPrequirurgico(ctx.pac.endo?.pre, ahora, cfg.validez);
          Object.assign(W, { tipo: o.tipo, fecha: o.fecha, libre, enEspera: true, reemplaza: e.turno && ctx.turnos?.[e.turno] ? { id: e.turno, t: ctx.turnos[e.turno] } : null, ia: undefined });
          ir(ev.completo ? 'docs' : 'pre');
          if (!ev.completo) toast('Antes de tomar el lugar, actualizá tu prequirúrgico.', 'info', 5000);
        } }, icono('ok', { tam: 18 }), 'Tomar este lugar'),
        h('button.btn-link.oferta-no', { type: 'button', onclick: async () => { await D.rechazarOferta(ctx.uid, e); toast('Listo: seguís en la lista para el próximo lugar', 'ok'); } }, 'No me sirve')));
  }
  return h('div.espera-bloque', h('div.espera-estado', icono('reloj', { tam: 18 }),
    h('span', h('strong', 'Estás en la lista de espera '), `para ${E.ESTUDIOS[e.tipo]?.corto || 'tu estudio'}${e.antesDe ? `, para adelantar tu turno del ${E.fechaCorta(e.antesDe)}` : ''}. Si se libera un lugar te avisamos por correo y lo ves acá.`),
    h('button.btn-link', { type: 'button', onclick: async () => { await D.salirEspera(ctx.uid, e); toast('Saliste de la lista de espera', 'ok'); } }, 'Salir de la lista')),
    listaAnonima(ctx));
}

/** Lista de espera tal como la ve el paciente: sin nombres, solo el puesto y desde cuándo espera cada uno. */
function listaAnonima(ctx) {
  const e = ctx.espera;
  const lista = Object.entries(ctx.esperaAnon || {}).filter(([, x]) => x.tipo === e.tipo).sort((a, b) => (a[1].creado || 0) - (b[1].creado || 0));
  if (!lista.length) return null;
  const pos = lista.findIndex(([id]) => id === e.anon) + 1;
  return h('div.espera-anon',
    h('strong', pos ? `Estás en el puesto ${pos} de ${lista.length} para ${E.ESTUDIOS[e.tipo].corto}` : `Lista de espera de ${E.ESTUDIOS[e.tipo].corto}`),
    h('ol', ...lista.map(([id, x], i) => h(`li${id === e.anon ? '.yo' : ''}`, h('span.num', `${i + 1}`), h('span', id === e.anon ? 'Vos' : 'Paciente en espera'), h('small', `desde ${fecha(x.creado)}`)))),
    h('small.ayuda', 'Por privacidad no se muestran nombres. Cuando se libera un lugar, se le ofrece primero al puesto 1.'));
}

async function anotarme(ctx, datos) {
  try { await D.anotarEspera(ctx.uid, datos, ctx.espera); toast('Te anotamos en la lista de espera: si se libera un lugar, te avisamos por correo', 'ok', 6000); }
  catch (e) { console.error(e); toast('No se pudo anotar en la lista de espera', 'error'); }
}

function pasosEndo(actual) {
  const items = ['Tus datos', 'Prequirúrgico', 'Turno', 'Consentimiento'];
  return h('ol.pasos-alta.pasos-endo', { style: estiloSeccion('endoscopia') }, ...items.map((t, i) => h(`li${i < actual ? '.hecho' : i === actual ? '.actual' : ''}`, h('span', i < actual ? icono('ok', { tam: 14 }) : String(i + 1)), h('em', t))));
}

function portadaEndo(ctx, ir, cfg, activos) {
  const ev = E.evaluarPrequirurgico(ctx.pac.endo?.pre, B().ahora(), cfg.validez);
  const hayFechas = E.fechasAbiertas(ctx.agenda, { ahora: B().ahora() }).length;
  const paso = (n, ic, t, d) => h('li.endo-paso', h('span.endo-paso-n', icono(ic, { tam: 20 })), h('div', h('strong', `${n}. ${t}`), h('p', d)));
  const ordenes = ctx.pac.endo?.ordenes;
  return h('div.endo-portada',
    ordenes && !ev.completo ? aviso('aviso', h('span', h('strong', 'Bienvenido/a de nuevo. '), `El ${fecha(ordenes.fecha)} te dimos las órdenes del prequirúrgico. Cuando tengas los resultados, cargá las fechas y elegí tu turno.`)) : null,
    h('section.endo-hero', { style: estiloSeccion('endoscopia') },
      h('div.endo-hero-txt',
        h('h2', 'Tu turno, sin filas ni llamados'),
        h('p', 'Te pedimos tus datos, revisamos el prequirúrgico, elegís el día y te llega por correo un ticket con QR para presentar en Admisión.'),
        h('div.botones',
          h('button.btn.btn--primario.btn--grande.btn--brillo', { type: 'button', onclick: () => ir('datos') }, icono('calendario', { tam: 18 }), 'Solicitar turno'),
          activos.length ? h('button.btn.btn--vidrio.btn--grande', { type: 'button', onclick: () => ir('mis') }, icono('ticket', { tam: 18 }), 'Mis turnos') : null)),
      h('div.endo-hero-ticket', { 'aria-hidden': 'true' }, h('div.mini-pase', h('span'), h('i'), h('b', 'MTR-····-····')))),
    h('ol.endo-pasos', paso(1, 'datos', 'Tus datos', 'Cobertura, acompañante, motivo y antecedentes.'),
      paso(2, 'matraz', 'Prequirúrgico', 'Laboratorio, ECG con lectura cardiológica y valoración anestesiológica. Si te falta algo, te damos la orden firmada.'),
      paso(3, 'calendario', 'Turno', 'Simple (alta o baja) o doble (ambas), en las fechas que abrió el médico.'),
      paso(4, 'editar', 'Consentimiento', 'Lo leés, firmás con el dedo y recibís la preparación y el ticket.')),
    hayFechas ? null : aviso('info', 'Por ahora no hay fechas abiertas. Podés adelantar los pasos 1 y 2: cuando el médico abra fechas, vas a poder elegir.'));
}

/* ---------- Paso 1: datos ---------- */
function pasoDatos(ctx, ir) {
  const d = W.d;
  const err = h('div.form-error', { role: 'alert' });
  const f = (etq, k, props = {}, extra = {}) => {
    const c = campo(etq, { ...props, name: k, value: d[k] ?? '' }, extra);
    c.querySelector('input,select').addEventListener('input', (e) => { d[k] = e.target.value; });
    c.querySelector('select')?.addEventListener('change', (e) => { d[k] = e.target.value; });
    return c;
  };
  const motivo = h('div.campo.campo--ancho', h('label', 'Motivo del estudio', h('span.req', ' *')),
    segmentado(E.MOTIVOS.map(([valor, texto]) => ({ valor, texto })), d.motivo, (v) => { d.motivo = v; }, { etiqueta: 'Motivo', pequeno: true }));
  const ant = h('div.campo.campo--ancho', h('label', 'Marcá lo que corresponda'),
    fichas(E.ANTECEDENTES.map(([k, t]) => [k, t, ['anticoagulante', 'antiagregante', 'embarazo', 'glp1'].includes(k)]), d.antecedentes, (k, on) => { d.antecedentes[k] = on; }),
    Object.keys(d.antecedentes).some((k) => d.antecedentes[k]) && !ctx.pac.endo?.datos ? h('small.ayuda', 'Marcamos algunas opciones a partir de tu ficha de Metria: revisalas.') : null);
  const btn = h('button.btn.btn--primario.btn--grande', { type: 'submit' }, 'Continuar', icono('flechaDer', { tam: 18 }));
  const form = h('form.endo-form', { novalidate: true },
    tarjeta('Cobertura y contacto', { icono: 'usuario', seccion: 'endoscopia' }, h('div.grid-form',
      f('Obra social o prepaga', 'cobertura', { maxlength: 80, placeholder: 'Particular si no tenés' }, { requerido: true }),
      f('N.º de afiliado', 'afiliado', { maxlength: 40 }),
      f('Tu teléfono', 'telefono', { type: 'tel', autocomplete: 'tel', maxlength: 25 }, { requerido: true }),
      f('Médico que te lo indicó', 'derivante', { maxlength: 80 }, { ayuda: 'Opcional' }))),
    tarjeta('Acompañante', { icono: 'usuarios', seccion: 'endoscopia' },
      aviso('info', 'Es obligatorio: después de la sedación no podés irte solo/a ni manejar.'),
      h('div.grid-form', f('Nombre y apellido', 'acompNombre', { maxlength: 80 }, { requerido: true }), f('Teléfono', 'acompTel', { type: 'tel', maxlength: 25 }, { requerido: true }))),
    tarjeta('Motivo y salud', { icono: 'corazon', seccion: 'endoscopia' }, h('div.grid-form',
      motivo,
      h('div.campo.campo--ancho', h('label', { for: 'endo-mot' }, 'Contanos brevemente (opcional)'), h('textarea#endo-mot', { rows: 2, maxlength: 300, value: d.motivoTexto || '', oninput: (e) => { d.motivoTexto = e.target.value; } })),
      f('Peso', 'peso', { type: 'number', maxlength: 5 }, { sufijo: 'kg' }), f('Talla', 'talla', { type: 'number', maxlength: 3 }, { sufijo: 'cm' }),
      ant,
      h('div.campo.campo--ancho', h('label', { for: 'endo-med' }, 'Medicación que tomás'), h('textarea#endo-med', { rows: 2, maxlength: 300, value: d.medicacion || '', oninput: (e) => { d.medicacion = e.target.value; } })),
      f('Alergias', 'alergias', { maxlength: 200, placeholder: 'Ninguna' }))),
    err, h('div.botones.endo-nav', h('button.btn.btn--suave', { type: 'button', onclick: () => ir('inicio') }, 'Volver'), btn));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const p = [
      !d.cobertura?.trim() ? 'Indicá tu obra social o prepaga (o «Particular»).' : null,
      String(d.telefono || '').replace(/\D/g, '').length < 8 ? 'Revisá tu teléfono.' : null,
      !d.acompNombre?.trim() || String(d.acompTel || '').replace(/\D/g, '').length < 8 ? 'Completá el nombre y el teléfono de tu acompañante.' : null,
      !d.motivo ? 'Elegí el motivo del estudio.' : null,
    ].filter(Boolean);
    if (p.length) { err.textContent = p[0]; return; }
    btn.disabled = true;
    try { await D.guardarEndoPaciente(ctx.uid, { datos: d }); ir('pre'); }
    catch (er) { console.error(er); err.textContent = 'No se pudo guardar. Intentá de nuevo.'; btn.disabled = false; }
  });
  return form;
}

/* ---------- Paso 2: prequirúrgico ---------- */
function pasoPre(ctx, ir, cfg) {
  const pre = W.pre;
  const resumen = h('div.pre-resumen');
  const pintarResumen = () => {
    const ev = E.evaluarPrequirurgico(pre, B().ahora(), cfg.validez);
    resumen.replaceChildren(ev.completo
      ? h('div.pre-ok', h('span.pre-ok-ico.latido', icono('okCirculo', { tam: 30 })), h('div', h('strong', '¡Tenés todo el prequirúrgico!'), h('p', 'Ya podés elegir tu turno.')),
        h('button.btn.btn--primario.btn--grande.btn--brillo', { type: 'button', onclick: guardarY('turno') }, 'Elegir turno', icono('flechaDer', { tam: 18 })))
      : h('div.pre-falta',
        h('strong', ev.faltan.some((i) => i.estado === 'sin-responder') ? 'Respondé los tres puntos para seguir' : `Te falta: ${ev.faltan.map((i) => i.nombre.toLowerCase()).join(', ')}`),
        h('ul', ...ev.faltan.filter((i) => i.estado !== 'sin-responder').map((i) => h('li', h('strong', i.nombre), ` — ${i.texto}`))),
        !cfg.rscSedacion ? h('p.ayuda', '¿Solo te indicaron una rectoscopia (rectosigmoidoscopia)? Se hace sin sedación y no necesita prequirúrgico: ',
          h('button.btn-link', { type: 'button', onclick: async () => { W.soloRsc = true; W.tipo = 'rsc'; W.libre = null; try { await D.guardarEndoPaciente(ctx.uid, { pre }); } catch { /* */ } ir('turno'); } }, 'elegir turno de rectoscopia')) : null,
        ev.pedir.length ? h('div.botones',
          h('button.btn.btn--primario', { type: 'button', onclick: guardarY('ordenes') }, icono('texto', { tam: 16 }), ev.pedir.length === 1 ? 'Generar mi orden' : `Generar mis ${ev.pedir.length} órdenes`),
          h('button.btn.btn--suave', { type: 'button', onclick: guardarY('inicio', 'Guardamos tus respuestas. Volvé cuando tengas todo.') }, 'Guardar y volver después')) : null));
  };
  const guardarY = (paso, msg) => async () => {
    try { await D.guardarEndoPaciente(ctx.uid, { pre }); if (msg) toast(msg, 'ok', 5000); ir(paso); } catch { toast('No se pudo guardar', 'error'); }
  };
  const tarjetaReq = (r) => {
    pre[r.id] ||= {};
    const x = pre[r.id];
    const detalle = h('div.req-detalle');
    // Solo el estado se repinta mientras se escribe: el campo de fecha NO se vuelve a crear
    // (antes se recreaba con cada tecla, el año quedaba en «0002» y la pantalla se rompía).
    const pintar = () => {
      const est = E.evaluarPrequirurgico(pre, B().ahora(), cfg.validez).items.find((i) => i.id === r.id);
      estado.replaceChildren(chip(est.texto, { ok: 'ok', falta: 'peligro', vencido: 'peligro', 'no-apto': 'peligro', incompleto: 'aviso', 'sin-responder': 'neutro' }[est.estado], est.estado === 'ok' ? 'okCirculo' : 'reloj'));
      caja.classList.toggle('req--ok', est.estado === 'ok');
      caja.classList.toggle('req--falta', ['falta', 'vencido', 'no-apto'].includes(est.estado));
    };
    const alCambiar = () => { pintar(); pintarResumen(); };
    // Fecha completa y razonable (año de 4 cifras desde 1990); mientras se escribe, queda sin fecha
    const fechaValida = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && +v.slice(0, 4) >= 1990;
    const armarDetalle = () => {
      const { dias } = E.evaluarPrequirurgico(pre, B().ahora(), cfg.validez).items.find((i) => i.id === r.id);
      detalle.replaceChildren(...(x.tiene ? [
        campo('¿Cuándo te lo hiciste?', { type: 'date', value: x.fecha || '', min: '1990-01-01', max: hoyISO(B().ahora()), oninput: (e) => { x.fecha = fechaValida(e.target.value) ? e.target.value : ''; alCambiar(); } }, { ayuda: `Vale ${dias} días.` }),
        r.id === 'ecg' ? h('label.check', h('input', { type: 'checkbox', checked: !!x.informe, onchange: (e) => { x.informe = e.target.checked; alCambiar(); } }), h('span', 'Tiene lectura e informe de un cardiólogo')) : null,
        r.id === 'anestesia' ? h('label.check', h('input', { type: 'checkbox', checked: x.apto !== false, onchange: (e) => { x.apto = e.target.checked; alCambiar(); } }), h('span', 'El anestesiólogo me dio el apto')) : null,
      ].filter(Boolean) : []));
    };
    const estado = h('div.req-estado');
    const caja = h('article.req', { style: { '--c1': r.c1, '--c2': r.c2 } },
      h('header.req-cab', h('span.req-ico', icono(r.icono, { tam: 22 })), h('div', h('strong', r.nombre), h('small', r.detalle))),
      segmentado([{ valor: 'si', texto: 'Lo tengo', icono: 'ok' }, { valor: 'no', texto: 'No lo tengo', icono: 'x' }], x.tiene === true ? 'si' : x.tiene === false ? 'no' : null, (v) => { x.tiene = v === 'si'; armarDetalle(); alCambiar(); }, { etiqueta: r.nombre }),
      detalle, estado);
    armarDetalle();
    pintar();
    return caja;
  };
  pintarResumen();
  return h('div.endo-pre',
    h('p.endo-intro', 'Para hacer el estudio con sedación necesitás estos tres requisitos. Si te falta alguno o está vencido, marcalo y te generamos la orden firmada por el médico.'),
    h('div.reqs', ...E.REQUISITOS.map(tarjetaReq)),
    resumen,
    h('div.botones.endo-nav', h('button.btn.btn--suave', { type: 'button', onclick: () => ir('datos') }, icono('flechaIzq', { tam: 16 }), 'Tus datos')));
}

/* ---------- Órdenes automáticas ---------- */
function pasoOrdenes(ctx, ir, cfg) {
  const ev = E.evaluarPrequirurgico(ctx.pac.endo?.pre, B().ahora(), cfg.validez);
  const ords = E.ordenes(ev.pedir.map((i) => i.id));
  const datos = ctx.pac.endo?.datos || W.d;
  if (!cfg.autorizaOrdenes || !cfg.medico.nombre) {
    return h('div.seccion', aviso('aviso', 'El consultorio todavía no habilitó las órdenes automáticas. Pedí las órdenes de estos estudios en el consultorio:'),
      h('ul.lista', ...ords.map((o) => h('li', `${o.titulo}: ${o.rp.join('; ')}`))),
      h('div.botones', h('button.btn.btn--suave', { type: 'button', onclick: () => ir('pre') }, 'Volver')));
  }
  // La primera vez se registran y se mandan solas por correo (una sola vez por pedido)
  const clave = ords.map((o) => o.id).join(',');
  if (W.ordenesEnviadas !== clave && (ctx.pac.endo?.ordenes?.items || []).join(',') !== clave) {
    W.ordenesEnviadas = clave;
    D.registrarOrdenes(ctx.uid, ords.map((o) => o.id)).catch(() => {});
    mandarCorreo({ tipo: 'ordenes', uid: ctx.uid, ordenes: ords, config: ctx.config, email: ctx.perfil.email });
  }
  const hojas = hojaOrdenes(ords, { perfil: ctx.perfil, datos, config: ctx.config });
  return h('div.seccion',
    h('section.orden-listo', { style: estiloSeccion('endoscopia') },
      h('span.orden-listo-ico', icono('texto', { tam: 28 })),
      h('div', h('h2', ords.length === 1 ? 'Tu orden está lista' : `Tus ${ords.length} órdenes están listas`), h('p', `Firmadas por ${cfg.medico.nombre}${cfg.medico.matricula ? ' (' + cfg.medico.matricula + ')' : ''}. Imprimilas o guardalas en PDF${cfg.revisarEnvios !== false ? '; tu médico las revisa y te las manda por correo.' : ' y también te las mandamos por correo.'}`)),
      h('div.botones',
        h('button.btn.btn--vidrio', { type: 'button', onclick: () => imprimir(hojaOrdenes(ords, { perfil: ctx.perfil, datos, config: ctx.config }), `ordenes-prequirurgico-${ctx.perfil.apellido}`) }, icono('imprimir', { tam: 16 }), 'Imprimir o PDF'),
        h('button.btn.btn--vidrio', { type: 'button', onclick: () => mandarCorreo({ tipo: 'ordenes', uid: ctx.uid, ordenes: ords, config: ctx.config, email: ctx.perfil.email }) }, icono('campana', { tam: 16 }), 'Mandar a mi correo'))),
    h('div.ordenes-vista', hojas),
    h('section.recordatorio', icono('reloj', { tam: 22 }),
      h('div', h('strong', 'Volvé a ingresar cuando tengas todo'), h('p', 'Entrás con tu correo y el código de siempre: tus respuestas quedan guardadas. Cargás la fecha de cada estudio y elegís el turno.'))),
    h('div.botones.endo-nav', h('button.btn.btn--suave', { type: 'button', onclick: () => ir('pre') }, icono('flechaIzq', { tam: 16 }), 'Volver al prequirúrgico'), h('button.btn.btn--primario', { type: 'button', onclick: () => ir('inicio') }, 'Listo')));
}

/* ---------- Paso 3: elegir turno ---------- */
function pasoTurno(ctx, ir, cfg) {
  const ev = E.evaluarPrequirurgico(ctx.pac.endo?.pre, B().ahora(), cfg.validez);
  const soloRsc = !ev.completo && W.soloRsc && !cfg.rscSedacion;
  if (!ev.completo && !soloRsc) { W.paso = 'pre'; return pasoPre(ctx, ir, cfg); }
  if (soloRsc) W.tipo = 'rsc';
  const ahora = B().ahora();
  const fechas = E.fechasAbiertas(ctx.agenda, { ahora });
  const tipos = h('div.tipos', ...Object.values(E.ESTUDIOS).filter((e) => !soloRsc || e.id === 'rsc').map((e) => h('button.tipo', {
    type: 'button', 'aria-pressed': W.tipo === e.id, style: { '--c1': e.c1, '--c2': e.c2 },
    onclick: () => { W.tipo = e.id; W.libre = null; ctx.render(); },
  }, h('span.tipo-badge', e.simple ? 'Turno simple' : 'Turno doble'), h('strong', e.corto), h('span', e.nombre), h('small', `Dura ${e.dura}`))));
  let cuerpo;
  if (!W.tipo) cuerpo = h('p.endo-intro', 'Elegí qué estudio te indicaron.');
  else if (!fechas.length) cuerpo = vacio('calendario', 'No hay fechas abiertas', 'Anotate en la lista de espera: cuando el médico abra fechas te ofrecemos el primer lugar por correo.', ctx.espera ? null : h('button.btn.btn--primario', { type: 'button', onclick: () => anotarme(ctx, { tipo: W.tipo }) }, icono('reloj', { tam: 16 }), 'Anotarme en la lista de espera'));
  else {
    const conLugar = fechas.map((f) => ({ f, libres: E.horariosLibres(ctx.agenda[f], ctx.ocupacion?.[f], W.tipo, { ahora, fecha: f }) }));
    if (!W.fecha || !conLugar.find((x) => x.f === W.fecha && x.libres.length)) W.fecha = conLugar.find((x) => x.libres.length)?.f || null;
    const sel = conLugar.find((x) => x.f === W.fecha);
    const dias = h('div.dias', { role: 'tablist', 'aria-label': 'Fechas abiertas' }, ...conLugar.map(({ f, libres }) => {
      const d = new Date(`${f}T12:00:00`);
      return h('button.dia', { type: 'button', role: 'tab', 'aria-selected': f === W.fecha, disabled: !libres.length, onclick: () => { W.fecha = f; W.libre = null; ctx.render(); } },
        h('small', d.toLocaleDateString('es-AR', { weekday: 'short' })), h('strong.num', String(d.getDate())), h('span', d.toLocaleDateString('es-AR', { month: 'short' })),
        h('em', libres.length ? `${libres.length} libre${libres.length > 1 ? 's' : ''}` : 'Completo'));
    }));
    cuerpo = h('div',
      h('h3.endo-sub', 'Fechas abiertas'), dias,
      sel ? h('div', h('h3.endo-sub', `Horarios del ${E.fechaLarga(sel.f)}`),
        h('div.leyenda-horas', h('span.ley-libre', 'Libre'), h('span.ley-ocupado', 'Ocupado')),
        h('div.horas', ...E.horariosTodos(ctx.agenda[sel.f], ctx.ocupacion?.[sel.f], W.tipo, { ahora, fecha: sel.f }).map((l) => h(`button.hora${l.libre ? '' : '.hora--ocupada'}`, { type: 'button', disabled: !l.libre, 'aria-pressed': W.libre?.hora === l.hora, 'aria-label': `${E.hora(l.hora)} ${l.libre ? 'libre' : 'ocupado'}`, onclick: () => { W.libre = { hora: l.hora, cupos: l.cupos }; ctx.render(); } },
          h('strong.num', E.hora(l.hora)), h('small', l.libre ? (l.cupos.length > 1 ? `libre hasta ${E.hora(E.deMin(E.aMin(l.cupos.at(-1)) + (+ctx.agenda[sel.f].minutos || 30)))}` : 'Libre') : 'Ocupado'))))) : vacio('calendario', 'Sin lugar', 'Todas las fechas abiertas están completas para este estudio.', ctx.espera ? null : h('button.btn.btn--primario', { type: 'button', onclick: () => anotarme(ctx, { tipo: W.tipo }) }, icono('reloj', { tam: 16 }), 'Anotarme en la lista de espera')),
      sel && !ctx.espera ? h('p.ayuda.espera-link', '¿Ninguna fecha te sirve? ', h('button.btn-link', { type: 'button', onclick: () => anotarme(ctx, { tipo: W.tipo }) }, 'Anotate en la lista de espera'), ' y te avisamos si se libera un lugar.') : null);
  }
  return h('div.endo-turno',
    h('h3.endo-sub', '¿Qué estudio te vas a hacer?'), tipos, cuerpo,
    h('div.botones.endo-nav',
      h('button.btn.btn--suave', { type: 'button', onclick: () => ir('pre') }, icono('flechaIzq', { tam: 16 }), 'Prequirúrgico'),
      h('button.btn.btn--primario.btn--grande', { type: 'button', disabled: !(W.tipo && W.fecha && W.libre), onclick: () => { W.ia = undefined; ir('docs'); } }, 'Continuar', icono('flechaDer', { tam: 18 }))));
}

/* ---------- Paso 4: consentimiento, preparación y firma ---------- */
function pasoDocs(ctx, ir, cfg) {
  if (!W.tipo || !W.fecha || !W.libre) { W.paso = 'turno'; return pasoTurno(ctx, ir, cfg); }
  if (W.tipo !== 'rsc') W.soloRsc = false;
  const perfil = ctx.perfil;
  const turno = { tipo: W.tipo, fecha: W.fecha, hora: W.libre.hora };
  const datos = ctx.pac.endo?.datos || W.d;
  const docs = E.documentos({ paciente: perfil, turno, datos, config: cfg });
  // Resumen personalizado con IA (si el servidor está configurado); sin datos identificatorios
  if (W.ia === undefined) {
    W.ia = null;
    D.resumenIA({
      estudio: E.ESTUDIOS[W.tipo].nombre, edad: calcEdad(perfil.fechaNac, new Date(B().ahora())), sexo: perfil.sexo === 'M' ? 'masculino' : 'femenino',
      factores: Object.keys(E.factores(datos)).filter((k) => E.factores(datos)[k]).map((k) => E.ANTECEDENTES.find(([x]) => x === k)?.[1] || k),
      preparacion: docs.pasos.map((p) => `${p.cuando}: ${p.que.join(' ')}`),
    }).then((r) => { if (r) { W.ia = r; ctx.render(); } });
  }
  const firma = panelFirma({ onCambio: () => {}, nombre: `${perfil.nombre} ${perfil.apellido}`, teclado: true });
  const leido = h('input', { type: 'checkbox' });
  const acl = h('input', { type: 'text', value: `${perfil.nombre} ${perfil.apellido}`, maxlength: 80, id: 'endo-acl' });
  const err = h('div.form-error', { role: 'alert' });
  const btn = h('button.btn.btn--primario.btn--grande.btn--brillo', { type: 'button' }, icono('ok', { tam: 18 }), 'Confirmar mi turno');
  btn.onclick = async () => {
    err.textContent = '';
    if (!leido.checked) { err.textContent = 'Marcá que leíste y entendiste el consentimiento.'; return; }
    if (firma.vacia()) { err.textContent = 'Firmá en el recuadro con el dedo, el lápiz o el mouse, o tocá «Escribir con el teclado».'; return; }
    if (!acl.value.trim()) { err.textContent = 'Escribí tu nombre y apellido como aclaración.'; return; }
    btn.disabled = true; btn.textContent = 'Reservando…';
    try {
      const r = await D.reservar(ctx.uid, perfil, { tipo: W.tipo, fecha: W.fecha, libre: W.libre, datos, pre: ctx.pac.endo?.pre || W.pre, firma: firma.png(), metodoFirma: firma.metodo(), aclaracion: acl.value, config: cfg, textoConsentimiento: docs.consentimiento, reemplaza: W.reemplaza, enEspera: ctx.espera || null });
      W.ultimo = r.id; W.paso = 'ticket'; W.recienCreado = true;
      const t = { ...turno, codigo: r.codigo, cupos: W.libre.cupos, estado: 'confirmado', reprogramaciones: 0, consentimiento: { huella: r.huella } };
      mandarCorreo({ tipo: 'turno', uid: ctx.uid, t, id: r.id, docs, paciente: `${perfil.nombre} ${perfil.apellido}`, config: ctx.config, email: perfil.email });
      W.tipo = W.fecha = W.libre = W.reemplaza = null; W.enEspera = false;
      document.activeElement?.blur?.();
      ctx.render(); window.scrollTo(0, 0);
    } catch (er) {
      console.error(er);
      if (er.code === 'endo/ocupado') { toast('Ese horario se acaba de ocupar. Elegí otro.', 'error', 6000); W.libre = null; ir('turno'); return; }
      err.textContent = 'No se pudo reservar. Revisá la conexión e intentá de nuevo.'; btn.disabled = false; btn.textContent = 'Confirmar mi turno';
    }
  };
  const e = E.ESTUDIOS[W.tipo];
  return h('div.endo-docs-paso',
    h('div.turno-elegido', { style: { '--c1': e.c1, '--c2': e.c2 } }, icono('calendario', { tam: 22 }), h('div', h('strong', `${e.corto} · ${E.fechaLarga(W.fecha)} · ${E.hora(W.libre.hora)} h`), h('small', `Presentate a las ${docs.presentarse}`)),
      h('button.btn-link', { type: 'button', onclick: () => ir('turno') }, 'Cambiar')),
    bloqueDocs(docs, W.ia),
    tarjeta('Consentimiento informado', { icono: 'editar', seccion: 'endoscopia', extra: chip('Ley 26.529', 'neutro', 'escudo') },
      h('div.consentimiento-caja', textoConsentimiento(docs)),
      h('label.check.check--legal', leido, h('span', 'Leí y entendí esta información, pude hacer preguntas y presto mi consentimiento para el estudio.')),
      h('div.campo', h('label', 'Tu firma'), firma.el),
      h('div.campo', h('label', { for: 'endo-acl' }, 'Aclaración'), acl),
      err, h('div.botones.endo-nav', h('button.btn.btn--suave', { type: 'button', onclick: () => ir('turno') }, icono('flechaIzq', { tam: 16 }), 'Turno'), btn)));
}

/* ---------- Ticket recién creado ---------- */
function pasoTicket(ctx, ir, cfg) {
  const t = ctx.turnos?.[W.ultimo];
  if (!t) return cargando('Generando tu ticket…');
  const nombre = `${ctx.perfil.nombre} ${ctx.perfil.apellido}`;
  const docs = E.documentos({ paciente: ctx.perfil, turno: t, datos: t.datos, config: cfg });
  const festejo = W.recienCreado;
  W.recienCreado = false;
  return h('div.ticket-final',
    festejo ? h('div.confeti', { 'aria-hidden': 'true' }, ...Array.from({ length: 28 }, (_, i) => h('i', { style: { '--i': i } }))) : null,
    h('header.ticket-final-cab', h('span.pre-ok-ico.latido', icono('okCirculo', { tam: 30 })), h('div', h('h1', '¡Turno confirmado!'), h('p', cfg.revisarEnvios !== false ? `Tu ticket ya está acá. Tu médico revisa la preparación y el consentimiento y te los manda a ${ctx.perfil.email}.` : `Te mandamos el ticket, la preparación y el consentimiento a ${ctx.perfil.email}.`))),
    ticket(t, { config: ctx.config, paciente: nombre }),
    accionesTurno(ctx, W.ultimo, t, docs, nombre),
    selloConsentimiento(t),
    bloqueDocs(docs, null),
    h('div.botones.endo-nav', h('button.btn.btn--primario', { type: 'button', onclick: () => ir('mis') }, 'Ver mis turnos')));
}

function accionesTurno(ctx, id, t, docs, nombre) {
  const cfg = D.configCompleta(ctx.config);
  return h('div.botones.ticket-acc',
    h('button.btn.btn--suave', { type: 'button', onclick: () => imprimir(hojaTurno(t, { docs, paciente: nombre, config: ctx.config }), `turno-${t.codigo}`) }, icono('imprimir', { tam: 16 }), 'Imprimir o PDF'),
    h('button.btn.btn--suave', { type: 'button', onclick: () => descargar(`turno-${t.codigo}.ics`, E.ics({ ...t, lugar: `${cfg.lugar.nombre} ${cfg.lugar.direccion}`.trim() }), 'text/calendar') }, icono('calendario', { tam: 16 }), 'Agregar al calendario'),
    h('button.btn.btn--suave', { type: 'button', onclick: () => mandarCorreo({ tipo: 'turno', uid: ctx.uid, t, id, docs, paciente: nombre, config: ctx.config, email: ctx.perfil.email }) }, icono('campana', { tam: 16 }), 'Reenviar al correo'),
    navigator.share ? h('button.btn.btn--suave', { type: 'button', onclick: () => navigator.share({ title: `Turno ${t.codigo}`, text: `Mi turno de ${E.ESTUDIOS[t.tipo].corto}: ${E.fechaLarga(t.fecha)} ${E.hora(t.hora)} h. Código ${t.codigo}`, url: urlTurno(t.codigo) }).catch(() => {}) }, icono('flechaDer', { tam: 16 }), 'Compartir') : null);
}

/* ---------- Mis turnos ---------- */
function misTurnos(ctx, ir, cfg, activos) {
  const nombre = `${ctx.perfil.nombre} ${ctx.perfil.apellido}`;
  const pasados = Object.entries(ctx.turnos || {}).filter(([, t]) => !E.turnoActivo(t)).sort((a, b) => b[1].fecha.localeCompare(a[1].fecha));
  return h('div.mis-turnos',
    ...activos.map(([id, t]) => {
      const docs = E.documentos({ paciente: ctx.perfil, turno: t, datos: t.datos, config: cfg });
      const est = E.estadoVisible(t);
      return h('section.turno-bloque',
        E.dentroDe48h(t, B().ahora()) ? h('div.recordatorio.recordatorio--pronto', icono('campana', { tam: 22 }), h('div', h('strong', `Tu estudio es ${E.faltaTexto(t, B().ahora())}: ${E.fechaLarga(t.fecha)} a las ${E.hora(t.hora)}`), h('p', `Presentate a las ${docs.presentarse}. Repasá la preparación paso a paso (abajo) y no te olvides del acompañante.`))) : null,
        aviso(E.ESTADOS[est].tono === 'peligro' ? 'peligro' : E.ESTADOS[est].tono === 'aviso' ? 'aviso' : 'ok', h('span', h('strong', `${E.ESTADOS[est].nombre}. `), E.ESTADOS[est].texto, t.motivo && est !== 'confirmado' ? ` Motivo: ${t.motivo}.` : '')),
        ticket(t, { config: ctx.config, paciente: nombre }),
        lineaEstado(t),
        accionesTurno(ctx, id, t, docs, nombre),
        h('details.plegable', h('summary', h('span', 'Preparación, recomendaciones y consentimiento'), icono('chevronAbajo', { tam: 18 })), h('div.plegable-cuerpo', t.docsAprobados ? docsAprobados(t) : bloqueDocs(docs, null), tarjeta('Consentimiento firmado', { icono: 'editar' }, t.consentimiento?.texto ? h('div.consentimiento-texto', ...t.consentimiento.texto.split('\n').map((l) => h('p', l))) : textoConsentimiento(docs), t.consentimiento?.firma ? h('img.firma-img', { src: t.consentimiento.firma, alt: 'Tu firma' }) : null, selloConsentimiento(t)))),
        t.estado === 'confirmado' && !ctx.espera ? h('button.btn.btn--suave', { type: 'button', onclick: () => anotarme(ctx, { tipo: t.tipo, antesDe: t.fecha, turno: id }) }, icono('reloj', { tam: 16 }), 'Avisame si se libera un lugar antes') : null,
        t.estado === 'confirmado' ? h('button.btn-link.btn-peligro', { type: 'button', onclick: async () => {
          if (await confirmar({ titulo: 'Cancelar turno', texto: `¿Cancelás tu turno del ${E.fechaLarga(t.fecha)}? El horario queda libre para otra persona.`, si: 'Cancelar turno', no: 'Volver', peligro: true })) {
            await D.cancelarTurno(ctx.uid, id, t); toast('Turno cancelado', 'ok');
          }
        } }, 'Cancelar este turno') : null);
    }),
    h('div.botones', h('button.btn.btn--primario', { type: 'button', onclick: () => ir('datos') }, icono('mas', { tam: 16 }), 'Solicitar otro turno')),
    tarjetaControlesPaciente(ctx.seg),
    ...pasados.filter(([, t]) => t.informe?.resultado && !ctx.seg?.estudios).map(([, t]) => tarjeta(`Tu ${E.ESTUDIOS[t.tipo].corto} del ${E.fechaCorta(t.fecha)}: próximo control`, { icono: 'calendario', seccion: 'endoscopia' }, resumenVigilancia(t))),
    pasados.length ? tarjeta('Turnos anteriores', { icono: 'reloj' }, h('ul.turnos-pasados', ...pasados.map(([, t]) => h('li', h('strong', `${E.ESTUDIOS[t.tipo].corto} · ${E.fechaCorta(t.fecha)}`), chip(E.ESTADOS[t.estado]?.nombre || t.estado, E.ESTADOS[t.estado]?.tono || 'neutro'), h('small.num', t.codigo))))) : null);
}

function docsAprobados(t) {
  return tarjeta('Documentación revisada por tu médico', { icono: 'okCirculo', seccion: 'endoscopia', extra: chip(`Enviada ${fecha(t.docsAprobados.fecha)}`, 'ok') },
    h('div.doc-app', ...(t.docsAprobados.secciones || []).filter(([tit]) => !/^Consentimiento/.test(tit)).map(([tit, l]) => h('section', h('h4', ICONO_SEC(tit), ' ', tit), h('ul', ...(l || []).map((x) => h('li', x)))))));
}

function lineaEstado(t) {
  const hitos = Object.values(t.historial || {}).sort((a, b) => a.cuando - b.cuando);
  return h('ol.linea-estado', ...hitos.map((x) => h('li', h('time', fechaHora(x.cuando)), h('span', x.que))));
}

/* ======================= INFORME Y PRÓXIMO CONTROL ======================= */

/** Tarjeta con la categoría de riesgo y el próximo control (la ven el médico y el paciente). */
export function resumenVigilancia(t, { chico = false } = {}) {
  const res = t.informe?.resultado;
  if (!res) return null;
  const cat = V.CATEGORIAS[res.riesgo];
  return h(`div.vigilancia${chico ? '.vigilancia--chica' : ''}`,
    res.provisorio ? aviso('aviso', h('span', h('strong', 'Provisorio. '), V.AVISO_HISTO)) : t.informe.histoCargada ? aviso('ok', 'Definitivo: incluye el informe de anatomía patológica.') : null,
    h('div.vig-partes', ...res.partes.map((p) => h(`article.vig-parte.vig--${p.riesgo}`,
      h('header', h('strong', p.nombre), chip(V.CATEGORIAS[p.riesgo].nombre, V.CATEGORIAS[p.riesgo].tono)),
      h('div.vig-cuando', h('strong', V.textoIntervalo(p.meses)), p.fecha ? h('small', `Aproximadamente en ${new Date(`${p.fecha}T12:00:00`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`) : null),
      chico ? null : h('ul', ...p.items.map((x) => h('li', x.texto, x.usmstf ? h('small', ` (${x.usmstf})`) : null, x.nota ? h('small', ` ${x.nota}`) : null, h('em', ` · ${x.guia}`))))))),
    chico ? null : h('p.ayuda', `Riesgo global: ${cat.nombre.toLowerCase()}. Es una orientación basada en las guías; el intervalo definitivo lo indica tu médico.`));
}


/* ======================= ESTADO PÚBLICO (QR) ======================= */

export async function pantallaEstadoTurno(codigo, { onEntrar }) {
  const raiz = document.getElementById('app');
  const marco = (...c) => montar(raiz, h('div.acceso', h('div.acceso-fondo', h('i'), h('i'), h('i'), h('i')),
    h('header.acceso-top', logo()), h('main.acceso-main.estado-publico', ...c),
    h('footer.acceso-pie', h('span', 'Emergencias: 107'))));
  marco(cargando('Buscando el turno…'));
  const r = await D.leerEstadoPublico(codigo);
  const volver = h('button.btn.btn--suave', { type: 'button', onclick: onEntrar }, 'Ir a Metria');
  if (!r) { marco(h('section.acceso-card.centro', h('span.puerta-gema', icono('alerta', { tam: 26 })), h('h2', 'No encontramos ese turno'), h('p', 'Revisá el código. Si el problema sigue, comunicate con el consultorio.'), volver)); return; }
  const t = { ...r, codigo: E.normalizarCodigo(codigo) };
  const est = E.estadoVisible(t);
  const info = E.ESTADOS[est];
  marco(h('section.estado-turno', { style: { '--c1': E.ESTUDIOS[t.tipo].c1, '--c2': E.ESTUDIOS[t.tipo].c2 } },
    h('span.estado-sello.estado-sello--' + info.tono, icono(info.tono === 'peligro' ? 'alerta' : 'okCirculo', { tam: 34 })),
    h('h1', info.nombre),
    h('p', info.texto),
    r.motivo && est !== 'confirmado' ? aviso('aviso', `Motivo: ${r.motivo}`) : null,
    ticket(t, { config: null, paciente: 'Paciente con este código', chico: true }),
    h('p.ayuda', `Actualizado: ${fechaHora(r.actualizado)} · Por privacidad, esta página no muestra nombre ni DNI.`),
    h('div.botones', volver)));
}

/* ======================= MÉDICO ======================= */

const M = { tab: 'turnos', dia: null, buscar: '' };

/**
 * Sección «Endoscopia» del médico.
 * ctx: { perfil, indice, config, agenda, ocupacion, turnos, abrirFicha, render }
 */
export function vistaEndoMedico(ctx) {
  const pendEnv = Object.values(ctx.envios || {}).filter((e) => e.estado === 'pendiente').length;
  const tabs = [['turnos', 'Turnos', 'ticket'], ['envios', pendEnv ? `Envíos (${pendEnv})` : 'Envíos', 'campana'], ['agenda', 'Agenda', 'calendario'], ['admision', 'Admisión', 'qr'], ['config', 'Configuración', 'editar']];
  const pend = !ctx.config?.medico?.nombre;
  const cuerpo = { turnos: tabTurnos, envios: tabEnvios, agenda: tabAgenda, admision: tabAdmision, config: tabConfig }[M.tab](ctx);
  return h('div.seccion',
    heroe('endoscopia', 'Endoscopia digestiva', 'Agenda, turnos de los pacientes, admisión con QR y órdenes firmadas'),
    pend && M.tab !== 'config' ? aviso('aviso', h('span', 'Antes de abrir la agenda, completá el médico actuante, su firma y el lugar. ', h('button.btn-link', { type: 'button', onclick: () => { M.tab = 'config'; ctx.render(); } }, 'Ir a Configuración'))) : null,
    h('div.filtros.endo-tabs', ...tabs.map(([k, t, ic]) => h('button.filtro', { type: 'button', 'aria-pressed': M.tab === k, onclick: () => { M.tab = k; ctx.render(); } }, icono(ic, { tam: 15 }), ` ${t}`))),
    cuerpo);
}

const listaTurnos = (turnos) => Object.entries(turnos || {}).flatMap(([pac, l]) => Object.entries(l || {}).map(([id, t]) => ({ pac, id, t })));

async function reenviar(x, ctx, tipo = 'reprogramado') {
  const cfg = D.configCompleta(ctx.config);
  const docs = E.documentos({ paciente: { nombre: x.t.paciente?.n?.split(', ')[1], apellido: x.t.paciente?.n?.split(', ')[0] }, turno: x.t, datos: x.t.datos, config: cfg });
  return mandarCorreo({ tipo, uid: x.pac, t: x.t, id: x.id, docs, paciente: x.t.paciente?.n, config: ctx.config, email: 'correo del paciente' });
}

function tabTurnos(ctx) {
  const todos = listaTurnos(ctx.turnos);
  const hoy = hoyISO(B().ahora());
  const fechas = [...new Set([...todos.filter((x) => x.t.estado !== 'cancelado').map((x) => x.t.fecha), ...E.fechasAbiertas(ctx.agenda, { ahora: B().ahora() })])].sort();
  if (!M.dia || !fechas.includes(M.dia)) M.dia = fechas.find((f) => f >= hoy) || fechas.at(-1) || null;
  const susp = todos.filter((x) => x.t.estado === 'suspendido');
  const delDia = todos.filter((x) => x.t.fecha === M.dia && x.t.estado !== 'cancelado').sort((a, b) => a.t.hora.localeCompare(b.t.hora));
  const proximos = todos.filter((x) => x.t.fecha >= hoy && ['confirmado', 'admitido'].includes(x.t.estado)).length;
  const kpi = (t, v, ic) => h('div.endo-kpi', icono(ic, { tam: 18 }), h('strong.num', String(v)), h('small', t));
  return h('div.endo-med',
    h('div.endo-kpis', kpi('próximos', proximos, 'ticket'), kpi('suspendidos', susp.length, 'alerta'), kpi('fechas abiertas', E.fechasAbiertas(ctx.agenda, { ahora: B().ahora() }).length, 'calendario'), kpi('hoy', todos.filter((x) => x.t.fecha === hoy && x.t.estado !== 'cancelado').length, 'reloj')),
    susp.length ? aviso('peligro', h('span', h('strong', `${susp.length} turno${susp.length > 1 ? 's' : ''} suspendido${susp.length > 1 ? 's' : ''} sin lugar. `), 'Abrí una fecha nueva en Agenda: se reprograman solos y les llega el correo.')) : null,
    B().modo === 'demo' ? aviso('info', h('span', 'Los recordatorios los manda solo el servidor cada hora, 48 h antes. En la demo: ', h('button.btn-link', { type: 'button', onclick: () => simularServidor(ctx) }, 'simular el servidor ahora'), ' (manda recordatorios y ofrece los lugares libres a la lista de espera; con «+1 día» acercás la fecha).')) : null,
    listaEsperaMedico(ctx),
    fechas.length ? h('div.dias.dias--med', ...fechas.map((f) => {
      const n = todos.filter((x) => x.t.fecha === f && x.t.estado !== 'cancelado').length;
      const d = new Date(`${f}T12:00:00`);
      return h('button.dia', { type: 'button', 'aria-selected': f === M.dia, onclick: () => { M.dia = f; ctx.render(); } },
        h('small', d.toLocaleDateString('es-AR', { weekday: 'short' })), h('strong.num', String(d.getDate())), h('span', d.toLocaleDateString('es-AR', { month: 'short' })), h('em', `${n} turno${n === 1 ? '' : 's'}`));
    })) : vacio('calendario', 'Sin turnos ni fechas', 'Abrí fechas en la pestaña Agenda para que los pacientes puedan elegir.'),
    M.dia ? grillaDia(ctx, M.dia, todos) : null,
    M.dia ? tarjeta(`Turnos del ${E.fechaLarga(M.dia)}`, { icono: 'ticket', seccion: 'endoscopia' },
      delDia.length ? h('div.turnos-med', ...delDia.map((x) => filaTurno(x, ctx))) : h('p.ayuda', 'Sin turnos ese día.')) : null);
}

/** Grilla del día para el médico: cada horario libre u ocupado, con el paciente y el estudio. */
function grillaDia(ctx, dia, todos) {
  const ag = ctx.agenda?.[dia];
  const cupos = E.cuposDe(ag);
  if (!cupos.length) return null;
  const ocup = ctx.ocupacion?.[dia] || {};
  const porId = Object.fromEntries(todos.map((x) => [x.id, x]));
  const ocupados = cupos.filter((c) => ocup[c]).length;
  return tarjeta(`Agenda del ${E.fechaLarga(dia)} · ${ocupados} de ${cupos.length} ocupados`, { icono: 'calendario', seccion: 'endoscopia' },
    h('div.grilla-dia', ...cupos.map((c) => {
      const x = porId[ocup[c]];
      if (!ocup[c]) return h('div.celda.celda--libre', h('strong.num', E.hora(c)), h('span', 'Libre'));
      const e = x ? E.ESTUDIOS[x.t.tipo] : null;
      return h('button.celda.celda--ocupada', { type: 'button', style: e ? { '--c1': e.c1, '--c2': e.c2 } : null, title: x ? `${x.t.paciente?.n} · ${e.nombre}` : 'Ocupado',
        onclick: () => { if (x) { M.tab = 'admision'; M.buscar = x.t.codigo; ctx.render(); } } },
        h('strong.num', E.hora(c)), h('span', x?.t.paciente?.n || 'Ocupado'), x ? h('small', `${e.corto} · ${E.ESTADOS[E.estadoVisible(x.t)].nombre}`) : null);
    })));
}

function filaTurno(x, ctx) {
  const { t } = x;
  const est = E.estadoVisible(t);
  const e = E.ESTUDIOS[t.tipo];
  const pre = E.evaluarPrequirurgico(t.pre, B().ahora(), D.configCompleta(ctx.config).validez);
  const acc = [];
  if (['confirmado'].includes(t.estado)) acc.push(h('button.btn.btn--primario', { type: 'button', onclick: async () => { await D.marcarEstado(x.pac, x.id, t, 'admitido', 'Admitido en Admisión'); toast('Paciente admitido', 'ok'); } }, icono('ok', { tam: 15 }), 'Admitir'));
  if (t.estado === 'admitido') acc.push(h('button.btn.btn--primario', { type: 'button', onclick: async () => { await D.marcarEstado(x.pac, x.id, t, 'realizado', 'Estudio realizado'); toast('Estudio marcado como realizado', 'ok'); } }, icono('okCirculo', { tam: 15 }), 'Realizado / egreso'));
  if (['confirmado', 'admitido', 'suspendido'].includes(t.estado)) acc.push(h('button.btn.btn--suave', { type: 'button', onclick: () => suspender(x, ctx) }, icono('reloj', { tam: 15 }), t.estado === 'suspendido' ? 'Reintentar reprogramación' : 'Suspender y reprogramar'));
  if (['admitido', 'realizado'].includes(t.estado)) acc.push(h('button.btn.btn--primario', { type: 'button', onclick: () => abrirEstudioDesdeTurno(ctx, x) }, icono('editar', { tam: 15 }), t.informe ? 'Hallazgos y próximo control' : 'Cargar hallazgos y próximo control'));
  acc.push(h('button.btn.btn--suave', { type: 'button', onclick: () => reenviar(x, ctx, t.reprogramaciones ? 'reprogramado' : 'turno') }, icono('campana', { tam: 15 }), 'Reenviar correo'));
  if (ctx.indice?.[x.pac]) acc.push(h('button.btn.btn--suave', { type: 'button', onclick: () => ctx.abrirFicha(x.pac) }, icono('usuario', { tam: 15 }), 'Ficha'));
  return h('article.turno-med', { style: { '--c1': e.c1, '--c2': e.c2 } },
    h('div.turno-med-hora', h('strong.num', E.hora(t.hora)), h('small', e.corto)),
    h('div.turno-med-info',
      h('strong', t.paciente?.n || 'Paciente'), h('small', `DNI •••${t.paciente?.d3 || ''} · ${t.datos?.cobertura || 'Sin cobertura'}${t.datos?.afiliado ? ' ' + t.datos.afiliado : ''} · Acomp.: ${t.datos?.acompNombre || '—'} ${t.datos?.acompTel || ''}`),
      h('div.chips', chip(E.ESTADOS[est].nombre, E.ESTADOS[est].tono), t.tipo === 'rsc' && !D.configCompleta(ctx.config).rscSedacion ? chip('Sin sedación', 'info', 'matraz') : chip(pre.completo ? 'Prequirúrgico OK' : 'Prequirúrgico incompleto', pre.completo ? 'ok' : 'peligro', 'matraz'), h('span.chip.chip--neutro.num', t.codigo),
        t.consentimiento?.huella ? chip('Consentimiento con huella', 'info', 'huella') : null,
        t.recordatorio ? chip(`Recordatorio enviado ${fechaHora(t.recordatorio)}`, 'info', 'campana') : t.estado === 'confirmado' ? chip('Recordatorio: 48 h antes', 'neutro', 'campana') : null,
        ...(t.alertas || []).map((a) => chip(a, 'aviso', 'alerta'))),
      t.motivo ? h('small.ayuda', `${t.estado === 'suspendido' ? 'Motivo de la suspensión' : 'Última reprogramación'}: ${t.motivo}`) : null,
      t.informe ? resumenVigilancia(t, { chico: true }) : null),
    h('div.botones.turno-med-acc', ...acc));
}

function listaEsperaMedico(ctx) {
  const lista = Object.entries(ctx.esperas || {}).sort((a, b) => (a[1].creado || 0) - (b[1].creado || 0));
  if (!lista.length) return null;
  const ahora = B().ahora();
  return tarjeta(`Lista de espera (${lista.length})`, { icono: 'reloj', seccion: 'endoscopia' },
    h('p.ayuda', `Cada lugar que se libera se le ofrece por correo al primero de la lista; tiene ${E.HORAS_OFERTA} h para tomarlo y después pasa al siguiente.`),
    h('ol.espera-lista', ...lista.map(([pac, e]) => h('li',
      h('strong', ctx.indice?.[pac]?.n || 'Paciente'),
      h('span', `${E.ESTUDIOS[e.tipo]?.corto || e.tipo}${e.antesDe ? ` · quiere adelantar su turno del ${E.fechaCorta(e.antesDe)}` : ' · sin turno'} · desde ${fecha(e.creado)}`),
      e.oferta?.vence > ahora ? chip(`Oferta: ${E.fechaCorta(e.oferta.fecha)} ${E.hora(e.oferta.hora)} (vence ${fechaHora(e.oferta.vence)})`, 'info', 'campana') : chip('Esperando lugar', 'neutro')))));
}

/** Solo demo: hace lo mismo que el servidor cada hora (recordatoriosEndo_ y avisarEspera_ en Codigos.gs) y muestra los correos. */
async function simularServidor(ctx) {
  const ofertas = await D.repartirOfertas({ esperas: ctx.esperas, agenda: ctx.agenda, ocupacion: ctx.ocupacion, ahora: B().ahora() });
  for (const o of ofertas) buzonDemo({ tipo: 'espera', t: null, secciones: [['Se liberó un lugar', [`${E.ESTUDIOS[o.oferta.tipo].nombre}: ${E.fechaLarga(o.oferta.fecha)} a las ${E.hora(o.oferta.hora)}.`, `Te lo ofrecemos primero a vos: entrá a Metria → Endoscopia → «Tomar este lugar» antes del ${fechaHora(o.oferta.vence)}.`]]], email: ctx.indice?.[o.pac]?.n });
  if (ofertas.length) toast(`${ofertas.length} lugar${ofertas.length > 1 ? 'es' : ''} ofrecido${ofertas.length > 1 ? 's' : ''} a la lista de espera`, 'ok', 5000);
  await simularRecordatorios(ctx, !!ofertas.length);
}

async function simularRecordatorios(ctx, silencioso = false) {
  const ahora = B().ahora();
  const pend = listaTurnos(ctx.turnos).filter((x) => E.dentroDe48h(x.t, ahora) && !x.t.recordatorio);
  if (!pend.length) { if (!silencioso) toast('No hay recordatorios pendientes (se mandan 48 h antes) ni lugares libres para ofrecer', 'info', 5000); return; }
  for (const x of pend) {
    await B().actualizar('', { [`turnosEndo/${x.pac}/${x.id}/recordatorio`]: B().TS, [`turnosEndo/${x.pac}/${x.id}/historial/${B().nuevaClave()}`]: { cuando: B().TS, que: 'Recordatorio enviado por correo (48 h antes)', por: 'sistema' } });
    await reenviar(x, ctx, 'recordatorio');
  }
  toast(`${pend.length} recordatorio${pend.length > 1 ? 's' : ''} enviado${pend.length > 1 ? 's' : ''}`, 'ok');
}

async function suspender(x, ctx) {
  const motivo = h('input', { type: 'text', maxlength: 200, placeholder: 'Ej.: equipo en mantenimiento, preparación inadecuada…', id: 'endo-motivo' });
  const m = modal({
    titulo: 'Suspender y reprogramar', ancho: 520,
    cuerpo: h('div', h('p', `El turno de ${x.t.paciente?.n} pasa automáticamente al próximo día con lugar y le mandamos todo de nuevo por correo. Si no hay lugar, queda suspendido y se reprograma solo cuando abras una fecha.`),
      h('div.campo', h('label', { for: 'endo-motivo' }, 'Motivo (lo ve el paciente)'), motivo)),
    acciones: [h('button.btn.btn--suave', { type: 'button', onclick: () => m.cerrar() }, 'Volver'),
      h('button.btn.btn--primario', { type: 'button', onclick: async (e) => {
        e.target.disabled = true;
        try {
          const nuevo = await D.suspenderYReprogramar(x.pac, x.id, x.t, { agenda: ctx.agenda, ocupacion: JSON.parse(JSON.stringify(ctx.ocupacion || {})), motivo: motivo.value, ahora: B().ahora() });
          m.cerrar();
          if (nuevo) {
            toast(`Reprogramado para el ${E.fechaCorta(nuevo.fecha)} a las ${E.hora(nuevo.hora)}`, 'ok', 6000);
            reenviar({ ...x, t: { ...x.t, fecha: nuevo.fecha, hora: nuevo.hora, cupos: nuevo.cupos, estado: 'confirmado', reprogramaciones: (x.t.reprogramaciones || 0) + 1 } }, ctx);
          } else toast('Suspendido: no hay lugar libre. Se reprograma solo al abrir una fecha.', 'info', 7000);
        } catch (er) { console.error(er); toast('No se pudo suspender', 'error'); e.target.disabled = false; }
      } }, 'Suspender y reprogramar')],
  });
}

/* ---------- Envíos: revisar, editar y aprobar lo que recibe el paciente ---------- */
const turnoDe = (ctx, e) => (e.pac && e.turno ? ctx.turnos?.[e.pac]?.[e.turno] || null : null);
function imprimirEnvio(e, ctx) { imprimir(hojaEnvio(e, { t: turnoDe(ctx, e), config: ctx.config }), `${e.paciente || 'paciente'} - ${TIT_ENVIO[e.tipo] || 'documento'}`); }

function tabEnvios(ctx) {
  const lista = Object.entries(ctx.envios || {}).sort((a, b) => (a[1].estado === 'pendiente' ? 0 : 1) - (b[1].estado === 'pendiente' ? 0 : 1) || (b[1].creado || 0) - (a[1].creado || 0));
  const pend = lista.filter(([, e]) => e.estado === 'pendiente');
  const hechos = lista.filter(([, e]) => e.estado !== 'pendiente').slice(0, 15);
  const cfg = D.configCompleta(ctx.config);
  const item = ([id, e]) => h(`article.envio.envio--${e.estado}`,
    h('div.envio-ico', icono(e.tipo === 'ordenes' ? 'texto' : 'ticket', { tam: 20 })),
    h('div.envio-info',
      h('strong', e.paciente || 'Paciente'),
      h('span', TIT_ENVIO[e.tipo] || e.tipo),
      h('small', `${e.codigo ? e.codigo + ' · ' : ''}${e.ticket ? e.ticket.fecha + ' ' + e.ticket.hora + ' h · ' : ''}preparado ${fechaHora(e.creado)}${e.editado ? ' · editado' : ''}`)),
    h('div.envio-estado', chip({ pendiente: 'Para revisar', enviado: 'Enviado', descartado: 'Descartado' }[e.estado] || e.estado, { pendiente: 'aviso', enviado: 'ok', descartado: 'neutro' }[e.estado] || 'neutro')),
    h('div.botones.envio-acc',
      h('button.btn.btn--suave', { type: 'button', onclick: () => imprimirEnvio(e, ctx) }, icono('pdf', { tam: 15 }), 'Ver PDF'),
      h('button.btn.btn--suave', { type: 'button', onclick: () => wordEnvio(e, { config: ctx.config }) }, icono('texto', { tam: 15 }), 'Word'),
      e.estado === 'pendiente' ? [
        h('button.btn.btn--suave', { type: 'button', onclick: () => editarEnvio(id, e, ctx) }, icono('editar', { tam: 15 }), 'Editar'),
        h('button.btn.btn--primario', { type: 'button', onclick: (ev) => aprobarEnvio(id, e, ctx, ev.currentTarget) }, icono('ok', { tam: 15 }), 'Aprobar y enviar'),
        h('button.btn-link', { type: 'button', onclick: async () => { if (await confirmar({ titulo: 'Descartar envío', texto: 'No se le manda nada al paciente. El turno sigue igual.', si: 'Descartar', peligro: true })) { await D.descartarEnvio(id); toast('Envío descartado', 'ok'); } } }, 'Descartar'),
      ] : null));
  return h('div.endo-med',
    aviso('info', h('span', cfg.revisarEnvios !== false
      ? 'Todo lo que la app le manda al paciente (confirmación con preparación y consentimiento, órdenes y reprogramaciones) espera acá tu revisión. Miralo en PDF o Word, editalo si hace falta y aprobalo para que salga por correo. El paciente ya ve su ticket en la app. Los recordatorios de 48 h y los avisos de la lista de espera salen solos con el texto de tus plantillas (Configuración).'
      : 'La revisión previa está desactivada: los correos salen directo. Activala en Configuración.')),
    tarjeta(`Para revisar (${pend.length})`, { icono: 'campana', seccion: 'endoscopia' }, pend.length ? h('div.envios', ...pend.map(item)) : vacio('okCirculo', 'Nada pendiente', 'Cuando un paciente saque turno o pida órdenes, lo vas a ver acá.')),
    hechos.length ? tarjeta('Últimos envíos', { icono: 'reloj', seccion: 'endoscopia' }, h('div.envios', ...hechos.map(item))) : null);
}

function editarEnvio(id, e, ctx) {
  const secs = JSON.parse(JSON.stringify(e.secciones || []));
  const caja = h('div.editor-envio');
  const pintar = () => caja.replaceChildren(...secs.map((s, i) => h('fieldset.ed-sec',
    h('div.ed-cab', h('input', { type: 'text', value: s[0], maxlength: 120, 'aria-label': 'Título de la sección', oninput: (ev) => { s[0] = ev.target.value; } }),
      h('button.btn-icono', { type: 'button', 'aria-label': 'Quitar sección', title: 'Quitar sección', onclick: () => { secs.splice(i, 1); pintar(); } }, icono('basura', { tam: 16 }))),
    h('textarea', { rows: Math.min(12, Math.max(3, s[1].length + 1)), 'aria-label': 'Texto (un renglón por punto)', value: s[1].join('\n'), oninput: (ev) => { s[1] = ev.target.value.split('\n').map((x) => x.trim()).filter(Boolean); } }))),
    h('button.btn.btn--suave', { type: 'button', onclick: () => { secs.push(['Nota del médico', ['']]); pintar(); } }, icono('mas', { tam: 15 }), 'Agregar una nota del médico'));
  pintar();
  const m = modal({
    titulo: `Editar · ${e.paciente || 'Paciente'}`, ancho: 860, clase: 'modal--texto',
    cuerpo: h('div', h('p.ayuda', 'Cada renglón es un punto de la lista. Los cambios valen solo para este paciente; para cambiar el texto de todos, usá las plantillas en Configuración.'), caja),
    acciones: [h('button.btn.btn--suave', { type: 'button', onclick: () => m.cerrar() }, 'Cancelar'),
      h('button.btn.btn--primario', { type: 'button', onclick: async () => { await D.guardarEdicionEnvio(id, secs.filter((s) => s[0].trim() && s[1].length)); m.cerrar(); toast('Cambios guardados: revisalo en PDF antes de aprobar', 'ok', 5000); } }, icono('ok', { tam: 16 }), 'Guardar cambios')],
  });
}

async function aprobarEnvio(id, e, ctx, btn) {
  if (!(await confirmar({ titulo: 'Aprobar y enviar', icono: 'campana', si: 'Enviar al paciente', texto: `Se le manda por correo a ${e.paciente || 'el paciente'} «${TIT_ENVIO[e.tipo] || e.tipo}» tal como lo ves en el PDF.` }))) return;
  btn.disabled = true;
  const { estado, creado, por, email, editado, ...datos } = e;
  const qr = e.codigo ? await qrPNG(urlTurno(e.codigo)).catch(() => null) : null;
  const r = await D.enviarCorreo({ ...datos, qr }).catch((er) => { console.warn(er); return { error: true }; });
  if (r?.error) { toast('No se pudo enviar. Revisá la conexión y el Apps Script.', 'error', 6000); btn.disabled = false; return; }
  if (r?.demo) buzonDemo({ tipo: e.tipo, t: turnoDe(ctx, e), secciones: e.secciones, paciente: e.paciente, config: ctx.config, email: e.email });
  await D.marcarEnviado(id, e);
  toast('Enviado al paciente', 'ok');
}

/** Ejemplo de lo que recibe un paciente, para revisar las plantillas antes de usarlas. */
function envioDeEjemplo(tipo, ctx, cfgActual) {
  const ahora = B().ahora();
  const fecha = E.fechasAbiertas(ctx.agenda, { ahora })[0] || E.diaISO(ahora + 7 * 86400000);
  const t = { tipo, fecha, hora: '0900', codigo: 'MTR-EJEM-PL42', estado: 'confirmado', reprogramaciones: 0, cupos: ['0900'] };
  const paciente = { nombre: 'Paciente', apellido: 'De Ejemplo', dni: '30123456', fechaNac: '1970-05-10' };
  const docs = E.documentos({ paciente, turno: t, datos: { antecedentes: {} }, config: cfgActual });
  const cfg = D.configCompleta(cfgActual);
  return { t, envio: { tipo: 'turno', estado: 'pendiente', paciente: 'Paciente De Ejemplo', codigo: t.codigo, secciones: seccionesDe({ docs, t }),
    ticket: { estudio: E.ESTUDIOS[tipo].nombre, fecha: E.fechaLarga(fecha), hora: E.hora(t.hora), presentarse: docs.presentarse, lugar: `${cfg.lugar.nombre}${cfg.lugar.direccion ? ', ' + cfg.lugar.direccion : ''}` } } };
}

function tabAgenda(ctx) {
  const cfg = D.configCompleta(ctx.config);
  const ahora = B().ahora();
  const st = { fecha: hoyISO(ahora + 86400000), desde: '08:00', hasta: '12:00', minutos: String(cfg.minutos || 30), repetir: '1' };
  const f = (etq, k, props) => { const c = campo(etq, { ...props, value: st[k] }); c.querySelector('input,select').addEventListener('input', (e) => { st[k] = e.target.value; }); c.querySelector('select')?.addEventListener('change', (e) => { st[k] = e.target.value; }); return c; };
  const btn = h('button.btn.btn--primario', { type: 'button' }, icono('mas', { tam: 16 }), 'Abrir fecha');
  btn.onclick = async () => {
    if (!st.fecha || st.fecha < hoyISO(ahora)) { toast('Elegí una fecha desde hoy', 'error'); return; }
    if (E.aMin(st.hasta.replace(':', '')) <= E.aMin(st.desde.replace(':', ''))) { toast('El horario de fin tiene que ser después del inicio', 'error'); return; }
    btn.disabled = true;
    const semanas = Math.max(1, Math.min(12, +st.repetir || 1));
    const ag = { ...ctx.agenda };
    for (let i = 0; i < semanas; i++) {
      const fe = E.diaISO(new Date(`${st.fecha}T12:00:00`).getTime() + i * 7 * 86400000);
      await D.abrirFecha(fe, st);
      ag[fe] = { desde: st.desde.replace(':', ''), hasta: st.hasta.replace(':', ''), minutos: +st.minutos };
    }
    const hechos = await D.asignarSuspendidos({ agenda: ag, ocupacion: JSON.parse(JSON.stringify(ctx.ocupacion || {})), turnos: ctx.turnos, ahora });
    toast(`${semanas === 1 ? 'Fecha abierta' : `${semanas} fechas abiertas`}${hechos.length ? ` · ${hechos.length} turno(s) suspendido(s) reprogramado(s)` : ''}`, 'ok', 6000);
    for (const x of hechos) reenviar({ ...x, t: { ...x.t, fecha: x.nuevo.fecha, hora: x.nuevo.hora, cupos: x.nuevo.cupos, estado: 'confirmado', reprogramaciones: (x.t.reprogramaciones || 0) + 1 } }, ctx);
    btn.disabled = false;
  };
  const fechas = Object.keys(ctx.agenda || {}).filter((fe) => fe >= hoyISO(ahora)).sort();
  return h('div.endo-med',
    tarjeta('Abrir una fecha para turnos', { icono: 'calendario', seccion: 'endoscopia' },
      h('div.grid-form',
        f('Fecha', 'fecha', { type: 'date', min: hoyISO(ahora) }), f('Desde', 'desde', { type: 'time', step: 300 }), f('Hasta', 'hasta', { type: 'time', step: 300 }),
        f('Duración de cada cupo', 'minutos', { type: 'select', opciones: [['20', '20 min'], ['30', '30 min'], ['40', '40 min'], ['45', '45 min'], ['60', '60 min']] }),
        f('Repetir', 'repetir', { type: 'select', opciones: [['1', 'Solo esa fecha'], ['4', 'Mismo día 4 semanas'], ['8', 'Mismo día 8 semanas'], ['12', 'Mismo día 12 semanas']] })),
      h('p.ayuda', 'El turno simple (VEDA o VCC) usa 1 cupo; el doble (VEDA + VCC), 2 cupos seguidos. Al abrir fechas, los turnos suspendidos se reprograman solos.'),
      h('div.botones', btn)),
    tarjeta('Fechas abiertas', { icono: 'ticket', seccion: 'endoscopia' },
      fechas.length ? h('ul.agenda-lista', ...fechas.map((fe) => {
        const dia = ctx.agenda[fe];
        const cupos = E.cuposDe(dia);
        const ocup = Object.keys(ctx.ocupacion?.[fe] || {}).length;
        return h('li', { class: dia.cerrada ? 'cerrada' : '' },
          h('div', h('strong', E.fechaLarga(fe)), h('small', dia.cerrada ? 'Cerrada' : `${E.hora(dia.desde)} a ${E.hora(dia.hasta)} · cupos de ${dia.minutos} min`)),
          dia.cerrada ? chip('Cerrada', 'neutro') : h('div.agenda-barra', { title: `${ocup} de ${cupos.length} cupos ocupados` }, h('i', { style: { width: `${cupos.length ? (ocup / cupos.length) * 100 : 0}%` } }), h('span.num', `${ocup}/${cupos.length}`)),
          dia.cerrada ? null : h('button.btn.btn--suave', { type: 'button', onclick: async () => {
            if (!(await confirmar({ titulo: 'Cerrar fecha', texto: `Se cierra el ${E.fechaLarga(fe)}. ${ocup ? 'Los turnos de ese día se suspenden y se reprograman solos para el próximo día con lugar (les llega el correo).' : 'No tiene turnos.'}`, si: 'Cerrar fecha', peligro: true }))) return;
            const movidos = await D.cerrarFecha(fe, { agenda: ctx.agenda, ocupacion: JSON.parse(JSON.stringify(ctx.ocupacion || {})), turnos: ctx.turnos, ahora });
            toast(`Fecha cerrada${movidos.length ? ` · ${movidos.filter((m) => m.nuevo).length} reprogramado(s), ${movidos.filter((m) => !m.nuevo).length} suspendido(s)` : ''}`, 'ok', 7000);
            for (const x of movidos.filter((m) => m.nuevo)) reenviar({ ...x, t: { ...x.t, fecha: x.nuevo.fecha, hora: x.nuevo.hora, cupos: x.nuevo.cupos, estado: 'confirmado', reprogramaciones: (x.t.reprogramaciones || 0) + 1 } }, ctx);
          } }, 'Cerrar'));
      })) : h('p.ayuda', 'No hay fechas abiertas.')));
}

function tabAdmision(ctx) {
  const res = h('div.admision-res');
  const input = h('input.admision-input', { type: 'text', placeholder: 'MTR-XXXX-XXXX', autocomplete: 'off', autocapitalize: 'characters', 'aria-label': 'Código del turno', value: M.buscar });
  const buscar = (txt) => {
    const m = String(txt).match(/MTR-?[0-9A-Z]{4}-?[0-9A-Z]{4}/i);
    const c = E.normalizarCodigo(m ? m[0] : txt);
    input.value = c; M.buscar = c;
    const x = listaTurnos(ctx.turnos).find((y) => y.t.codigo === c);
    res.replaceChildren(x ? h('div', ticket(x.t, { config: ctx.config, paciente: x.t.paciente?.n, chico: true }), filaTurno(x, ctx), selloConsentimiento(x.t))
      : aviso('peligro', E.codigoValido(c) ? 'No hay ningún turno con ese código.' : 'El código tiene el formato MTR-XXXX-XXXX.'));
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') buscar(input.value); });
  let lector = null;
  const camara = puedeEscanear() ? h('button.btn.btn--suave', { type: 'button', onclick: () => {
    lector?.detener();
    lector = lectorQR((txt) => { cam.replaceChildren(); buscar(txt); });
    cam.replaceChildren(lector.el);
  } }, icono('qr', { tam: 16 }), 'Escanear con la cámara') : null;
  const foto = h('label.btn.btn--suave.subir-firma', icono('imagen', { tam: 16 }), 'Sacar foto del QR',
    h('input', { type: 'file', accept: 'image/*', capture: 'environment', onchange: async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { const txt = await leerQRImagen(f); if (txt) buscar(txt); else toast('No se encontró un QR en la foto. Probá más cerca y con luz.', 'error'); }
      catch { toast('No se pudo leer la foto', 'error'); }
      e.target.value = '';
    } }));
  const cam = h('div');
  if (M.buscar) queueMicrotask(() => buscar(M.buscar));
  return h('div.endo-med',
    tarjeta('Validar el ticket del paciente', { icono: 'qr', seccion: 'endoscopia' },
      h('p.ayuda', 'Escaneá el QR o escribí el código. Si el turno está confirmado, tocá «Admitir»; al terminar, «Realizado / egreso». El paciente ve el cambio al instante.'),
      h('div.admision-busca', input, h('button.btn.btn--primario', { type: 'button', onclick: () => buscar(input.value) }, icono('buscar', { tam: 16 }), 'Buscar'), camara, foto),
      cam, res));
}

function tabConfig(ctx) {
  const cfg = D.configCompleta(ctx.config);
  const st = JSON.parse(JSON.stringify(cfg));
  const f = (etq, ruta, props = {}, extra) => {
    const [a, b] = ruta.split('.');
    const c = campo(etq, { ...props, value: b ? st[a][b] : st[a] }, extra);
    const el = c.querySelector('input,select');
    const set = (e) => { if (b) st[a][b] = e.target.value; else st[a] = e.target.value; };
    el.addEventListener('input', set); el.addEventListener('change', set);
    return c;
  };
  const firmaPrev = h('div.firma-prev', st.medico.firma ? h('img', { src: st.medico.firma, alt: 'Firma actual' }) : h('small', 'Sin firma cargada'));
  const firma = panelFirma();
  const archivo = h('input', { type: 'file', accept: 'image/png,image/jpeg', onchange: async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const img = new Image(); img.src = URL.createObjectURL(file); await img.decode();
    const k = Math.min(1, 420 / img.width); const cv = document.createElement('canvas'); cv.width = img.width * k; cv.height = img.height * k;
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    st.medico.firma = cv.toDataURL('image/png'); firmaPrev.replaceChildren(h('img', { src: st.medico.firma, alt: 'Firma nueva' }));
  } });
  const autoriza = h('input', { type: 'checkbox', checked: !!st.autorizaOrdenes });
  const btn = h('button.btn.btn--primario.btn--grande', { type: 'button' }, icono('ok', { tam: 16 }), 'Guardar configuración');
  btn.onclick = async () => {
    if (!firma.vacia()) st.medico.firma = firma.png();
    st.autorizaOrdenes = autoriza.checked;
    st.validez = Object.fromEntries(Object.entries(st.validez).map(([k, v]) => [k, Math.max(7, Math.min(365, +v || E.VALIDEZ_DEFECTO[k]))]));
    st.minutos = +st.minutos || 30;
    if (st.autorizaOrdenes && (!st.medico.nombre || !st.medico.firma)) { toast('Para emitir órdenes hacen falta el nombre y la firma del médico', 'error'); return; }
    btn.disabled = true;
    try { await D.guardarConfig(st); toast('Configuración guardada', 'ok'); } catch (e) { console.error(e); toast('No se pudo guardar', 'error'); }
    btn.disabled = false;
  };
  return h('div.endo-med',
    tarjeta('Médico actuante', { icono: 'estetoscopio', seccion: 'endoscopia' },
      h('div.grid-form', f('Nombre y apellido', 'medico.nombre', { maxlength: 80, placeholder: 'Dr. Nombre Apellido' }, { ayuda: 'Como va en el sello.' }), f('Matrícula', 'medico.matricula', { maxlength: 40, placeholder: 'MN 000000' }, { ayuda: 'Nacional o provincial.' }), f('Especialidad', 'medico.especialidad', { maxlength: 80 }, { ayuda: 'Figura en las órdenes.' })),
      h('div.grid-2.firma-grid',
        h('div.campo', h('label', 'Firma actual'), firmaPrev, h('label.btn.btn--suave.subir-firma', icono('subir', { tam: 15 }), 'Subir imagen de la firma', archivo)),
        h('div.campo', h('label', 'O firmá acá'), firma.el)),
      h('label.check.check--legal', autoriza, h('span', h('strong', 'Autorizo que la app emita con mi firma las órdenes de prequirúrgico '), '(laboratorio, ECG con lectura cardiológica e interconsulta con Anestesiología) a los pacientes que las pidan al sacar turno de endoscopia.'))),
    tarjeta('Lugar y preparación', { icono: 'inicio', seccion: 'endoscopia' },
      h('div.grid-form', f('Nombre del servicio', 'lugar.nombre', { maxlength: 80 }), f('Dirección', 'lugar.direccion', { maxlength: 120 }),
        f('Preparación para colonoscopia', 'preparacion', { type: 'select', opciones: Object.entries(E.PREPARACIONES).map(([k, p]) => [k, p.nombre]) }),
        f('Preparación para rectoscopia', 'prepRsc', { type: 'select', opciones: Object.entries(E.PREP_RSC).map(([k, p]) => [k, p.nombre]) }),
        f('Duración de cupo por defecto (min)', 'minutos', { type: 'number', maxlength: 3 })),
      aviso('info', 'Fosfo-Dom (fosfato de sodio): la guía ESGE no lo recomienda de rutina por el riesgo de daño renal. Si lo elegís, la app avisa en cada turno de pacientes de 65 años o más, o con enfermedad renal o cardíaca, para cambiarlo por polietilenglicol.'),
      h('label.check', h('input', { type: 'checkbox', checked: !!st.rscSedacion, onchange: (e) => { st.rscSedacion = e.target.checked; } }), h('span', 'La rectoscopia se hace con sedación (pide prequirúrgico y acompañante)'))),
    tarjeta('Lo que recibe el paciente', { icono: 'campana', seccion: 'endoscopia' },
      h('label.check.check--legal', h('input', { type: 'checkbox', checked: st.revisarEnvios !== false, onchange: (e) => { st.revisarEnvios = e.target.checked; } }),
        h('span', h('strong', 'Revisar cada envío antes de mandarlo. '), 'La confirmación del turno, las órdenes y las reprogramaciones esperan en «Envíos» hasta que las apruebes.')),
      h('p.ayuda', 'Plantillas: agregá tus indicaciones para cada estudio (se suman a la preparación y a las recomendaciones) y mirá el resultado en PDF o Word antes de guardar.'),
      h('div.plantillas', ...Object.values(E.ESTUDIOS).map((e) => h('div.plantilla', { style: { '--c1': e.c1, '--c2': e.c2 } },
        h('strong', `${e.corto} · ${e.nombre}`),
        h('textarea', { rows: 3, maxlength: 1500, placeholder: 'Indicaciones propias del consultorio (opcional)', value: st.extra?.[e.id] || '', oninput: (ev) => { st.extra = { ...(st.extra || {}), [e.id]: ev.target.value }; } }),
        h('div.botones',
          h('button.btn.btn--suave', { type: 'button', onclick: () => { const x = envioDeEjemplo(e.id, ctx, st); imprimir(hojaEnvio(x.envio, { t: x.t, config: st }), `Plantilla ${e.corto}`); } }, icono('pdf', { tam: 15 }), 'Ver PDF'),
          h('button.btn.btn--suave', { type: 'button', onclick: () => wordEnvio(envioDeEjemplo(e.id, ctx, st).envio, { config: st }) }, icono('texto', { tam: 15 }), 'Word')))))),
    tarjeta('Vigencia del prequirúrgico', { icono: 'reloj', seccion: 'endoscopia' },
      h('div.grid-form', f('Análisis de sangre', 'validez.analitica', { type: 'number', maxlength: 3 }, { sufijo: 'días' }), f('ECG con informe', 'validez.ecg', { type: 'number', maxlength: 3 }, { sufijo: 'días' }), f('Valoración anestesiológica', 'validez.anestesia', { type: 'number', maxlength: 3 }, { sufijo: 'días' }))),
    h('div.botones', btn));
}
