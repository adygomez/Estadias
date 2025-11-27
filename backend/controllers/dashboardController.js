// backend/controllers/dashboardController.js
const Alumno = require('../models/Alumno');
const Logro = require('../models/Logro');

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

// Actualizar un alumno
exports.updateAlumno = async (req, res) => {
  try {
    await Alumno.findByIdAndUpdate(req.params.id, req.body);
    res.json({ message: 'Alumno actualizado correctamente' });
  } catch (err) {
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
