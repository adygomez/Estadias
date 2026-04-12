const path = require('path');
const fs = require('fs');
const Evento = require('../models/Evento');

function publicPathFromAbsolute(absPath) {
  const rel = path.relative(path.join(__dirname, '../public'), absPath);
  return '/' + rel.split(path.sep).join('/');
}

function unlinkPublicImage(imagenUrl) {
  if (!imagenUrl || typeof imagenUrl !== 'string') return;
  const clean = imagenUrl.replace(/^\//, '');
  if (!clean.startsWith('images/eventos/')) return;
  const abs = path.join(__dirname, '../public', clean);
  if (fs.existsSync(abs)) {
    try {
      fs.unlinkSync(abs);
    } catch (e) {
      console.error('No se pudo eliminar imagen:', abs, e.message);
    }
  }
}

exports.listForAdmin = async (req, res) => {
  try {
    const eventos = await Evento.find().sort({ orden: 1, createdAt: 1 });
    res.json(eventos);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const evento = await Evento.findById(req.params.id);
    if (!evento) {
      return res.status(404).json({ message: 'Evento no encontrado' });
    }
    res.json(evento);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const titulo = (req.body.titulo || '').trim();
    const descripcion = (req.body.descripcion || '').trim();
    let orden = parseInt(req.body.orden, 10);
    if (Number.isNaN(orden)) {
      const last = await Evento.findOne().sort({ orden: -1 });
      orden = last ? last.orden + 1 : 0;
    }

    if (!titulo || !descripcion) {
      if (req.file) unlinkPublicImage(publicPathFromAbsolute(req.file.path));
      return res.status(400).json({ message: 'Título y descripción son obligatorios' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Debes subir una imagen' });
    }

    const imagen = publicPathFromAbsolute(req.file.path);

    const evento = new Evento({ titulo, descripcion, orden, imagen });
    await evento.save();
    res.status(201).json(evento);
  } catch (err) {
    if (req.file) unlinkPublicImage(publicPathFromAbsolute(req.file.path));
    res.status(500).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const evento = await Evento.findById(req.params.id);
    if (!evento) {
      if (req.file) unlinkPublicImage(publicPathFromAbsolute(req.file.path));
      return res.status(404).json({ message: 'Evento no encontrado' });
    }

    const titulo = (req.body.titulo ?? evento.titulo).toString().trim();
    const descripcion = (req.body.descripcion ?? evento.descripcion).toString().trim();
    let orden = parseInt(req.body.orden, 10);
    if (Number.isNaN(orden)) orden = evento.orden;

    if (!titulo || !descripcion) {
      if (req.file) unlinkPublicImage(publicPathFromAbsolute(req.file.path));
      return res.status(400).json({ message: 'Título y descripción son obligatorios' });
    }

    let imagen = evento.imagen;
    if (req.file) {
      const nueva = publicPathFromAbsolute(req.file.path);
      unlinkPublicImage(evento.imagen);
      imagen = nueva;
    }

    evento.titulo = titulo;
    evento.descripcion = descripcion;
    evento.orden = orden;
    evento.imagen = imagen;
    await evento.save();
    res.json(evento);
  } catch (err) {
    if (req.file) unlinkPublicImage(publicPathFromAbsolute(req.file.path));
    res.status(500).json({ message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const evento = await Evento.findByIdAndDelete(req.params.id);
    if (!evento) {
      return res.status(404).json({ message: 'Evento no encontrado' });
    }
    unlinkPublicImage(evento.imagen);
    res.json({ message: 'Evento eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
