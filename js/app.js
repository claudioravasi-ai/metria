/* ============================================================
   Arranque de Metria
   ============================================================ */

import { h, montar } from './core/dom.js';
import { toast, cerrarTodos } from './core/ui.js';
import { CONFIG } from './config.js';
import { iniciarBackend, perfilDe, backend } from './data/servicio.js';
import { temaInicial, vigilarInactividad, logo } from './views/shell.js';
import { portada, pantallaVerificar, pantallaPendiente, pantallaPuertaEquivocada, pantallaCompletarAlta } from './views/acceso.js';
import { appPaciente } from './views/paciente.js';
import { appMedico } from './views/medico.js';

let actual = null, dejarDeVigilar = null, ultimoUid = undefined;

function splash(texto = 'Cargando…') {
  montar(document.getElementById('app'), h('div.splash', logo('grande'), h('div.spinner'), h('small', texto)));
}

async function salir() {
  dejarDeVigilar?.(); dejarDeVigilar = null;
  if (actual) { const a = actual; actual = null; a.detener?.(); }
  cerrarTodos();
  try { sessionStorage.removeItem('metria-puerta'); } catch { /* */ }
  await backend().salir();
}

async function alCambiar(u) {
  if (u?.uid === ultimoUid && actual) return; // mismo usuario (p. ej. refresco del token)
  ultimoUid = u?.uid ?? null;
  if (actual) { const a = actual; actual = null; a.detener?.(); }
  dejarDeVigilar?.(); dejarDeVigilar = null;
  cerrarTodos();
  if (!u) { history.replaceState(null, '', location.pathname); portada(); return; }
  if (!u.verificado) { pantallaVerificar(u, () => { ultimoUid = undefined; alCambiar({ ...u, verificado: true }); }); return; }
  splash('Abriendo tu espacio…');
  let perfil;
  try { perfil = await perfilDe(u); } catch (e) { console.error(e); toast('No se pudo leer tu cuenta', 'error'); return; }
  let puerta = null;
  try { puerta = sessionStorage.getItem('metria-puerta'); } catch { /* */ }
  if (perfil.rol === 'sin-perfil' && u.paciente) {
    // Paciente con el correo ya validado por código: completa su alta
    pantallaCompletarAlta(u, () => { ultimoUid = undefined; alCambiar(u); });
    return;
  }
  if (perfil.rol === 'sin-perfil') {
    // Profesional recién creado: su ficha se escribe un instante después del alta
    setTimeout(async () => { const p = await perfilDe(u); if (p.rol !== 'sin-perfil') { ultimoUid = undefined; alCambiar(u); } else portada(); }, 1200);
    return;
  }
  if (puerta && puerta !== perfil.rol) { pantallaPuertaEquivocada(perfil.rol); return; }
  if (perfil.rol === 'medico' && perfil.estado !== 'aprobado') { pantallaPendiente(perfil); return; }
  dejarDeVigilar = vigilarInactividad(salir);
  actual = perfil.rol === 'medico' ? appMedico(perfil, { onSalir: salir }) : appPaciente(perfil, { onSalir: salir });
}

async function iniciar() {
  temaInicial();
  splash();
  try {
    const B = await iniciarBackend();
    document.documentElement.dataset.modo = B.modo;
    if (B.modo === 'demo' && B.arbolVacio()) {
      splash('Preparando los datos de ejemplo…');
      const { construirSemilla } = await import('./data/semilla.js');
      const { arbol, archivos, cuentas } = await construirSemilla(B.ahora());
      await B.sembrar(arbol, archivos, cuentas);
    }
    B.alCambiarSesion((u) => { alCambiar(u).catch((e) => { console.error(e); toast('Ocurrió un error al abrir la sesión', 'error'); }); });
  } catch (e) {
    console.error(e);
    montar(document.getElementById('app'), h('div.splash', logo('grande'), h('p', 'No se pudo iniciar la app. Revisá la conexión y recargá la página.'), h('button.btn.btn--primario', { onclick: () => location.reload() }, 'Reintentar')));
  }
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

window.addEventListener('unhandledrejection', (e) => console.warn('Promesa sin manejar', e.reason));
iniciar();
export { CONFIG };
