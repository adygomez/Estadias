// backend/controllers/dashboardController.js
const Alumno = require('../models/Alumno');
const Logro = require('../models/Logro');
const detectarYAsignarTipoRegistro = require('../utils/detectarTipoRegistro');

// Función para generar matrícula (copiada de routers/alumno.js para uso en este módulo)
async function generarMatricula() {
  const año = new Date().getFullYear();
  const añoCorto = año.toString().slice(-2);
  const prefijoFijo = '32305272';
  const numeroInicial = 522;
  
  const patronRegex = `^${añoCorto}${prefijoFijo}\\d{4}$`;
  
  const inscripcionesConMatricula = await Alumno.find({
    $or: [
      { tipo_registro: 'inscripcion' },
      { tipo_registro: { $exists: false } }
    ],
    matricula: { 
      $exists: true, 
      $ne: null,
      $regex: patronRegex
    },
    semestre_reinscripcion: { $exists: false }
  }).sort({ matricula: -1 });
  
  let siguienteNumero = numeroInicial;
  
  if (inscripcionesConMatricula.length > 0) {
    const ultimaMatricula = inscripcionesConMatricula[0].matricula;
    const numeroStr = ultimaMatricula.slice(-4);
    const ultimoNumero = parseInt(numeroStr, 10);
    if (!isNaN(ultimoNumero) && ultimoNumero >= numeroInicial) {
      siguienteNumero = ultimoNumero + 1;
    }
  }
  
  const numeroFormateado = siguienteNumero.toString().padStart(4, '0');
  const matricula = `${añoCorto}${prefijoFijo}${numeroFormateado}`;
  
  return matricula;
}

// Obtener todos los alumnos
exports.getAllAlumnos = async (req, res) => {
  try {
    const alumnos = await Alumno.find();
    res.json(alumnos);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Obtener un alumno por ID
exports.getAlumno = async (req, res) => {
  try {
    const alumno = await Alumno.findById(req.params.id);
    res.json(alumno);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Crear un nuevo alumno
exports.createAlumno = async (req, res) => {
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

    const nuevoAlumno = new Alumno(req.body);
    await nuevoAlumno.save();
    res.status(201).json(nuevoAlumno);
  } catch (err) {
    // Manejar error de folio duplicado de MongoDB
    if (err.code === 11000 || err.message.includes('duplicate')) {
      return res.status(400).json({ message: 'Este folio ya está en uso por otro alumno' });
    }
    res.status(500).json({ message: err.message });
  }
};

// Actualizar un alumno
exports.updateAlumno = async (req, res) => {
  try {
    const { folio } = req.body;
    const alumnoId = req.params.id;

    // Validar que el folio sea obligatorio
    if (!folio || !folio.trim()) {
      return res.status(400).json({ message: 'El folio es obligatorio' });
    }

    // Verificar si el folio ya existe en otro alumno
    const alumnoExistente = await Alumno.findOne({ folio: folio.trim() });
    if (alumnoExistente && alumnoExistente._id.toString() !== alumnoId) {
      return res.status(400).json({ message: 'Este folio ya está en uso por otro alumno' });
    }

    await Alumno.findByIdAndUpdate(req.params.id, req.body);
    res.json({ message: 'Alumno actualizado correctamente' });
  } catch (err) {
    // Manejar error de folio duplicado de MongoDB
    if (err.code === 11000 || err.message.includes('duplicate')) {
      return res.status(400).json({ message: 'Este folio ya está en uso por otro alumno' });
    }
    res.status(500).json({ message: err.message });
  }
};

// Borrar un alumno
exports.deleteAlumno = async (req, res) => {
  try {
    await Alumno.findByIdAndDelete(req.params.id);
    res.json({ message: 'Alumno eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Obtener alumno por folio (solo inscripción inicial)
exports.getAlumnoPorFolio = async (req, res) => {
  try {
    const { folio } = req.params;
    
    // Buscar: nuevo (con tipo_registro) o antiguo (sin tipo_registro pero con folio)
    // Excluir reinscripciones (que tienen semestre_reinscripcion)
    const inscripcion = await Alumno.findOne({ 
      folio: folio,
      $or: [
        { tipo_registro: 'inscripcion' },
        { tipo_registro: { $exists: false } } // Registros antiguos sin tipo_registro
      ],
      semestre_reinscripcion: { $exists: false } // Asegurar que no sea reinscripción
    });
    
    if (!inscripcion) {
      return res.status(404).json({ message: 'No se encontró inscripción con ese folio' });
    }
    
    // Si es registro antiguo, asignar tipo_registro automáticamente y actualizar
    if (!inscripcion.tipo_registro) {
      detectarYAsignarTipoRegistro(inscripcion);
      
      // Si no tiene matrícula y es inscripción, generarla
      if (inscripcion.tipo_registro === 'inscripcion' && !inscripcion.matricula) {
        try {
          inscripcion.matricula = await generarMatricula();
        } catch (err) {
          console.error('Error generando matrícula:', err);
          // Continuar sin matrícula si hay error
        }
      }
      
      // Guardar los cambios
      await inscripcion.save();
    }
    
    res.json(inscripcion);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Obtener alumno por matrícula (inscripción + semestres disponibles)
exports.getAlumnoPorMatricula = async (req, res) => {
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
      return res.status(404).json({ message: 'No se encontró inscripción con esa matrícula' });
    }
    
    // Si es registro antiguo, asignar tipo_registro automáticamente y actualizar
    if (!inscripcion.tipo_registro) {
      detectarYAsignarTipoRegistro(inscripcion);
      
      // Si no tiene matrícula y es inscripción, generarla
      if (inscripcion.tipo_registro === 'inscripcion' && !inscripcion.matricula) {
        try {
          inscripcion.matricula = await generarMatricula();
        } catch (err) {
          console.error('Error generando matrícula:', err);
          // Continuar sin matrícula si hay error
        }
      }
      
      // Guardar los cambios
      await inscripcion.save();
    }
    
    // Buscar todas las reinscripciones
    const matriculaBuscar = inscripcion.matricula || matricula;
    const reinscripciones = await Alumno.find({
      matricula: matriculaBuscar,
      tipo_registro: 'reinscripcion'
    }).sort({ semestre_reinscripcion: 1 });
    
    // Obtener lista de semestres disponibles
    const semestresDisponibles = reinscripciones.map(r => ({
      semestre: r.semestre_reinscripcion,
      _id: r._id,
      registro_completado: r.registro_completado
    }));
    
    res.json({
      inscripcion: inscripcion,
      semestresDisponibles: semestresDisponibles,
      matricula: inscripcion.matricula || matricula
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Obtener reinscripción específica por matrícula y semestre
exports.getReinscripcionPorSemestre = async (req, res) => {
  try {
    const { matricula, semestre } = req.params;
    const semestreNum = parseInt(semestre);
    
    if (isNaN(semestreNum) || semestreNum < 2 || semestreNum > 6) {
      return res.status(400).json({ message: 'Semestre inválido. Debe ser entre 2 y 6' });
    }
    
    // Buscar reinscripción específica
    const reinscripcion = await Alumno.findOne({
      matricula: matricula,
      tipo_registro: 'reinscripcion',
      semestre_reinscripcion: semestreNum
    });
    
    if (!reinscripcion) {
      return res.status(404).json({ message: `No se encontró reinscripción para el semestre ${semestreNum}` });
    }
    
    res.json(reinscripcion);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ========== LOGROS ==========

// Obtener todos los logros
exports.getAllLogros = async (req, res) => {
  try {
    const logros = await Logro.find({ activo: true }).sort({ orden: 1 });
    res.json(logros);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Obtener un logro por ID
exports.getLogro = async (req, res) => {
  try {
    const logro = await Logro.findById(req.params.id);
    if (!logro) {
      return res.status(404).json({ message: 'Logro no encontrado' });
    }
    res.json(logro);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Crear un nuevo logro
exports.createLogro = async (req, res) => {
  try {
    const { titulo, descripcion, orden } = req.body;
    
    if (!titulo || !descripcion || !orden) {
      return res.status(400).json({ message: 'Todos los campos son requeridos' });
    }

    const logro = new Logro({ titulo, descripcion, orden });
    await logro.save();
    res.status(201).json(logro);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Ya existe un logro con ese orden' });
    }
    res.status(500).json({ message: err.message });
  }
};

// Actualizar un logro
exports.updateLogro = async (req, res) => {
  try {
    const { titulo, descripcion, orden } = req.body;
    const logro = await Logro.findByIdAndUpdate(
      req.params.id,
      { titulo, descripcion, orden },
      { new: true, runValidators: true }
    );
    
    if (!logro) {
      return res.status(404).json({ message: 'Logro no encontrado' });
    }
    
    res.json(logro);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Ya existe un logro con ese orden' });
    }
    res.status(500).json({ message: err.message });
  }
};

// Borrar un logro (soft delete - solo marca como inactivo)
exports.deleteLogro = async (req, res) => {
  try {
    const logro = await Logro.findByIdAndUpdate(
      req.params.id,
      { activo: false },
      { new: true }
    );
    
    if (!logro) {
      return res.status(404).json({ message: 'Logro no encontrado' });
    }
    
    res.json({ message: 'Logro eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
