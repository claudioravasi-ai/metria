/* ============================================================
   Acceso
   - Portada: vitrina animada, calculadora para probar sin registrarse,
     funciones y las dos puertas (paciente / profesional).
   - Pacientes: SIN contraseña. Alta con nombre, apellido, DNI y correo;
     la app manda un código de 6 números al correo (valida el correo) y
     después se completan los datos. Cada ingreso pide un código nuevo,
     que vence y sirve una sola vez.
   - Profesionales: correo y contraseña; quedan pendientes hasta que el
     coordinador los autoriza.
   Los mensajes de error no revelan si un correo está registrado.
   ============================================================ */

import { h, montar } from '../core/dom.js';
import { icono } from '../core/iconos.js';
import { toast, aviso, chip, fmt, fmt0 } from '../core/ui.js';
import { CONFIG } from '../config.js';
import { backend, registrarMedico, pedirCodigo, ingresarConCodigo, completarAltaPaciente } from '../data/servicio.js';
import { campo, segmentado, fuerzaClave, deslizador } from '../ui/campos.js';
import * as G from '../ui/graficos.js';
import { inclinar, revelar, contar, ecg } from '../ui/efectos.js';
import * as A from '../engine/anthro.js';
import * as R from '../engine/risk.js';
import { logo, alternarTema, barraDemo } from './shell.js';
import { POLITICA, TERMINOS, verTexto } from './legal.js';
import { DEMO } from '../data/semilla.js';

const raiz = () => document.getElementById('app');
const MSG = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/wrong-password': 'Correo o contraseña incorrectos.',
  'auth/user-not-found': 'Correo o contraseña incorrectos.',
  'auth/too-many-requests': 'Demasiados intentos. Esperá unos minutos y volvé a probar.',
  'auth/email-already-in-use': 'No pudimos crear la cuenta con ese correo. Si ya tenés una, ingresá o recuperá la contraseña.',
  'auth/weak-password': 'La contraseña es demasiado débil.',
  'auth/invalid-email': 'El correo no es válido.',
  'auth/network-request-failed': 'Sin conexión. Revisá internet e intentá de nuevo.',
  'codigo/vencido': 'El código venció o ya se usó. Pedí uno nuevo.',
  'codigo/incorrecto': 'El código no es correcto. Revisalo e intentá de nuevo.',
  'codigo/bloqueado': 'Demasiados intentos. Pedí un código nuevo.',
  'codigo/espera': 'Esperá un minuto antes de pedir otro código.',
  'codigo/demasiados': 'Pediste muchos códigos seguidos. Probá de nuevo en una hora.',
  'codigo/cupo': 'Hoy se alcanzó el límite de correos del consultorio. Probá mañana o comunicate con el consultorio.',
  'codigo/correo': 'Revisá el correo.',
  'codigo/sin-servidor': 'El ingreso con código todavía no está configurado en este consultorio.',
  'codigo/es-profesional': 'Ese correo es de una cuenta profesional: ingresá por «Soy profesional».',
  'alta/correo': 'El correo no coincide con el que validaste con el código.',
};
const mensaje = (e) => MSG[e?.code] || 'No se pudo completar. Intentá de nuevo.';
const correoValido = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(e || '').trim());
const enmascarar = (e) => { const [u, d] = String(e).split('@'); return `${u.slice(0, 1)}${'•'.repeat(Math.max(2, u.length - 2))}${u.length > 1 ? u.slice(-1) : ''}@${d}`; };
const guardarTemp = (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } };
const leerTemp = (k) => { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch { return null; } };

function pantalla(...contenido) {
  const vista = montar(raiz(), h('div.acceso', barraDemo(() => location.reload()),
    h('div.acceso-fondo', h('i'), h('i'), h('i'), h('i')),
    h('header.acceso-top', h('button.logo-boton', { type: 'button', 'aria-label': 'Ir a la portada', onclick: portada }, logo()),
      h('nav.acceso-nav',
        h('button.btn-link.solo-ancho', { type: 'button', onclick: () => ingresoPaciente() }, 'Pacientes'),
        h('button.btn-link.solo-ancho', { type: 'button', onclick: () => ingresoProfesional() }, 'Profesionales'),
        h('button.btn-icono', { type: 'button', 'aria-label': 'Cambiar tema', onclick: alternarTema }, icono('luna')))),
    h('main.acceso-main', ...contenido),
    h('footer.acceso-pie',
      h('button.btn-link', { type: 'button', onclick: () => verTexto('Política de privacidad', POLITICA()) }, 'Privacidad'),
      h('span', '·'), h('button.btn-link', { type: 'button', onclick: () => verTexto('Términos de uso', TERMINOS()) }, 'Términos'),
      h('span', '·'), h('span', 'Emergencias: 107'))));
  revelar(vista);
  window.scrollTo(0, 0);
  return vista;
}

/* ======================= PORTADA ======================= */

/** Vitrina: un "teléfono" de vidrio que muestra la app funcionando con perfiles de ejemplo. */
function vitrina() {
  const perfiles = [
    { nombre: 'Laura, 46', peso: 89, talla: 164, edad: 46, sexo: 'F', pas: 134, ct: 218, hdl: 44, tratHta: true },
    { nombre: 'Roberto, 60', peso: 113, talla: 176, edad: 60, sexo: 'M', pas: 142, ct: 182, hdl: 38, tratHta: true, dm: true },
    { nombre: 'Sofía, 29', peso: 63, talla: 166, edad: 29, sexo: 'F', pas: 112, ct: 176, hdl: 62 },
  ];
  const imc = G.medidor({ min: 14, max: 45, unidad: 'IMC', formato: (v) => fmt(v, 1), bandas: A.CATS_IMC.map((c) => ({ desde: Math.max(14, c.min), hasta: Math.min(45, c.max), color: c.color, nombre: c.nombre })), marcas: [18.5, 25, 30, 35, 40] });
  const ring = G.anillo({ max: 3600, etiqueta: 'Gasto diario', unidad: 'kcal/día' });
  const riesgo = G.escala({ segmentos: [
    { desde: 0, hasta: 5, color: '#22c55e', nombre: 'Bajo' }, { desde: 5, hasta: 7.5, color: '#eab308', nombre: 'Limítrofe' },
    { desde: 7.5, hasta: 20, color: '#f97316', nombre: 'Intermedio' }, { desde: 20, hasta: 50, color: '#ef4444', nombre: 'Alto' }] });
  const nombre = h('strong', '');
  const puntos = h('div.vitrina-puntos', ...perfiles.map(() => h('i')));
  let n = 0, timer;
  const mostrar = (i) => {
    n = i;
    const p = perfiles[i];
    const e = A.energia({ ...p, actividad: 'ligera' });
    imc.set(A.imc(p.peso, p.talla), A.categoriaImc(A.imc(p.peso, p.talla)).nombre);
    ring.set(e.get, e.tmb); ring.etiqueta(`Basal ${fmt0(e.tmb)} kcal`);
    const r = R.prevent({ ...p, estatina: false, tabaco: false, tfg: 90, imc: A.imc(p.peso, p.talla) });
    riesgo.set(r.cvd10);
    nombre.textContent = p.nombre;
    puntos.querySelectorAll('i').forEach((el, k) => el.classList.toggle('activo', k === i));
  };
  const ciclo = () => { clearInterval(timer); timer = setInterval(() => { if (!document.body.contains(caja)) { clearInterval(timer); return; } mostrar((n + 1) % perfiles.length); }, 3600); };
  puntos.querySelectorAll('i').forEach((el, k) => el.addEventListener('click', () => { mostrar(k); ciclo(); }));
  const caja = h('div.vitrina', { 'aria-label': 'Demostración animada de la app con pacientes ficticios' },
    h('div.vitrina-cab', h('span.vivo-punto'), h('span', 'En vivo · ejemplo: '), nombre),
    h('div.vitrina-bloque.vitrina-imc', imc.el),
    h('div.vitrina-fila', h('div.vitrina-bloque.vitrina-ring', ring.el), h('div.vitrina-bloque.vitrina-riesgo', h('small', 'Riesgo cardiovascular a 10 años (PREVENT)'), riesgo.el)),
    puntos);
  queueMicrotask(() => { mostrar(0); ciclo(); });
  return inclinar(h('div.vitrina-marco', h('div.vitrina-brillo'), caja), 6);
}

/** Calculadora para probar sin registrarse (nada se guarda). */
function probalo() {
  const st = { sexo: 'F', edad: 40, peso: 72, talla: 165, actividad: 'ligera' };
  const gauge = G.medidor({ min: 14, max: 45, unidad: 'kg/m²', etiqueta: 'Índice de masa corporal', formato: (v) => fmt(v, 1), bandas: A.CATS_IMC.map((c) => ({ desde: Math.max(14, c.min), hasta: Math.min(45, c.max), color: c.color, nombre: c.nombre })), marcas: [18.5, 25, 30, 35, 40] });
  const tmb = G.numero((v) => fmt0(v), 'num.enorme');
  const get = G.numero((v) => fmt0(v), 'num.enorme');
  const rango = h('span.num');
  const recalcular = () => {
    const b = A.imc(st.peso, st.talla);
    gauge.set(b, A.categoriaImc(b).nombre);
    const e = A.energia(st);
    tmb.set(e.tmb); get.set(e.get);
    const r = A.rangoPesoSaludable(st.talla);
    rango.textContent = `${fmt(r.min, 1)} – ${fmt(r.max, 1)} kg`;
  };
  const sl = (etq, k, min, max, paso, u, ic) => deslizador({ etiqueta: etq, min, max, paso, valor: st[k], unidad: u, icono: ic, onInput: (v) => { st[k] = v; recalcular(); } }).el;
  queueMicrotask(recalcular);
  return h('section.probalo', { 'data-revelar': '' },
    h('div.seccion-titulo', h('span.portada-etiqueta', icono('rayo', { tam: 14 }), 'Probalo ahora'), h('h2', 'Mové los controles y mirá tu cuerpo en números'), h('p', 'Sin registrarte y sin guardar nada: es el mismo motor que usa la app.')),
    h('div.probalo-grid',
      h('div.probalo-controles',
        h('div.control', h('div.control-cab', h('label', 'Sexo biológico')), segmentado([{ valor: 'F', texto: 'Mujer' }, { valor: 'M', texto: 'Varón' }], 'F', (v) => { st.sexo = v; recalcular(); })),
        sl('Edad', 'edad', 18, 90, 1, 'años', 'calendario'), sl('Peso', 'peso', 40, 180, 0.5, 'kg', 'balanza'), sl('Talla', 'talla', 140, 205, 1, 'cm', 'cinta'),
        h('div.control', h('div.control-cab', h('label', 'Actividad')), segmentado(A.ACTIVIDAD.map((a) => ({ valor: a.id, texto: a.nombre })), 'ligera', (v) => { st.actividad = v; recalcular(); }, { pequeno: true }))),
      h('div.probalo-resultado',
        h('div.probalo-gauge', gauge.el),
        h('div.probalo-kpis',
          h('div.kpi-vidrio', { style: { '--c1': '#f97316', '--c2': '#facc15' } }, h('small', 'Metabolismo basal'), tmb.el, h('span', 'kcal por día')),
          h('div.kpi-vidrio', { style: { '--c1': '#f43f5e', '--c2': '#fb923c' } }, h('small', 'Gasto total'), get.el, h('span', 'kcal por día'))),
        h('p.probalo-rango', icono('objetivo', { tam: 16 }), 'Peso saludable para tu talla: ', rango))));
}

export function portada() {
  const B = backend();
  const palabras = ['clara y en vivo', 'precisa', 'segura', 'en tus manos'];
  const rotador = h('span.grad.rotador', palabras[0]);
  let k = 0;
  const giro = setInterval(() => {
    if (!document.body.contains(rotador)) { clearInterval(giro); return; }
    k = (k + 1) % palabras.length;
    rotador.classList.add('rotador--sale');
    setTimeout(() => { rotador.textContent = palabras[k]; rotador.classList.remove('rotador--sale'); }, 320);
  }, 2800);

  const funciones = [
    ['llama', 'Metabolismo', 'Gasto basal y total con tres fórmulas, en vivo mientras movés los controles.', '#f97316', '#facc15'],
    ['cuerpo', 'Cuerpo', 'IMC con aguja, silueta que cambia, grasa estimada y tu evolución.', '#14b8a6', '#22c55e'],
    ['corazon', 'Corazón', 'Riesgo a 10 y 30 años con PREVENT (AHA) y un simulador «¿y si…?».', '#f43f5e', '#fb923c'],
    ['matraz', 'Laboratorio', 'Cada valor en colores, con filtrado renal, HOMA, FIB-4 y más.', '#8b5cf6', '#d946ef'],
    ['jeringa', 'Tratamiento', 'Plan de tu médico con calendario de dosis y proyección de peso.', '#2563eb', '#06b6d4'],
    ['carpeta', 'Estudios', 'Tus estudios protegidos: los ves, los descargás y se borran a los 3 días.', '#10b981', '#84cc16'],
  ];
  const tarjeta = ([ic, t, d, c1, c2]) => inclinar(h('article.funcion', { 'data-revelar': '', style: { '--c1': c1, '--c2': c2 } },
    h('span.funcion-gema', icono(ic, { tam: 26 })), h('h3', t), h('p', d), h('span.funcion-brillo')), 8);

  const puerta = (rol, titulo, texto, ic, c1, c2, items, accion) => inclinar(h('button.puerta', { type: 'button', 'data-revelar': '', style: { '--c1': c1, '--c2': c2 }, onclick: accion },
    h('span.puerta-gema', icono(ic, { tam: 30 })),
    h('strong', titulo), h('p', texto),
    h('ul.puerta-lista', ...items.map((t) => h('li', icono('ok', { tam: 15 }), t))),
    h('span.puerta-ir', 'Ingresar', icono('flechaDer', { tam: 18 }))), 5);

  const datoContado = (n, suf, txt) => { const el = h('strong.num'); contar(el, n, (v) => `${Math.round(v)}${suf}`); return h('div.cifra', { 'data-revelar': '' }, el, h('span', txt)); };

  pantalla(
    h('section.hero-portada',
      h('div.hero-izq',
        h('div.portada-logo', logo('grande')),
        h('span.portada-etiqueta', icono('chispa', { tam: 14 }), 'Motor clínico en tiempo real'),
        h('h1', 'Tu salud cardiometabólica, ', h('br.solo-ancho'), rotador),
        h('p.hero-bajada', 'Metabolismo, cuerpo, corazón, laboratorio, tratamiento y estudios médicos. Todo calculado al instante con las fórmulas que usan los médicos.'),
        h('div.hero-cta',
          h('button.btn.btn--primario.btn--grande.btn--brillo', { type: 'button', onclick: () => ingresoPaciente() }, icono('usuario', { tam: 18 }), 'Soy paciente'),
          h('button.btn.btn--vidrio.btn--grande', { type: 'button', onclick: () => ingresoProfesional() }, icono('estetoscopio', { tam: 18 }), 'Soy profesional')),
        h('div.hero-sellos', chip('PREVENT · AHA 2023', 'info', 'corazon'), chip('Ley 25.326', 'ok', 'escudo'), chip('Sin contraseñas para pacientes', 'neutro', 'candado'))),
      h('div.hero-der', vitrina()),
      ecg({ clase: 'hero-ecg' })),
    h('section.cifras', datoContado(10, ' s', 'para ver tu riesgo'), datoContado(30, ' años', 'de proyección del riesgo'), datoContado(6, '', 'tratamientos comparados'), datoContado(72, ' h', 'y tus estudios se borran')),
    probalo(),
    h('section.funciones-sec',
      h('div.seccion-titulo', { 'data-revelar': '' }, h('span.portada-etiqueta', icono('estrella', { tam: 14 }), 'Todo en un lugar'), h('h2', 'Seis secciones, un color para cada una')),
      h('div.funciones', ...funciones.map(tarjeta))),
    h('section.puertas-sec',
      h('div.seccion-titulo', { 'data-revelar': '' }, h('h2', '¿Cómo querés entrar?')),
      h('div.puertas',
        puerta('paciente', 'Soy paciente', 'Creá tu cuenta en un minuto, sin contraseña.', 'usuario', '#06b6d4', '#6366f1',
          ['Te llega un código a tu correo', 'Tus cálculos y tu tratamiento', 'Tus estudios con aviso de privacidad'], () => ingresoPaciente()),
        puerta('medico', 'Soy profesional', 'Ingreso con matrícula, autorizado por el coordinador.', 'estetoscopio', '#f43f5e', '#8b5cf6',
          ['Ficha completa y motor GLP-1', 'Carga de estudios', 'Solo con autorización del coordinador'], () => ingresoProfesional()))),
    B.modo === 'demo' ? h('section.demo-accesos', { 'data-revelar': '' },
      h('h3', 'Probar con datos de ejemplo'),
      h('div.botones',
        h('button.btn.btn--suave', { type: 'button', onclick: () => { guardarTemp('metria-puerta', null); sessionStorage.setItem('metria-puerta', 'paciente'); B.entrarComo(DEMO.paciente.uid, DEMO.paciente.email, true); } }, icono('usuario', { tam: 16 }), 'Entrar como paciente de ejemplo'),
        h('button.btn.btn--suave', { type: 'button', onclick: () => { sessionStorage.setItem('metria-puerta', 'medico'); B.entrarComo(DEMO.medico.uid, DEMO.medico.email); } }, icono('estetoscopio', { tam: 16 }), 'Entrar como coordinadora de ejemplo')),
      h('p.ayuda', 'Personas ficticias. Los datos quedan solo en este navegador.')) : null);
}

/* ======================= PACIENTES: CÓDIGO POR CORREO ======================= */

function pasos(actual) {
  const items = ['Tus datos', 'Código', 'Completar'];
  return h('ol.pasos-alta', ...items.map((t, i) => h(`li${i < actual ? '.hecho' : i === actual ? '.actual' : ''}`, h('span', i < actual ? icono('ok', { tam: 14 }) : String(i + 1)), t)));
}

function tarjetaAcceso(rol, titulo, sub, ...cont) {
  const med = rol === 'medico';
  const sinVolver = rol === 'paciente-sesion'; // con la sesión abierta no se vuelve a la portada (se sale con «Cancelar y salir»)
  return h('section.acceso-card', { style: { '--c1': med ? '#f43f5e' : '#06b6d4', '--c2': med ? '#8b5cf6' : '#6366f1' } },
    sinVolver ? null : h('button.btn-link.volver', { type: 'button', onclick: portada }, icono('flechaIzq', { tam: 16 }), 'Volver'),
    h('div.acceso-cab', h('span.puerta-gema', icono(med ? 'estetoscopio' : 'usuario', { tam: 26 })), h('div', h('h2', titulo), h('p', sub))),
    ...cont);
}

/** Ingreso de pacientes: correo → código. */
export function ingresoPaciente(emailInicial = '') {
  const email = h('input', { type: 'email', autocomplete: 'email', id: 'pac-email', value: emailInicial, inputmode: 'email' });
  const error = h('div.form-error', { role: 'alert' });
  const btn = h('button.btn.btn--primario.btn--grande.btn--bloque.btn--brillo', { type: 'submit' }, icono('flechaDer', { tam: 18 }), 'Enviarme el código');
  const form = h('form.form-acceso', { novalidate: true },
    h('div.campo', h('label', { for: 'pac-email' }, 'Tu correo electrónico'), email),
    h('p.ayuda', 'No usás contraseña: cada vez que entrás te mandamos un código de 6 números que sirve una sola vez.'),
    error, btn,
    h('div.form-links', h('span.ayuda', '¿Primera vez?'), h('button.btn-link', { type: 'button', onclick: registroPaciente }, 'Crear mi cuenta')));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.textContent = '';
    if (!correoValido(email.value)) { error.textContent = 'Revisá el correo.'; return; }
    btn.disabled = true;
    try {
      const r = await pedirCodigo(email.value);
      sessionStorage.setItem('metria-puerta', 'paciente');
      guardarTemp('metria-correo', email.value.trim().toLowerCase());
      pasoCodigo({ email: email.value.trim().toLowerCase(), demo: r?.demo, alta: false });
    } catch (er) { error.textContent = mensaje(er); btn.disabled = false; }
  });
  pantalla(tarjetaAcceso('paciente', 'Ingreso de pacientes', 'Entrá con un código que te llega al correo.', form));
  setTimeout(() => email.focus(), 60);
}

/** Paso del código (sirve para el alta y para el ingreso). */
function pasoCodigo({ email, demo, alta }) {
  const cajas = Array.from({ length: 6 }, (_, i) => h('input.otp', { type: 'text', inputmode: 'numeric', autocomplete: i ? 'off' : 'one-time-code', 'aria-label': `Dígito ${i + 1} del código` }));
  const recordar = h('input', { type: 'checkbox', id: 'pac-rec' });
  const error = h('div.form-error', { role: 'alert' });
  const btn = h('button.btn.btn--primario.btn--grande.btn--bloque.btn--brillo', { type: 'submit' }, 'Ingresar');
  const reenviar = h('button.btn-link', { type: 'button', disabled: true }, 'Reenviar código');
  let resto = 60;
  const t = setInterval(() => {
    resto--;
    if (!document.body.contains(reenviar)) { clearInterval(t); return; }
    reenviar.textContent = resto > 0 ? `Reenviar código (${resto} s)` : 'Reenviar código';
    reenviar.disabled = resto > 0;
    if (resto <= 0) clearInterval(t);
  }, 1000);
  const valor = () => cajas.map((c) => c.value).join('');
  const llenar = (txt) => { const d = String(txt).replace(/\D/g, '').slice(0, 6).split(''); cajas.forEach((c, i) => { c.value = d[i] || ''; }); (cajas[Math.min(d.length, 5)]).focus(); if (d.length === 6) form.requestSubmit(); };
  cajas.forEach((c, i) => {
    c.addEventListener('input', () => {
      const d = c.value.replace(/\D/g, '');
      if (d.length > 1) { llenar(cajas.slice(0, i).map((x) => x.value).join('') + d); return; }
      c.value = d;
      if (d && i < 5) cajas[i + 1].focus();
      if (valor().length === 6) form.requestSubmit();
    });
    c.addEventListener('keydown', (e) => { if (e.key === 'Backspace' && !c.value && i) { cajas[i - 1].focus(); cajas[i - 1].value = ''; } });
    c.addEventListener('paste', (e) => { e.preventDefault(); llenar(e.clipboardData.getData('text')); });
  });
  const buzonDemo = demo ? h('div.buzon-demo', { role: 'note' },
    h('div.buzon-cab', icono('campana', { tam: 16 }), h('strong', 'Correo de prueba'), h('small', 'en la demo no se envían correos')),
    h('p', 'Asunto: Tu código de ingreso a Metria'),
    h('div.buzon-codigo.num', demo),
    h('button.btn.btn--suave', { type: 'button', onclick: () => llenar(demo) }, 'Usar este código')) : null;
  const form = h('form.form-acceso', { novalidate: true },
    alta ? pasos(1) : null,
    h('p.codigo-a', 'Te mandamos un código de 6 números a ', h('strong', enmascarar(email)), '. Vence en ', `${CONFIG.minutosCodigo} minutos.`),
    buzonDemo,
    h('div.otp-fila', ...cajas),
    h('label.check', recordar, h('span', 'Recordarme en este equipo'), h('small', 'Marcalo en tu teléfono personal; nunca en computadoras compartidas.')),
    error, btn,
    h('div.form-links', reenviar, h('button.btn-link', { type: 'button', onclick: () => (alta ? registroPaciente() : ingresoPaciente(email)) }, 'Cambiar el correo')),
    h('p.ayuda', '¿No llega? Revisá la carpeta de correo no deseado o promociones.'));
  reenviar.onclick = async () => {
    reenviar.disabled = true;
    try { const r = await pedirCodigo(email); toast('Te mandamos un código nuevo', 'ok'); pasoCodigo({ email, demo: r?.demo, alta }); }
    catch (er) { error.textContent = mensaje(er); }
  };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.textContent = '';
    if (valor().length !== 6) { error.textContent = 'Completá los 6 números.'; return; }
    btn.disabled = true; btn.textContent = 'Verificando…';
    try { await ingresarConCodigo(email, valor(), recordar.checked); }
    catch (er) {
      error.textContent = mensaje(er);
      btn.disabled = false; btn.textContent = 'Ingresar';
      form.classList.remove('sacudir'); void form.offsetWidth; form.classList.add('sacudir');
      cajas.forEach((c) => { c.value = ''; }); cajas[0].focus();
    }
  });
  pantalla(tarjetaAcceso('paciente', 'Revisá tu correo', 'Ingresá el código para continuar.', form));
  setTimeout(() => cajas[0].focus(), 80);
}

/** Alta de pacientes, paso 1: nombre, apellido, DNI y correo (+ consentimiento). */
export function registroPaciente() {
  const previo = leerTemp('metria-alta') || {};
  const d = { ...previo };
  const err = h('div.form-error', { role: 'alert' });
  const f = (etq, k, props = {}, extra = {}) => {
    const c = campo(etq, { ...props, name: k, value: d[k] || '' }, { requerido: true, ...extra });
    c.querySelector('input').addEventListener('input', (e) => { d[k] = e.target.value; });
    return c;
  };
  const consent = [
    ['datos', h('span', 'Acepto la ', h('button.btn-link', { type: 'button', onclick: () => verTexto('Política de privacidad', POLITICA()) }, 'política de privacidad'), ' y presto consentimiento expreso para el tratamiento de mis datos de salud con fines de atención médica (Ley 25.326, arts. 5 y 7).')],
    ['transf', h('span', 'Entiendo que los datos se alojan en servidores de un proveedor (Google Firebase) que pueden estar fuera de la Argentina y consiento esa transferencia (art. 12). Si mi médico lo pide, una copia sin mi nombre ni DNI puede analizarse con IA (Anthropic, EE. UU.).')],
    ['terminos', h('span', 'Acepto los ', h('button.btn-link', { type: 'button', onclick: () => verTexto('Términos de uso', TERMINOS()) }, 'términos de uso'), ' y entiendo que los cálculos son orientativos y no reemplazan la consulta.')],
    ['mayor', h('span', 'Soy mayor de 18 años.')],
  ].map(([k, txt]) => { const i = h('input', { type: 'checkbox', name: k, checked: !!previo.consentimiento }); return { k, i, el: h('label.check.check--legal', i, txt) }; });
  const btn = h('button.btn.btn--primario.btn--grande.btn--bloque.btn--brillo', { type: 'submit' }, icono('flechaDer', { tam: 18 }), 'Enviarme el código');
  const form = h('form.form-acceso.form-acceso--ancho', { novalidate: true },
    pasos(0),
    h('div.grid-form',
      f('Nombre', 'nombre', { autocomplete: 'given-name', maxlength: 60 }), f('Apellido', 'apellido', { autocomplete: 'family-name', maxlength: 60 }),
      f('DNI', 'dni', { inputmode: 'numeric', maxlength: 10 }, { ayuda: 'Tu médico lo constata en la consulta.' }),
      f('Correo electrónico', 'email', { type: 'email', autocomplete: 'email', inputmode: 'email' }, { ayuda: 'Ahí te llega el código para entrar.' })),
    h('div.consentimientos', h('h4', 'Consentimiento informado'), ...consent.map((c) => c.el)),
    err, btn,
    h('div.form-links', h('span.ayuda', '¿Ya tenés cuenta?'), h('button.btn-link', { type: 'button', onclick: () => ingresoPaciente() }, 'Ingresar')));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    const dni = String(d.dni || '').replace(/\D/g, '');
    const problemas = [
      !d.nombre?.trim() || !d.apellido?.trim() ? 'Completá nombre y apellido.' : null,
      dni.length < 7 || dni.length > 9 ? 'Revisá el DNI.' : null,
      !correoValido(d.email) ? 'Revisá el correo.' : null,
      consent.some((c) => !c.i.checked) ? 'Para crear la cuenta tenés que aceptar los cuatro puntos del consentimiento.' : null,
    ].filter(Boolean);
    if (problemas.length) { err.textContent = problemas[0]; return; }
    btn.disabled = true;
    const email = d.email.trim().toLowerCase();
    try {
      const r = await pedirCodigo(email);
      // Se guarda solo en esta pestaña y se borra al completar el alta
      guardarTemp('metria-alta', { nombre: d.nombre.trim(), apellido: d.apellido.trim(), dni, email, consentimiento: true });
      guardarTemp('metria-correo', email);
      sessionStorage.setItem('metria-puerta', 'paciente');
      pasoCodigo({ email, demo: r?.demo, alta: true });
    } catch (er) { err.textContent = mensaje(er); btn.disabled = false; }
  });
  pantalla(tarjetaAcceso('paciente', 'Crear cuenta de paciente', 'En un minuto y sin contraseña.', form));
}

/** Alta de pacientes, paso 3 (ya con el correo validado): datos que faltan. */
export function pantallaCompletarAlta(u, onListo) {
  const alta = leerTemp('metria-alta') || {};
  const email = alta.email || leerTemp('metria-correo') || u.email || '';
  const d = { nombre: alta.nombre || '', apellido: alta.apellido || '', dni: alta.dni || '', sexo: 'F' };
  const yaTiene = !!(alta.nombre && alta.dni && alta.consentimiento);
  const err = h('div.form-error', { role: 'alert' });
  const f = (etq, k, props = {}, extra = {}) => {
    const c = campo(etq, { ...props, name: k, value: d[k] || '' }, { requerido: props.required !== false, ...extra });
    c.querySelector('input').addEventListener('input', (e) => { d[k] = e.target.value; });
    return c;
  };
  const consent = yaTiene ? [] : [
    h('span', 'Acepto la política de privacidad y el tratamiento de mis datos de salud con fines de atención médica (Ley 25.326).'),
    h('span', 'Consiento que los datos se alojen en servidores de Google Firebase, que pueden estar fuera de la Argentina, y que mi médico pueda analizar una copia sin mi nombre ni DNI con IA (Anthropic, EE. UU.).'),
    h('span', 'Acepto los términos de uso y soy mayor de 18 años.'),
  ].map((txt) => { const i = h('input', { type: 'checkbox' }); return { i, el: h('label.check.check--legal', i, txt) }; });
  const btn = h('button.btn.btn--primario.btn--grande.btn--bloque.btn--brillo', { type: 'submit' }, icono('ok', { tam: 18 }), 'Listo, entrar');
  const form = h('form.form-acceso.form-acceso--ancho', { novalidate: true },
    pasos(2),
    aviso('ok', h('span', h('strong', 'Correo validado: '), email || 'tu correo')),
    yaTiene ? h('p.resumen-alta', icono('usuario', { tam: 16 }), `${d.nombre} ${d.apellido} · DNI ${Number(d.dni).toLocaleString('es-AR')}`) : null,
    h('div.grid-form',
      yaTiene ? null : [f('Nombre', 'nombre', { maxlength: 60 }), f('Apellido', 'apellido', { maxlength: 60 }), f('DNI', 'dni', { inputmode: 'numeric', maxlength: 10 })],
      f('Fecha de nacimiento', 'fechaNac', { type: 'date', max: new Date().toISOString().slice(0, 10) }),
      h('div.campo', h('label', 'Sexo biológico'), segmentado([{ valor: 'F', texto: 'Femenino' }, { valor: 'M', texto: 'Masculino' }], 'F', (v) => { d.sexo = v; }), h('small.ayuda', 'Lo usan las fórmulas médicas.')),
      f('Teléfono (opcional)', 'telefono', { type: 'tel', autocomplete: 'tel', required: false }, { requerido: false })),
    consent.length ? h('div.consentimientos', h('h4', 'Consentimiento informado'), ...consent.map((c) => c.el)) : null,
    err, btn,
    h('div.form-links', h('button.btn-link', { type: 'button', onclick: () => backend().salir() }, 'Cancelar y salir')));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    const dni = String(d.dni || '').replace(/\D/g, '');
    const edad = d.fechaNac ? (Date.now() - new Date(d.fechaNac)) / 31557600000 : 0;
    const problemas = [
      !d.nombre?.trim() || !d.apellido?.trim() ? 'Completá nombre y apellido.' : null,
      dni.length < 7 || dni.length > 9 ? 'Revisá el DNI.' : null,
      !d.fechaNac ? 'Completá la fecha de nacimiento.' : edad < 18 ? 'La app es para mayores de 18 años.' : edad > 110 ? 'Revisá la fecha de nacimiento.' : null,
      consent.some((c) => !c.i.checked) ? 'Tenés que aceptar el consentimiento para continuar.' : null,
      !email ? 'Volvé a ingresar con tu correo.' : null,
    ].filter(Boolean);
    if (problemas.length) { err.textContent = problemas[0]; return; }
    btn.disabled = true; btn.textContent = 'Creando tu espacio…';
    try {
      await completarAltaPaciente(u.uid, { ...d, dni, email });
      guardarTemp('metria-alta', null); guardarTemp('metria-correo', null);
      toast('¡Bienvenido/a! Tu cuenta está lista.', 'ok', 5000);
      onListo();
    } catch (er) { console.error(er); err.textContent = mensaje(er); btn.disabled = false; btn.textContent = 'Listo, entrar'; }
  });
  pantalla(tarjetaAcceso('paciente-sesion', 'Último paso', 'Estos datos se usan en los cálculos médicos.', form));
}

/* ======================= PROFESIONALES ======================= */

export function ingresoProfesional() { ingreso('medico'); }

/** Ingreso con contraseña (profesionales). */
export function ingreso(rol) {
  if (rol !== 'medico') { ingresoPaciente(); return; }
  const email = h('input', { type: 'email', autocomplete: 'username', required: true, id: 'ing-email' });
  const clave = h('input', { type: 'password', autocomplete: 'current-password', required: true, id: 'ing-clave' });
  const recordar = h('input', { type: 'checkbox', id: 'ing-rec' });
  const error = h('div.form-error', { role: 'alert' });
  const btn = h('button.btn.btn--primario.btn--grande.btn--bloque.btn--brillo', { type: 'submit' }, 'Ingresar');
  const form = h('form.form-acceso', { novalidate: true },
    h('div.campo', h('label', { for: 'ing-email' }, 'Correo electrónico'), email),
    h('div.campo', h('label', { for: 'ing-clave' }, 'Contraseña'), h('div.clave-wrap', clave, botonVer(clave))),
    h('label.check', recordar, h('span', 'Recordarme en este equipo'), h('small', 'No lo marques en computadoras compartidas.')),
    error, btn,
    h('div.form-links',
      h('button.btn-link', { type: 'button', onclick: recuperar }, '¿Olvidaste la contraseña?'),
      h('button.btn-link', { type: 'button', onclick: registroMedico }, 'Solicitar alta')));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.textContent = '';
    btn.disabled = true; btn.textContent = 'Ingresando…';
    sessionStorage.setItem('metria-puerta', 'medico');
    try { await backend().ingresar(email.value, clave.value, recordar.checked); }
    catch (err) { error.textContent = mensaje(err); btn.disabled = false; btn.textContent = 'Ingresar'; }
  });
  pantalla(tarjetaAcceso('medico', 'Ingreso de profesionales', 'Solo para profesionales autorizados por el coordinador.', form));
  setTimeout(() => email.focus(), 60);
}

const botonVer = (input) => h('button.btn-icono', { type: 'button', 'aria-label': 'Mostrar u ocultar contraseña', onclick: () => { input.type = input.type === 'password' ? 'text' : 'password'; } }, icono('ojo', { tam: 18 }));

function recuperar() {
  const email = h('input', { type: 'email', required: true, id: 'rec-email' });
  const btn = h('button.btn.btn--primario.btn--bloque', { type: 'submit' }, 'Enviar enlace');
  const form = h('form.form-acceso', h('div.campo', h('label', { for: 'rec-email' }, 'Correo de la cuenta profesional'), email), btn);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.disabled = true;
    await backend().restablecer(email.value);
    form.replaceWith(aviso('ok', 'Si el correo está registrado, te llega un enlace para crear una contraseña nueva. Revisá también el correo no deseado.'));
  });
  pantalla(tarjetaAcceso('medico', 'Recuperar contraseña', 'Te mandamos un enlace por correo.', form));
}

export function registroMedico() {
  const d = { matTipo: 'MN' };
  const err = h('div.form-error', { role: 'alert' });
  const f = (etq, k, props = {}, extra = {}) => {
    const c = campo(etq, { ...props, name: k }, { requerido: props.required !== false, ...extra });
    c.querySelector('input').addEventListener('input', (e) => { d[k] = e.target.value; });
    return c;
  };
  const clave = h('input', { type: 'password', autocomplete: 'new-password', id: 'regm-clave' });
  clave.addEventListener('input', () => { d.clave = clave.value; });
  const dj = h('input', { type: 'checkbox' });
  const conf = h('input', { type: 'checkbox' });
  const btn = h('button.btn.btn--primario.btn--grande.btn--bloque.btn--brillo', { type: 'submit' }, 'Solicitar alta');
  const form = h('form.form-acceso.form-acceso--ancho', { novalidate: true },
    h('div.grid-form',
      f('Nombre', 'nombre', { maxlength: 60 }), f('Apellido', 'apellido', { maxlength: 60 }),
      h('div.campo', h('label', 'Matrícula'), segmentado([{ valor: 'MN', texto: 'Nacional (MN)' }, { valor: 'MP', texto: 'Provincial (MP)' }], 'MN', (v) => { d.matTipo = v; })),
      f('Número de matrícula', 'matNumero', { inputmode: 'numeric', maxlength: 8 }),
      f('Provincia (si es MP)', 'matProvincia', { maxlength: 40, required: false }),
      f('Especialidad', 'especialidad', { maxlength: 60 }),
      f('Correo profesional', 'email', { type: 'email', autocomplete: 'email' }),
      h('div.campo', h('label', { for: 'regm-clave' }, 'Contraseña', h('span.req', ' *')), h('div.clave-wrap', clave, botonVer(clave)), fuerzaClave(clave), h('small.ayuda', 'Mínimo 12 caracteres.'))),
    h('div.consentimientos',
      h('label.check.check--legal', dj, h('span', 'Declaro bajo juramento que soy profesional de la salud con matrícula vigente y que los datos son verdaderos.')),
      h('label.check.check--legal', conf, h('span', 'Me comprometo a la confidencialidad de los datos (Ley 25.326, art. 10) y al secreto profesional (Ley 17.132, art. 11), y a usarlos solo para la atención de los pacientes.'))),
    aviso('info', 'Tu cuenta queda en espera: no vas a poder entrar ni ver pacientes hasta que el coordinador verifique tu matrícula (SISA / REFEPS) y te autorice.'),
    err, btn);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    const p = [
      !d.nombre?.trim() || !d.apellido?.trim() ? 'Completá nombre y apellido.' : null,
      !/^\d{3,8}$/.test(String(d.matNumero || '').replace(/\D/g, '')) ? 'Revisá el número de matrícula.' : null,
      d.matTipo === 'MP' && !d.matProvincia?.trim() ? 'Indicá la provincia de la matrícula.' : null,
      !d.especialidad?.trim() ? 'Indicá la especialidad.' : null,
      !correoValido(d.email) ? 'Revisá el correo.' : null,
      (d.clave || '').length < 12 ? 'Para profesionales, la contraseña debe tener al menos 12 caracteres.' : null,
      !dj.checked || !conf.checked ? 'Tenés que aceptar la declaración y el compromiso de confidencialidad.' : null,
    ].filter(Boolean);
    if (p.length) { err.textContent = p[0]; return; }
    btn.disabled = true; btn.textContent = 'Enviando…';
    sessionStorage.setItem('metria-puerta', 'medico');
    try { await registrarMedico(d); toast('Solicitud enviada. Verificá tu correo y esperá la autorización del coordinador.', 'ok', 7000); }
    catch (er) { console.error(er); err.textContent = mensaje(er); btn.disabled = false; btn.textContent = 'Solicitar alta'; }
  });
  pantalla(tarjetaAcceso('medico', 'Alta de profesional', 'Ingreso diferenciado para profesionales matriculados.', form));
}

/* ======================= ESTADOS INTERMEDIOS ======================= */
export function pantallaVerificar(u, onListo) {
  const B = backend();
  const btn = h('button.btn.btn--primario', { type: 'button' }, 'Ya lo verifiqué');
  btn.onclick = async () => { btn.disabled = true; const r = await B.recargarUsuario(); if (r?.verificado) onListo(); else { toast('Todavía no figura verificado. Abrí el enlace del correo.', 'info'); btn.disabled = false; } };
  pantalla(h('section.acceso-card.centro',
    h('span.puerta-gema', icono('campana', { tam: 26 })),
    h('h2', 'Verificá tu correo'),
    h('p', `Te enviamos un enlace a ${u.email}. Abrilo para activar tu cuenta.`),
    h('div.botones', btn, h('button.btn.btn--suave', { type: 'button', onclick: async () => { await B.reenviarVerificacion().catch(() => {}); toast('Correo reenviado', 'ok'); } }, 'Reenviar correo'),
      h('button.btn-link', { type: 'button', onclick: () => B.salir() }, 'Salir'))));
}

export function pantallaPendiente(perfil) {
  pantalla(h('section.acceso-card.centro',
    h('span.puerta-gema.latido', icono('reloj', { tam: 26 })),
    h('h2', perfil.estado === 'suspendido' ? 'Cuenta suspendida' : 'Esperando la autorización del coordinador'),
    h('p', perfil.estado === 'suspendido'
      ? 'El coordinador suspendió esta cuenta. Comunicate con el consultorio.'
      : `Gracias, ${perfil.datos.nombre}. El coordinador tiene que verificar tu matrícula (${perfil.datos.matricula.tipo} ${perfil.datos.matricula.numero}) y darte el OK. Hasta entonces no se muestra ningún dato de pacientes.`),
    h('button.btn.btn--suave', { type: 'button', onclick: () => backend().salir() }, 'Salir')));
}

export function pantallaPuertaEquivocada(rol) {
  pantalla(h('section.acceso-card.centro',
    h('span.puerta-gema', icono('alerta', { tam: 26 })),
    h('h2', 'Esta cuenta no corresponde a este ingreso'),
    h('p', rol === 'paciente' ? 'Ingresaste por la puerta de profesionales con una cuenta de paciente.' : 'Ingresaste por la puerta de pacientes con una cuenta profesional.'),
    h('button.btn.btn--primario', { type: 'button', onclick: () => backend().salir() }, 'Volver al inicio')));
}

export { CONFIG };
