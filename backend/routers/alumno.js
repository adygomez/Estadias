// backend/routers/alumno.js
const express = require('express');
const router = express.Router();
const Alumno = require('../models/Alumno');
const multer = require('multer');
const xlsx = require('xlsx');
const generarPDF = require('../utils/pdfGenerator');
const flattenToNested = require('../utils/flattenToNested');
const detectarYAsignarTipoRegistro = require('../utils/detectarTipoRegistro');
const path = require('path');
const fs = require('fs');

router.get('/ping', (req, res) => {
  res.status(200).json({ ok: true });
});

const upload = multer({ storage: multer.memoryStorage() });
const MAX_PARAESCOLAR = 40;

// ---------- Helpers ----------
const CLAVES_EXENTAS = new Set([
  'estado_nacimiento', 'municipio_nacimiento', 'ciudad_nacimiento',
  'estado_nacimiento_general', 'municipio_nacimiento_general', 'ciudad_nacimiento_general'
]);


function toUpperData(obj) {
  return JSON.parse(JSON.stringify(obj), (key, value) => {
    return (typeof value === 'string' && !CLAVES_EXENTAS.has(key)) ? value.toUpperCase() : value;
  });
}


async function puedeAsignarParaescolar(paraescolar, alumnoId = null) {
  if (!paraescolar) return true;
  const filtro = { "datos_generales.paraescolar": paraescolar.toUpperCase() };
  if (alumnoId) filtro._id = { $ne: alumnoId };
  const count = await Alumno.countDocuments(filtro);
  return count < MAX_PARAESCOLAR;
}

// Función para generar matrícula automática
// Formato: YY + 32305272 + NNNN
// Ejemplo: 2532305272522 (año 25, fijo 32305272, número 522)
async function generarMatricula() {
  const año = new Date().getFullYear();
  const añoCorto = año.toString().slice(-2); // Últimos 2 dígitos (2025 → 25)
  const prefijoFijo = '32305272';
  const numeroInicial = 522; // Número inicial según el usuario
  
  // Buscar la última matrícula generada con este formato
  // Patrón: YY32305272NNNN
  const patronRegex = `^${añoCorto}${prefijoFijo}\\d{4}$`;
  
  // Buscar todas las inscripciones con matrícula que coincidan con el patrón
  // Incluir registros antiguos (sin tipo_registro) y nuevos (con tipo_registro: 'inscripcion')
  const inscripcionesConMatricula = await Alumno.find({
    $or: [
      { tipo_registro: 'inscripcion' },
      { tipo_registro: { $exists: false } } // Registros antiguos
    ],
    matricula: { 
      $exists: true, 
      $ne: null,
      $regex: patronRegex
    },
    semestre_reinscripcion: { $exists: false } // No es reinscripción
  }).sort({ matricula: -1 }); // Ordenar descendente para obtener la última
  
  let siguienteNumero = numeroInicial;
  
  if (inscripcionesConMatricula.length > 0) {
    // Extraer el número de la última matrícula
    const ultimaMatricula = inscripcionesConMatricula[0].matricula;
    // La matrícula tiene formato: YY32305272NNNN
    // Extraer los últimos 4 dígitos
    const numeroStr = ultimaMatricula.slice(-4);
    const ultimoNumero = parseInt(numeroStr, 10);
    if (!isNaN(ultimoNumero) && ultimoNumero >= numeroInicial) {
      siguienteNumero = ultimoNumero + 1;
    }
  }
  
  // Formatear el número con 4 dígitos (rellenar con ceros a la izquierda)
  const numeroFormateado = siguienteNumero.toString().padStart(4, '0');
  
  // Generar matrícula completa
  const matricula = `${añoCorto}${prefijoFijo}${numeroFormateado}`;
  
  return matricula;
}

// ---------- Endpoints ----------
router.get('/folio/:folio', async (req, res) => {
  try {
    const alumno = await Alumno.findOne({ folio: req.params.folio });
    if (!alumno) return res.status(404).json({ message: 'Folio no encontrado' });
    res.json(alumno);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Buscar por matrícula (para reinscripciones)
// Busca la inscripción original que tenga esta matrícula, o busca por CURP si la matrícula no existe
router.get('/matricula/:matricula', async (req, res) => {
  try {
    // Primero intentar buscar por matrícula
    // Incluir registros antiguos (sin tipo_registro) y nuevos (con tipo_registro: 'inscripcion')
    let alumno = await Alumno.findOne({ 
      matricula: req.params.matricula,
      $or: [
        { tipo_registro: 'inscripcion' },
        { tipo_registro: { $exists: false } } // Registros antiguos
      ],
      semestre_reinscripcion: { $exists: false } // No es reinscripción
    });
    
    // Si no se encuentra, buscar por CURP (asumiendo que la matrícula puede ser el CURP o similar)
    // O buscar cualquier inscripción que tenga esta matrícula en algún campo
    if (!alumno) {
      // Buscar por CURP como alternativa (si la matrícula es igual al CURP)
      alumno = await Alumno.findOne({ 
        'datos_alumno.curp': req.params.matricula,
        $or: [
          { tipo_registro: 'inscripcion' },
          { tipo_registro: { $exists: false } } // Registros antiguos
        ],
        semestre_reinscripcion: { $exists: false } // No es reinscripción
      });
    }
    
    if (!alumno) return res.status(404).json({ message: 'Matrícula no encontrada. Verifica que hayas completado tu inscripción inicial.' });
    
    // Si es registro antiguo, asignar tipo_registro automáticamente
    if (!alumno.tipo_registro) {
      detectarYAsignarTipoRegistro(alumno);
      if (!alumno.matricula && alumno.tipo_registro === 'inscripcion') {
        try {
          alumno.matricula = await generarMatricula();
        } catch (err) {
          console.error('Error generando matrícula:', err);
        }
      }
      await alumno.save();
    }
    
    res.json(alumno);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Obtener próximo semestre disponible para reinscripción
router.get('/reinscripcion/proximo-semestre/:matricula', async (req, res) => {
  try {
    const { matricula } = req.params;
    
    // Buscar inscripción original por matrícula o CURP
    // Incluir registros antiguos (sin tipo_registro) y nuevos (con tipo_registro: 'inscripcion')
    let inscripcion = await Alumno.findOne({ 
      matricula: matricula,
      $or: [
        { tipo_registro: 'inscripcion' },
        { tipo_registro: { $exists: false } } // Registros antiguos
      ],
      semestre_reinscripcion: { $exists: false } // No es reinscripción
    });
    
    // Si no se encuentra por matrícula, buscar por CURP
    if (!inscripcion) {
      inscripcion = await Alumno.findOne({ 
        'datos_alumno.curp': matricula,
        $or: [
          { tipo_registro: 'inscripcion' },
          { tipo_registro: { $exists: false } } // Registros antiguos
        ],
        semestre_reinscripcion: { $exists: false } // No es reinscripción
      });
    }
    
    if (!inscripcion) {
      return res.status(404).json({ message: 'No se encontró inscripción original para esta matrícula. Verifica que hayas completado tu inscripción inicial.' });
    }
    
    // Si es registro antiguo, asignar tipo_registro automáticamente
    if (!inscripcion.tipo_registro) {
      detectarYAsignarTipoRegistro(inscripcion);
      if (!inscripcion.matricula && inscripcion.tipo_registro === 'inscripcion') {
        try {
          inscripcion.matricula = await generarMatricula();
        } catch (err) {
          console.error('Error generando matrícula:', err);
        }
      }
      await inscripcion.save();
    }
    
    // Si la inscripción no tiene matrícula, asignarla
    if (!inscripcion.matricula) {
      inscripcion.matricula = matricula;
      await inscripcion.save();
    }
    
    // Usar la matrícula de la inscripción para buscar reinscripciones
    const matriculaBuscar = inscripcion.matricula || matricula;
    
    // Buscar todas las reinscripciones existentes
    const reinscripciones = await Alumno.find({
      matricula: matriculaBuscar,
      tipo_registro: 'reinscripcion'
    }).sort({ semestre_reinscripcion: -1 });
    
    // Calcular próximo semestre
    const ultimoSemestre = reinscripciones[0]?.semestre_reinscripcion || 1;
    const proximoSemestre = ultimoSemestre + 1;
    
    // Validar que no exceda 6
    if (proximoSemestre > 6) {
      return res.status(400).json({ 
        message: 'Ya completaste todos los semestres disponibles',
        semestresCompletados: reinscripciones.map(r => r.semestre_reinscripcion).sort()
      });
    }
    
    res.json({ 
      proximoSemestre: proximoSemestre,
      semestresCompletados: reinscripciones.map(r => r.semestre_reinscripcion).sort(),
      inscripcionOriginal: {
        _id: inscripcion._id,
        folio: inscripcion.folio,
        matricula: inscripcion.matricula || matricula,
        datos_alumno: inscripcion.datos_alumno
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Obtener historial completo de un alumno (inscripción + todas las reinscripciones)
router.get('/reinscripcion/historial/:matricula', async (req, res) => {
  try {
    const { matricula } = req.params;
    
    // Buscar inscripción original por matrícula o CURP
    // Incluir registros antiguos (sin tipo_registro) y nuevos (con tipo_registro: 'inscripcion')
    let inscripcion = await Alumno.findOne({ 
      matricula: matricula,
      $or: [
        { tipo_registro: 'inscripcion' },
        { tipo_registro: { $exists: false } } // Registros antiguos
      ],
      semestre_reinscripcion: { $exists: false } // No es reinscripción
    });
    
    if (!inscripcion) {
      inscripcion = await Alumno.findOne({ 
        'datos_alumno.curp': matricula,
        $or: [
          { tipo_registro: 'inscripcion' },
          { tipo_registro: { $exists: false } } // Registros antiguos
        ],
        semestre_reinscripcion: { $exists: false } // No es reinscripción
      });
    }
    
    if (!inscripcion) {
      return res.status(404).json({ message: 'No se encontró inscripción original' });
    }
    
    // Si es registro antiguo, asignar tipo_registro automáticamente
    if (!inscripcion.tipo_registro) {
      detectarYAsignarTipoRegistro(inscripcion);
      if (!inscripcion.matricula && inscripcion.tipo_registro === 'inscripcion') {
        try {
          inscripcion.matricula = await generarMatricula();
        } catch (err) {
          console.error('Error generando matrícula:', err);
        }
      }
      await inscripcion.save();
    }
    
    // Usar la matrícula de la inscripción para buscar reinscripciones
    const matriculaBuscar = inscripcion.matricula || matricula;
    
    // Buscar todas las reinscripciones
    const reinscripciones = await Alumno.find({
      matricula: matriculaBuscar,
      tipo_registro: 'reinscripcion'
    }).sort({ semestre_reinscripcion: 1 });
    
    res.json({
      inscripcion: inscripcion,
      reinscripciones: reinscripciones,
      totalRegistros: 1 + reinscripciones.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Obtener reinscripción específica por matrícula y semestre
router.get('/reinscripcion/:matricula/:semestre', async (req, res) => {
  try {
    const { matricula, semestre } = req.params;
    const semestreNum = parseInt(semestre);
    
    if (isNaN(semestreNum) || semestreNum < 2 || semestreNum > 6) {
      return res.status(400).json({ message: 'Semestre inválido. Debe ser entre 2 y 6' });
    }
    
    const reinscripcion = await Alumno.findOne({
      matricula: matricula,
      tipo_registro: 'reinscripcion',
      semestre_reinscripcion: semestreNum
    });
    
    if (!reinscripcion) {
      return res.status(404).json({ message: `No se encontró reinscripción para semestre ${semestreNum}` });
    }
    
    res.json(reinscripcion);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


router.post('/guardar', async (req, res) => {
  try {
    const data = req.body;

    // Detectar si es inscripción o reinscripción
    const esReinscripcion = data.tipo_registro === 'reinscripcion' || 
                           (data.matricula && data.semestre_reinscripcion);

    if (esReinscripcion) {
      // Redirigir a endpoint de reinscripción
      return router.handle({ 
        method: 'POST', 
        url: '/reinscripcion/guardar', 
        body: data 
      }, res);
    }

    // Validación para inscripción
    if (!data.folio || !data.datos_alumno?.curp || !data.datos_generales?.correo_alumno) {
      return res.status(400).json({ message: 'Faltan datos obligatorios' });
    }

    const yaRegistrado = await Alumno.findOne({ folio: data.folio });

    if (yaRegistrado?.registro_completado) {
      return res.status(403).json({ message: 'Este folio ya fue registrado y no se puede modificar.' });
    }

    const upperCaseData = toUpperData(data);
    upperCaseData.tipo_registro = 'inscripcion'; // Asegurar tipo

    // Asegura campos
    const estadoCivilNum = parseInt(data.datos_alumno?.estado_civil);
    if (!isNaN(estadoCivilNum)) upperCaseData.datos_alumno.estado_civil = estadoCivilNum;

    // Convertir semestre de texto a número
    const semestreTexto = upperCaseData.datos_alumno?.semestre;
    if (semestreTexto && typeof semestreTexto === 'string') {
      // Mapeo de texto a número
      const semestreMap = {
        'PRIMER SEMESTRE': 1,
        'SEGUNDO SEMESTRE': 2,
        'TERCER SEMESTRE': 3,
        'CUARTO SEMESTRE': 4,
        'QUINTO SEMESTRE': 5,
        'SEXTO SEMESTRE': 6,
        '1': 1,
        '2': 2,
        '3': 3,
        '4': 4,
        '5': 5,
        '6': 6
      };
      const semestreNum = semestreMap[semestreTexto.toUpperCase()] || parseInt(semestreTexto);
      if (!isNaN(semestreNum) && semestreNum >= 1 && semestreNum <= 6) {
        upperCaseData.datos_alumno.semestre = semestreNum;
      } else {
        // Si no se puede convertir, usar 1 por defecto para inscripciones
        upperCaseData.datos_alumno.semestre = 1;
      }
    } else if (semestreTexto && typeof semestreTexto === 'number') {
      // Si ya es número, asegurar que esté en rango válido
      if (semestreTexto >= 1 && semestreTexto <= 6) {
        upperCaseData.datos_alumno.semestre = semestreTexto;
      } else {
        upperCaseData.datos_alumno.semestre = 1;
      }
    } else {
      // Si no hay semestre, usar 1 por defecto para inscripciones
      upperCaseData.datos_alumno.semestre = 1;
    }

    const dg = upperCaseData.datos_generales;
    dg.primera_opcion  = data.datos_generales.primera_opcion  || '';
    dg.segunda_opcion  = data.datos_generales.segunda_opcion  || '';
    dg.tercera_opcion  = data.datos_generales.tercera_opcion  || '';
    dg.cuarta_opcion   = data.datos_generales.cuarta_opcion   || '';

    dg.estado_nacimiento_general  = data.datos_generales.estado_nacimiento_general  || '';
    dg.municipio_nacimiento_general = data.datos_generales.municipio_nacimiento_general || '';
    dg.ciudad_nacimiento_general  = data.datos_generales.ciudad_nacimiento_general  || '';

    // Chequeo de cupo
    const nuevoPara = data.datos_generales?.paraescolar;
    if (nuevoPara) {
      const paraPrevio = yaRegistrado?.datos_generales?.paraescolar;
      const estaCambiando = !!paraPrevio && paraPrevio.toUpperCase() !== nuevoPara.toUpperCase();

      // Si es nuevo registro o cambia de paraescolar, validar cupo
      if (!yaRegistrado || estaCambiando) {
        const ok = await puedeAsignarParaescolar(nuevoPara);
        if (!ok) {
          return res.status(400).json({ message: `El paraescolar ${nuevoPara} ya alcanzó el límite de ${MAX_PARAESCOLAR} alumno(s).` });
        }
      }
    }

    // Marcar registro completado
    upperCaseData.registro_completado = true;

    // Generar matrícula automáticamente si no existe
    if (!upperCaseData.matricula && !yaRegistrado?.matricula) {
      try {
        upperCaseData.matricula = await generarMatricula();
        console.log(`✅ Matrícula generada: ${upperCaseData.matricula} para folio ${data.folio}`);
      } catch (error) {
        console.error('❌ Error al generar matrícula:', error);
        // Continuar sin matrícula si hay error (no bloquear el registro)
      }
    } else if (yaRegistrado?.matricula) {
      // Si ya tiene matrícula, mantenerla
      upperCaseData.matricula = yaRegistrado.matricula;
    }

    // Guardar / upsert
    const actualizado = await Alumno.findOneAndUpdate(
      { folio: data.folio },
      upperCaseData,
      { upsert: true, new: true }
    );

    // Generar PDF
    const datosAnidados = flattenToNested(upperCaseData);
    const nombreArchivo = `${datosAnidados.datos_alumno?.curp || 'formulario'}.pdf`;
    await generarPDF(datosAnidados, nombreArchivo);

    res.status(200).json({
      message: 'Registro exitoso y PDF generado',
      pdf_url: `/pdfs/${nombreArchivo}`,
      alumno: actualizado,
      matricula: actualizado.matricula || null // Incluir matrícula en la respuesta
    });

  } catch (err) {
    console.error('Error al guardar o generar PDF:', err);
    res.status(500).json({ message: err.message });
  }
});

// Endpoint para guardar reinscripción
router.post('/reinscripcion/guardar', async (req, res) => {
  try {
    const data = req.body;

    // Validaciones obligatorias para reinscripción
    if (!data.matricula || !data.semestre_reinscripcion || !data.inscripcion_original_id) {
      return res.status(400).json({ message: 'Faltan datos obligatorios: matricula, semestre_reinscripcion, inscripcion_original_id' });
    }

    if (!data.datos_alumno?.curp || !data.datos_generales?.correo_alumno) {
      return res.status(400).json({ message: 'Faltan datos obligatorios del alumno' });
    }

    // Verificar que la inscripción original existe
    const inscripcionOriginal = await Alumno.findById(data.inscripcion_original_id);
    if (!inscripcionOriginal) {
      return res.status(404).json({ message: 'Inscripción original no encontrada' });
    }
    
    // Si es registro antiguo, asignar tipo_registro automáticamente
    if (!inscripcionOriginal.tipo_registro) {
      detectarYAsignarTipoRegistro(inscripcionOriginal);
      if (!inscripcionOriginal.matricula && inscripcionOriginal.tipo_registro === 'inscripcion') {
        try {
          inscripcionOriginal.matricula = await generarMatricula();
        } catch (err) {
          console.error('Error generando matrícula:', err);
        }
      }
      await inscripcionOriginal.save();
    }
    
    // Verificar que sea una inscripción (no una reinscripción)
    if (inscripcionOriginal.tipo_registro !== 'inscripcion' || inscripcionOriginal.semestre_reinscripcion) {
      return res.status(400).json({ message: 'El registro especificado no es una inscripción inicial válida' });
    }

    // Si la inscripción original no tiene matrícula, asignarla
    if (!inscripcionOriginal.matricula) {
      inscripcionOriginal.matricula = data.matricula;
      await inscripcionOriginal.save();
    }

    // Verificar que la matrícula coincida (o usar la de la inscripción original)
    const matriculaFinal = inscripcionOriginal.matricula || data.matricula;
    if (inscripcionOriginal.matricula && inscripcionOriginal.matricula !== data.matricula) {
      return res.status(400).json({ message: 'La matrícula no coincide con la inscripción original' });
    }

    // Verificar que no exista ya una reinscripción para este semestre
    const reinscripcionExistente = await Alumno.findOne({
      matricula: data.matricula,
      tipo_registro: 'reinscripcion',
      semestre_reinscripcion: data.semestre_reinscripcion
    });

    if (reinscripcionExistente) {
      return res.status(400).json({ 
        message: `Ya existe una reinscripción para el semestre ${data.semestre_reinscripcion}` 
      });
    }

    // Validar rango de semestre
    const semestreNum = parseInt(data.semestre_reinscripcion);
    if (isNaN(semestreNum) || semestreNum < 2 || semestreNum > 6) {
      return res.status(400).json({ message: 'El semestre debe estar entre 2 y 6' });
    }

    const upperCaseData = toUpperData(data);
    upperCaseData.tipo_registro = 'reinscripcion';
    upperCaseData.semestre_reinscripcion = semestreNum;
    upperCaseData.inscripcion_original_id = inscripcionOriginal._id;
    upperCaseData.matricula = matriculaFinal; // Usar la matrícula correcta

    // Asegurar campos
    const estadoCivilNum = parseInt(data.datos_alumno?.estado_civil);
    if (!isNaN(estadoCivilNum)) upperCaseData.datos_alumno.estado_civil = estadoCivilNum;

    const dg = upperCaseData.datos_generales;
    dg.primera_opcion  = data.datos_generales.primera_opcion  || '';
    dg.segunda_opcion  = data.datos_generales.segunda_opcion  || '';
    dg.tercera_opcion  = data.datos_generales.tercera_opcion  || '';
    dg.cuarta_opcion   = data.datos_generales.cuarta_opcion   || '';

    dg.estado_nacimiento_general  = data.datos_generales.estado_nacimiento_general  || '';
    dg.municipio_nacimiento_general = data.datos_generales.municipio_nacimiento_general || '';
    dg.ciudad_nacimiento_general  = data.datos_generales.ciudad_nacimiento_general  || '';

    // Actualizar semestre en datos_alumno
    upperCaseData.datos_alumno.semestre = semestreNum;

    // Chequeo de cupo para paraescolar
    const nuevoPara = data.datos_generales?.paraescolar;
    if (nuevoPara) {
      const ok = await puedeAsignarParaescolar(nuevoPara);
      if (!ok) {
        return res.status(400).json({ message: `El paraescolar ${nuevoPara} ya alcanzó el límite de ${MAX_PARAESCOLAR} alumno(s).` });
      }
    }

    // Marcar registro completado
    upperCaseData.registro_completado = true;

    // Crear nuevo registro de reinscripción
    const nuevaReinscripcion = new Alumno(upperCaseData);
    await nuevaReinscripcion.save();

    // Generar PDF
    const datosAnidados = flattenToNested(upperCaseData);
    const nombreArchivo = `${datosAnidados.datos_alumno?.curp || 'formulario'}_reinscripcion_${semestreNum}.pdf`;
    await generarPDF(datosAnidados, nombreArchivo);

    res.status(200).json({
      message: 'Reinscripción guardada exitosamente y PDF generado',
      pdf_url: `/pdfs/${nombreArchivo}`,
      alumno: nuevaReinscripcion
    });

  } catch (err) {
    console.error('Error al guardar reinscripción o generar PDF:', err);
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Ya existe una reinscripción para este semestre' });
    }
    res.status(500).json({ message: err.message });
  }
});


router.post('/cargar-excel', upload.single('archivo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No se envió archivo' });

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const datos = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    if (!datos || datos.length === 0) {
      return res.status(400).json({ message: 'El archivo está vacío o mal formado' });
    }

    const nestedDocs = datos.map(flattenToNested);
    let procesados = 0;
    let errores = 0;

    for (const doc of nestedDocs) {
      try {
        delete doc._id;

        // Detectar y asignar tipo de registro automáticamente
        detectarYAsignarTipoRegistro(doc);

        // Si es inscripción y no tiene matrícula, generarla
        if (doc.tipo_registro === 'inscripcion' && doc.folio && !doc.matricula) {
          try {
            doc.matricula = await generarMatricula();
          } catch (err) {
            console.error('Error generando matrícula para folio', doc.folio, ':', err);
            // Continuar sin matrícula si hay error
          }
        }

        // Si es reinscripción, buscar inscripción original y asignar campos faltantes
        if (doc.tipo_registro === 'reinscripcion') {
          // Buscar inscripción original por matrícula o CURP
          let inscripcionOriginal = null;
          if (doc.matricula) {
            inscripcionOriginal = await Alumno.findOne({
              $or: [
                { matricula: doc.matricula, tipo_registro: 'inscripcion' },
                { matricula: doc.matricula, tipo_registro: { $exists: false } }
              ],
              semestre_reinscripcion: { $exists: false }
            });
          }
          
          if (!inscripcionOriginal && doc.datos_alumno?.curp) {
            inscripcionOriginal = await Alumno.findOne({
              'datos_alumno.curp': doc.datos_alumno.curp,
              $or: [
                { tipo_registro: 'inscripcion' },
                { tipo_registro: { $exists: false } }
              ],
              semestre_reinscripcion: { $exists: false }
            });
          }

          if (inscripcionOriginal) {
            doc.inscripcion_original_id = inscripcionOriginal._id;
            doc.matricula = inscripcionOriginal.matricula || doc.matricula;
            // Si la inscripción original no tiene matrícula, generarla
            if (!inscripcionOriginal.matricula && doc.matricula) {
              inscripcionOriginal.matricula = doc.matricula;
              await inscripcionOriginal.save();
            }
          }
        }

        const upperCaseData = toUpperData(doc);
        // Marcar registro como completado para que aparezca en la exportación
        upperCaseData.registro_completado = true;
        
        // Construir query de búsqueda según el tipo de registro
        let queryBusqueda = {};
        if (doc.folio) {
          queryBusqueda.folio = doc.folio;
        } else if (doc.matricula && doc.semestre_reinscripcion) {
          // Para reinscripciones, buscar por matrícula y semestre
          queryBusqueda = {
            matricula: doc.matricula,
            semestre_reinscripcion: doc.semestre_reinscripcion
          };
        } else if (doc.matricula) {
          // Para inscripciones con matrícula
          queryBusqueda = {
            matricula: doc.matricula,
            tipo_registro: 'inscripcion'
          };
        } else {
          // Si no hay identificador único, saltar este registro
          console.warn('⚠️ Registro sin folio ni matrícula, se omite:', doc);
          errores++;
          continue;
        }
        
        await Alumno.findOneAndUpdate(
          queryBusqueda,
          upperCaseData,
          { upsert: true, new: true }
        );
        
        procesados++;
      } catch (err) {
        console.error('Error procesando registro:', err);
        errores++;
      }
    }

    const mensaje = `✅ Procesados: ${procesados}${errores > 0 ? `, Errores: ${errores}` : ''}`;
    res.status(200).json({ message: mensaje });

  } catch (error) {
    console.error('❌ Error al cargar Excel:', error);
    res.status(500).json({ message: 'Error al procesar el archivo' });
  }
});

router.get('/reimprimir/:folio', async (req, res) => {
  try {
    const alumno = await Alumno.findOne({ folio: req.params.folio });
    if (!alumno || !alumno.registro_completado) {
      return res.status(404).json({ message: 'Folio no registrado o incompleto.' });
    }

    const datosAnidados = flattenToNested(alumno.toObject());
    const sufijo = alumno.tipo_registro === 'reinscripcion' 
      ? `_reinscripcion_${alumno.semestre_reinscripcion}` 
      : '';
    const nombreArchivo = `${datosAnidados.datos_alumno?.curp || 'formulario'}${sufijo}.pdf`;
    await generarPDF(datosAnidados, nombreArchivo);

    res.json({ pdf: `/pdfs/${nombreArchivo}` });
  } catch (err) {
    console.error('❌ Error al reimprimir PDF:', err);
    res.status(500).json({ message: 'Error interno al generar PDF.' });
  }
});

// Reimprimir por matrícula y semestre (para reinscripciones)
router.get('/reimprimir-reinscripcion/:matricula/:semestre', async (req, res) => {
  try {
    const { matricula, semestre } = req.params;
    const semestreNum = parseInt(semestre);
    
    if (isNaN(semestreNum) || semestreNum < 2 || semestreNum > 6) {
      return res.status(400).json({ message: 'Semestre inválido' });
    }

    const alumno = await Alumno.findOne({ 
      matricula: matricula,
      tipo_registro: 'reinscripcion',
      semestre_reinscripcion: semestreNum
    });
    
    if (!alumno || !alumno.registro_completado) {
      return res.status(404).json({ message: 'Reinscripción no encontrada o incompleta.' });
    }

    const datosAnidados = flattenToNested(alumno.toObject());
    const nombreArchivo = `${datosAnidados.datos_alumno?.curp || 'formulario'}_reinscripcion_${semestreNum}.pdf`;
    await generarPDF(datosAnidados, nombreArchivo);

    res.json({ pdf: `/pdfs/${nombreArchivo}` });
  } catch (err) {
    console.error('❌ Error al reimprimir PDF de reinscripción:', err);
    res.status(500).json({ message: 'Error interno al generar PDF.' });
  }
});

// ---------- Dashboard: búsqueda ----------
router.get('/dashboard/alumnos', async (req, res) => {
  const { folio, apellidos } = req.query;
  const query = {};
  if (folio) query.folio = folio;
  if (apellidos) query['datos_alumno.primer_apellido'] = { $regex: apellidos, $options: 'i' };

  try {
    const alumnos = await Alumno.find(query);
    res.json(alumnos);
  } catch (error) {
    res.status(500).json({ message: 'Error al buscar alumnos', error });
  }
});

router.get('/dashboard/alumnos/:id', async (req, res) => {
  try {
    const alumno = await Alumno.findById(req.params.id);
    if (!alumno) return res.status(404).json({ message: 'No encontrado' });
    res.json(alumno);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener alumno', error });
  }
});


router.put('/dashboard/alumnos/:id', async (req, res) => {
  try {
    const alumnoActual = await Alumno.findById(req.params.id);
    if (!alumnoActual) return res.status(404).json({ message: 'No encontrado' });

    const bodyUpper = toUpperData(req.body);
    const nuevoPara = bodyUpper?.datos_generales?.paraescolar;
    const previoPara = alumnoActual?.datos_generales?.paraescolar;
    const cambiando = nuevoPara && (nuevoPara.toUpperCase() !== (previoPara || '').toUpperCase());

    if (cambiando) {
      const ok = await puedeAsignarParaescolar(nuevoPara, alumnoActual._id);
      if (!ok) {
        return res.status(400).json({ message: `No se puede cambiar a ${nuevoPara}, ya alcanzó su límite de ${MAX_PARAESCOLAR}.` });
      }
    }

    const actualizado = await Alumno.findByIdAndUpdate(req.params.id, bodyUpper, { new: true });
    res.json(actualizado);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar alumno', error });
  }
});


router.post('/dashboard/alumnos', async (req, res) => {
  try {
    const { folio } = req.body;

    // Validar que el folio sea obligatorio
    if (!folio || !folio.trim()) {
      return res.status(400).json({ message: 'El folio es obligatorio' });
    }

    // Verificar si el folio ya existe
    const alumnoExistente = await Alumno.findOne({ folio: folio.trim() });
    if (alumnoExistente) {
      return res.status(400).json({ message: 'Este folio ya está en uso por otro alumno' });
    }

    const bodyUpper = toUpperData(req.body);
    const nuevoPara = bodyUpper?.datos_generales?.paraescolar;

    if (nuevoPara) {
      const ok = await puedeAsignarParaescolar(nuevoPara);
      if (!ok) {
        return res.status(400).json({ message: `El paraescolar ${nuevoPara} ya alcanzó el límite de ${MAX_PARAESCOLAR} alumno(s).` });
      }
    }

    const nuevoAlumno = new Alumno(bodyUpper);
    await nuevoAlumno.save();
    res.status(201).json(nuevoAlumno);
  } catch (error) {
    // Manejar error de folio duplicado de MongoDB
    if (error.code === 11000 || error.message.includes('duplicate')) {
      return res.status(400).json({ message: 'Este folio ya está en uso por otro alumno' });
    }
    res.status(500).json({ message: 'Error al crear alumno', error: error.message });
  }
});

router.delete('/dashboard/alumnos/:id', async (req, res) => {
  try {
    await Alumno.findByIdAndDelete(req.params.id);
    res.json({ message: 'Alumno eliminado' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar alumno', error });
  }
});

router.get('/exportar-excel', async (req, res) => {
  try {
    const alumnos = await Alumno.find({ registro_completado: true }).lean();
    if (!alumnos.length) {
      return res.status(404).json({ message: 'No hay alumnos registrados aún.' });
    }

    const datos = alumnos.map(al => ({
      folio: al.folio || '',
      // DATOS ALUMNO
      primer_apellido: al.datos_alumno?.primer_apellido || '',
      segundo_apellido: al.datos_alumno?.segundo_apellido || '',
      nombres: al.datos_alumno?.nombres || '',
      periodo_semestral: al.datos_alumno?.periodo_semestral || '',
      semestre: al.datos_alumno?.semestre || '',
      grupo: al.datos_alumno?.grupo || '',
      turno: al.datos_alumno?.turno || '',
      carrera: al.datos_alumno?.carrera || '',
      curp: al.datos_alumno?.curp || '',
      fecha_nacimiento: al.datos_alumno?.fecha_nacimiento || '',
      edad: al.datos_alumno?.edad || '',
      sexo: al.datos_alumno?.sexo || '',
      estado_nacimiento: al.datos_alumno?.estado_nacimiento || '',
      municipio_nacimiento: al.datos_alumno?.municipio_nacimiento || '',
      ciudad_nacimiento: al.datos_alumno?.ciudad_nacimiento || '',
      estado_civil: al.datos_alumno?.estado_civil || '',
      nacionalidad: al.datos_alumno?.nacionalidad || '',
      pais_extranjero: al.datos_alumno?.pais_extranjero || '',

      // DATOS GENERALES
      colonia: al.datos_generales?.colonia || '',
      domicilio: al.datos_generales?.domicilio || '',
      codigo_postal: al.datos_generales?.codigo_postal || '',
      telefono_alumno: al.datos_generales?.telefono_alumno || '',
      correo_alumno: al.datos_generales?.correo_alumno || '',
      paraescolar: al.datos_generales?.paraescolar || '',
      entrega_diagnostico: al.datos_generales?.entrega_diagnostico || '',
      detalle_enfermedad: al.datos_generales?.detalle_enfermedad || '',
      responsable_emergencia_nombre: al.datos_generales?.responsable_emergencia?.nombre || '',
      responsable_emergencia_telefono: al.datos_generales?.responsable_emergencia?.telefono || '',
      responsable_emergencia_parentesco: al.datos_generales?.responsable_emergencia?.parentesco || '',
      carta_poder: al.datos_generales?.carta_poder || '',
      tipo_sangre: al.datos_generales?.tipo_sangre || '',
      contacto_emergencia_nombre: al.datos_generales?.contacto_emergencia_nombre || '',
      contacto_emergencia_telefono: al.datos_generales?.contacto_emergencia_telefono || '',
      habla_lengua_indigena_respuesta: al.datos_generales?.habla_lengua_indigena?.respuesta || '',
      habla_lengua_indigena_cual: al.datos_generales?.habla_lengua_indigena?.cual || '',
      primera_opcion: al.datos_generales?.primera_opcion || '',
      segunda_opcion: al.datos_generales?.segunda_opcion || '',
      tercera_opcion: al.datos_generales?.tercera_opcion || '',
      cuarta_opcion: al.datos_generales?.cuarta_opcion || '',
      estado_nacimiento_general: al.datos_generales?.estado_nacimiento_general || '',
      municipio_nacimiento_general: al.datos_generales?.municipio_nacimiento_general || '',
      ciudad_nacimiento_general: al.datos_generales?.ciudad_nacimiento_general || '',

      // DATOS MÉDICOS
      numero_seguro_social: al.datos_medicos?.numero_seguro_social || '',
      unidad_medica_familiar: al.datos_medicos?.unidad_medica_familiar || '',
      enfermedad_cronica_respuesta: al.datos_medicos?.enfermedad_cronica_o_alergia?.respuesta || '',
      enfermedad_cronica_detalle: al.datos_medicos?.enfermedad_cronica_o_alergia?.detalle || '',
      discapacidad: al.datos_medicos?.discapacidad || '',

      // SECUNDARIA ORIGEN
      nombre_secundaria: al.secundaria_origen?.nombre_secundaria || '',
      regimen: al.secundaria_origen?.regimen || '',
      promedio_general: al.secundaria_origen?.promedio_general || '',
      modalidad: al.secundaria_origen?.modalidad || '',

      // TUTOR RESPONSABLE
      nombre_padre: al.tutor_responsable?.nombre_padre || '',
      telefono_padre: al.tutor_responsable?.telefono_padre || '',
      nombre_madre: al.tutor_responsable?.nombre_madre || '',
      telefono_madre: al.tutor_responsable?.telefono_madre || '',
      vive_con: al.tutor_responsable?.vive_con || '',

      // PERSONA EMERGENCIA
      persona_emergencia_nombre: al.persona_emergencia?.nombre || '',
      persona_emergencia_parentesco: al.persona_emergencia?.parentesco || '',
      persona_emergencia_telefono: al.persona_emergencia?.telefono || ''
    }));

    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(datos);
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Alumnos');

    const exportPath = path.join(__dirname, '../exports', 'alumnos_registrados.xlsx');
    xlsx.writeFile(workbook, exportPath);

    res.download(exportPath, 'alumnos_registrados.xlsx', (err) => {
      if (err) console.error('❌ Error al descargar:', err);
      try { fs.unlinkSync(exportPath); } catch (e) {}
    });

  } catch (err) {
    console.error('❌ Error al exportar Excel:', err);
    res.status(500).json({ message: 'Error al exportar datos.' });
  }
});

module.exports = router;
