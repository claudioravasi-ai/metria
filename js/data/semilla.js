/* ============================================================
   Datos de ejemplo para el MODO DEMOSTRACIÓN.
   Personas ficticias: cualquier parecido es casual.
   Solo se cargan en el navegador cuando no hay Firebase configurado.
   ============================================================ */

import { evaluarPaciente, resumenIndice } from '../engine/evaluar.js';
import { generarBosquejo } from './archivos.js';
import { MS_DIA, MS_HORA } from '../config.js';

export const DEMO = {
  medico: { uid: 'demo-medico', email: 'medico@demo.metria' },
  paciente: { uid: 'demo-pac-1', email: 'laura@demo.metria' },
};

/* ---------- Generadores de archivos de ejemplo ---------- */
function pdfTexto(titulo, lineas) {
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  let y = 770;
  let c = '0.39 0.27 0.96 rg 0 800 595 42 re f\n1 1 1 rg BT /F2 16 Tf 40 815 Td (' + esc('LABORATORIO DE EJEMPLO - DEMO') + ') Tj ET\n0 0 0 rg';
  c += `\nBT /F2 15 Tf 40 ${y} Td (${esc(titulo)}) Tj ET\n`;
  y -= 28;
  for (const l of lineas) {
    c += `BT /F1 11 Tf 40 ${y} Td (${esc(l)}) Tj ET\n`;
    y -= 17;
  }
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${c.length} >>\nstream\n${c}endstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offs = [];
  objs.forEach((o, i) => { offs.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf; // cadena Latin-1: cada carácter es un byte
}

function lienzo(w, h, dibujar) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  dibujar(cv.getContext('2d'), w, h);
  return cv.toDataURL('image/png').split(',')[1];
}

function ecg() {
  return lienzo(900, 380, (c, w, h) => {
    c.fillStyle = '#fff7f7'; c.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 10) { c.strokeStyle = x % 50 ? '#fbd5d5' : '#f5a3a3'; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    for (let y = 0; y < h; y += 10) { c.strokeStyle = y % 50 ? '#fbd5d5' : '#f5a3a3'; c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    c.strokeStyle = '#111'; c.lineWidth = 2; c.beginPath();
    const base = 200;
    for (let x = 0; x < w; x++) {
      const t = (x % 150) / 150;
      let y = base;
      if (t > 0.1 && t < 0.18) y -= Math.sin(((t - 0.1) / 0.08) * Math.PI) * 14;
      if (t > 0.24 && t < 0.26) y += 12;
      if (t >= 0.26 && t < 0.29) y -= ((t - 0.26) / 0.03) * 110;
      if (t >= 0.29 && t < 0.32) y = base - 110 + ((t - 0.29) / 0.03) * 135;
      if (t >= 0.32 && t < 0.34) y = base + 25 - ((t - 0.32) / 0.02) * 25;
      if (t > 0.45 && t < 0.6) y -= Math.sin(((t - 0.45) / 0.15) * Math.PI) * 26;
      x ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.stroke();
    c.fillStyle = '#9f1239'; c.font = 'bold 18px sans-serif';
    c.fillText('ECG DE EJEMPLO — DEMO · Ritmo sinusal 72 lpm', 20, 34);
  });
}

function ecografia() {
  return lienzo(640, 480, (c, w, h) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
    c.save(); c.beginPath(); c.moveTo(w / 2, 40); c.arc(w / 2, 40, 420, Math.PI * 0.28, Math.PI * 0.72); c.closePath(); c.clip();
    for (let i = 0; i < 9000; i++) {
      const x = Math.random() * w, y = Math.random() * h;
      const g = 40 + Math.random() * 120 * (1 - y / h);
      c.fillStyle = `rgb(${g},${g},${g})`; c.fillRect(x, y, 2, 2);
    }
    c.fillStyle = 'rgba(10,10,10,.85)'; c.beginPath(); c.ellipse(w / 2 + 30, 260, 90, 55, 0.3, 0, Math.PI * 2); c.fill();
    c.restore();
    c.fillStyle = '#e5e7eb'; c.font = '15px sans-serif'; c.fillText('ECOGRAFÍA ABDOMINAL — DEMO', 16, 26);
  });
}

/* ---------- Pacientes ---------- */
const PAC = [
  {
    uid: 'demo-pac-1',
    perfil: { nombre: 'Laura', apellido: 'Gómez', dni: '28123456', fechaNac: '1980-04-12', sexo: 'F', telefono: '11 5555-0101', email: 'laura@demo.metria' },
    clinica: {
      antropo: { talla: 164, peso: 89, cintura: 101, cadera: 114 },
      vitales: { pas: 134, pad: 86, fc: 78 },
      habitos: { tabaco: 'nunca', actividad: 'ligera', alcohol: 'no', frutasVerduras: false },
      patologias: { hta: true, prediabetes: true, higadoGraso: true },
      familia: { dm2: '1grado' },
      sintomas: { dolorRodillaCadera: true },
      meds: [{ nombre: 'Enalapril 10 mg cada 12 h', clases: ['ieca'] }, { nombre: 'Microgynon (anticonceptivo oral)', clases: ['aco'] }],
      labs: { fecha: '2026-09-15', glucosa: 108, hba1c: 6.0, insulina: 18, ct: 218, hdl: 44, tg: 182, creatinina: 0.8, ast: 34, alt: 41, plaquetas: 240, pcr: 3.1, tsh: 2.1 },
    },
    pesos: [94.2, 93.1, 92.0, 91.2, 90.1, 89],
    verificado: true,
  },
  {
    uid: 'demo-pac-2',
    perfil: { nombre: 'Roberto', apellido: 'Díaz', dni: '17456789', fechaNac: '1966-09-03', sexo: 'M', telefono: '11 5555-0202', email: 'roberto@demo.metria' },
    clinica: {
      antropo: { talla: 176, peso: 113, cintura: 118, cadera: 112 },
      vitales: { pas: 142, pad: 88, fc: 84 },
      habitos: { tabaco: 'ex', actividad: 'sedentario', alcohol: 'moderado', frutasVerduras: false },
      patologias: { dm2: true, hta: true, dislipemia: true, iam: true, sahos: true },
      familia: { ecvPrecoz: true, dm2: '1grado' },
      meds: [
        { nombre: 'Metformina 850 mg cada 12 h', clases: ['metformina'] },
        { nombre: 'Glimepirida 4 mg', clases: ['sulfonilurea'] },
        { nombre: 'Insulina glargina 24 UI', clases: ['insulina'] },
        { nombre: 'Losartán 50 mg', clases: ['ara2'] },
        { nombre: 'Atorvastatina 40 mg', clases: ['estatina'] },
        { nombre: 'Aspirina 100 mg', clases: ['antiagregante'] },
      ],
      labs: { fecha: '2026-09-02', glucosa: 162, hba1c: 8.1, ct: 182, hdl: 38, ldl: 98, tg: 210, creatinina: 1.35, racu: 85, ast: 28, alt: 32, plaquetas: 210 },
    },
    pesos: [112, 113.5, 114, 113.2, 113],
    verificado: true,
  },
  {
    uid: 'demo-pac-3',
    perfil: { nombre: 'Sofía', apellido: 'Pereyra', dni: '40987654', fechaNac: '1997-02-20', sexo: 'F', telefono: null, email: 'sofia@demo.metria' },
    clinica: {
      antropo: { talla: 166, peso: 63, cintura: 72, cadera: 98 },
      vitales: { pas: 112, pad: 70, fc: 66 },
      habitos: { tabaco: 'actual', actividad: 'moderada', alcohol: 'moderado', frutasVerduras: true },
      patologias: {},
      familia: {},
      meds: [],
      labs: { fecha: '2026-08-20', glucosa: 86, ct: 176, hdl: 62, tg: 74, creatinina: 0.7 },
    },
    pesos: [64, 63.5, 63],
    verificado: false,
  },
];

export async function construirSemilla(ahora) {
  const t = ahora;
  const arbol = {
    medicos: {
      'demo-medico': { nombre: 'Ana', apellido: 'Demo', especialidad: 'Clínica médica y nutrición', matricula: { tipo: 'MN', numero: '000000', provincia: 'CABA' }, email: 'medico@demo.metria', demoTitular: true, creado: t - 60 * MS_DIA },
      'demo-medico-2': { nombre: 'Juan', apellido: 'Pendiente', especialidad: 'Cardiología', matricula: { tipo: 'MP', numero: '123456', provincia: 'Córdoba' }, email: 'juan@demo.metria', creado: t - 2 * MS_DIA },
    },
    medicosEstado: { 'demo-medico': 'aprobado', 'demo-medico-2': 'pendiente' },
    pacientes: {}, indice: {}, verificados: {}, estudios: {}, estudiosVenc: {}, auditoria: {},
  };
  const archivos = {};
  let n = 0;
  const id = () => `demo${String(++n).padStart(4, '0')}`;

  for (const p of PAC) {
    const ev = evaluarPaciente(p.perfil, p.clinica, new Date(t));
    const med = {};
    p.pesos.forEach((peso, i) => {
      med[id()] = { fecha: t - (p.pesos.length - 1 - i) * 30 * MS_DIA, peso, cintura: p.clinica.antropo.cintura + (p.pesos.length - 1 - i), pas: p.clinica.vitales.pas, pad: p.clinica.vitales.pad, por: 'paciente' };
    });
    arbol.pacientes[p.uid] = {
      perfil: { ...p.perfil, consentimiento: { version: '2026-10-06', fecha: t - 90 * MS_DIA, datosSalud: true, transferencia: true, terminos: true }, creado: t - 90 * MS_DIA },
      clinica: { ...p.clinica, actualizado: t - 3 * MS_DIA, actualizadoPor: 'paciente' },
      mediciones: med,
    };
    arbol.indice[p.uid] = { n: `${p.perfil.apellido}, ${p.perfil.nombre}`, d3: p.perfil.dni.slice(-3), nac: p.perfil.fechaNac, sx: p.perfil.sexo, act: t - 3 * MS_DIA, ...resumenIndice(ev) };
    if (p.verificado) arbol.verificados[p.uid] = { por: 'demo-medico', cuando: t - 80 * MS_DIA };
  }

  // Plan activo de la paciente 1 (semaglutida, 5 semanas)
  const inicio = new Date(t - 35 * MS_DIA).toISOString().slice(0, 10);
  arbol.pacientes['demo-pac-1'].plan = {
    farmaco: 'sema-ob', inicio, estado: 'activo',
    notas: 'Aplicar los lunes. Si las náuseas no ceden, avisar antes de subir la dosis.',
    indicadoPor: { uid: 'demo-medico', nombre: 'Ana Demo', matricula: 'MN 000000' }, fecha: t - 35 * MS_DIA,
  };
  arbol.pacientes['demo-pac-1'].tolerancia = {
    [id()]: { fecha: t - 21 * MS_DIA, semana: 3, nauseas: 2, vomitos: 0, diarrea: 1, constipacion: 0, dolor: 0, peso: 90.6 },
    [id()]: { fecha: t - 7 * MS_DIA, semana: 5, nauseas: 1, vomitos: 0, diarrea: 0, constipacion: 1, dolor: 0, peso: 89.4 },
  };

  // Estudios de ejemplo de la paciente 1
  const pdf = pdfTexto('Laboratorio completo - Laura Gómez (ficticia)', [
    'Fecha: 15/09/2026', '', 'Glucemia en ayunas ........ 108 mg/dL   (70-99)', 'Hemoglobina A1c ........... 6,0 %      (< 5,7)',
    'Insulina basal ............ 18 µU/mL   (< 15)', 'Colesterol total .......... 218 mg/dL  (< 200)', 'Colesterol HDL ............ 44 mg/dL   (> 50)',
    'Triglicéridos ............. 182 mg/dL  (< 150)', 'Creatinina ................ 0,8 mg/dL', 'TGO / TGP ................. 34 / 41 U/L',
    'Plaquetas ................. 240.000/µL', 'PCR ultrasensible ......... 3,1 mg/L', 'TSH ....................... 2,1 µUI/mL', '',
    'Documento generado para la demostración de la app.',
  ]);
  const estudios = [
    { titulo: 'Laboratorio completo', categoria: 'laboratorio', nombre: 'laboratorio-2026-09-15.pdf', mime: 'application/pdf', b64: btoa(pdf), fechaEstudio: '2026-09-15', subidoEn: t - 2 * MS_DIA },
    { titulo: 'Electrocardiograma', categoria: 'cardiologia', nombre: 'ecg-2026-09-20.png', mime: 'image/png', b64: ecg(), fechaEstudio: '2026-09-20', subidoEn: t - 5 * MS_DIA },
    { titulo: 'Ecografía abdominal', categoria: 'imagenes', nombre: 'ecografia-abdominal.png', mime: 'image/png', b64: ecografia(), fechaEstudio: '2026-09-10', subidoEn: t - 9 * MS_DIA, descargadoEn: t - 49 * MS_HORA },
  ];
  arbol.estudios['demo-pac-1'] = {};
  arbol.auditoria['demo-pac-1'] = {};
  for (const e of estudios) {
    const eid = id();
    const bytes = Uint8Array.from(atob(e.b64), (ch) => ch.charCodeAt(0));
    const bosquejo = await generarBosquejo(new File([bytes], e.nombre, { type: e.mime })).catch(() => null);
    const partes = Math.max(1, Math.ceil(e.b64.length / (512 * 1024)));
    for (let i = 0; i < partes; i++) archivos[`estudiosArchivos/demo-pac-1/${eid}/${i}`] = e.b64.slice(i * 512 * 1024, (i + 1) * 512 * 1024);
    arbol.estudios['demo-pac-1'][eid] = {
      titulo: e.titulo, categoria: e.categoria, nombre: e.nombre, mime: e.mime, tamano: bytes.length, fechaEstudio: e.fechaEstudio,
      nota: null, bosquejo, partes, subidoPor: 'demo-medico', subidoEn: e.subidoEn, ...(e.descargadoEn ? { descargadoEn: e.descargadoEn } : {}),
    };
    arbol.auditoria['demo-pac-1'][id()] = { quien: 'demo-medico', accion: 'subio', estudio: eid, cuando: e.subidoEn };
    if (e.descargadoEn) {
      arbol.estudiosVenc['demo-pac-1'] = { [eid]: e.descargadoEn };
      arbol.auditoria['demo-pac-1'][id()] = { quien: 'demo-pac-1', accion: 'descargo', estudio: eid, cuando: e.descargadoEn };
    }
  }
  arbol.solicitudes = { 'demo-pac-3': { [id()]: { tipo: 'rectificacion', texto: 'Mi teléfono cambió: 11 5555-0303.', cuando: t - MS_DIA, estado: 'pendiente' } } };
  // Cuentas de pacientes de ejemplo: entran con código (sin contraseña)
  const cuentas = Object.fromEntries(PAC.map((p) => [p.perfil.email, { uid: p.uid, tipo: 'paciente' }]));
  return { arbol, archivos, cuentas };
}
