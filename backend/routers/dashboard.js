// backend/routes/dashboard.js
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const eventoController = require('../controllers/eventoController');
const { uploadEventoImagen } = require('../utils/multerEvento');
const { authenticateToken, requireAdmin, requireSubdireccion } = require('../middleware/auth');

function handleUploadError(middleware) {
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message || 'Error al subir el archivo' });
      }
      next();
    });
  };
}

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Rutas de alumnos: accesibles para admin, subdireccion y control_escolar
router.get('/alumnos', dashboardController.getAllAlumnos);
router.get('/alumno/:id', dashboardController.getAlumno);
router.get('/alumno-por-folio/:folio', dashboardController.getAlumnoPorFolio);
router.get('/alumno-por-matricula/:matricula', dashboardController.getAlumnoPorMatricula);
router.get('/reinscripcion/:matricula/:semestre', dashboardController.getReinscripcionPorSemestre);
router.post('/alumnos', dashboardController.createAlumno);
router.put('/alumno/:id', dashboardController.updateAlumno);
router.delete('/alumno/:id', dashboardController.deleteAlumno);

// Rutas de logros: para admin y subdireccion
router.get('/logros', requireSubdireccion, dashboardController.getAllLogros);
router.get('/logro/:id', requireSubdireccion, dashboardController.getLogro);
router.post('/logro', requireSubdireccion, dashboardController.createLogro);
router.put('/logro/:id', requireSubdireccion, dashboardController.updateLogro);
router.delete('/logro/:id', requireSubdireccion, dashboardController.deleteLogro);

// Eventos (página Cultura y deporte — solo administrador)
router.get('/eventos', requireAdmin, eventoController.listForAdmin);
router.get('/evento/:id', requireAdmin, eventoController.getOne);
router.post(
  '/evento',
  requireAdmin,
  handleUploadError(uploadEventoImagen.single('imagen')),
  eventoController.create
);
router.put(
  '/evento/:id',
  requireAdmin,
  handleUploadError(uploadEventoImagen.single('imagen')),
  eventoController.update
);
router.delete('/evento/:id', requireAdmin, eventoController.remove);

module.exports = router;
