// backend/routes/dashboard.js
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateToken, requireAdmin, requireSubdireccion } = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Rutas de alumnos: accesibles para admin, subdireccion y control_escolar
router.get('/alumnos', dashboardController.getAllAlumnos);
router.get('/alumno/:id', dashboardController.getAlumno);
router.post('/alumnos', dashboardController.createAlumno);
router.put('/alumno/:id', dashboardController.updateAlumno);
router.delete('/alumno/:id', dashboardController.deleteAlumno);

// Rutas de logros: para admin y subdireccion
router.get('/logros', requireSubdireccion, dashboardController.getAllLogros);
router.get('/logro/:id', requireSubdireccion, dashboardController.getLogro);
router.post('/logro', requireSubdireccion, dashboardController.createLogro);
router.put('/logro/:id', requireSubdireccion, dashboardController.updateLogro);
router.delete('/logro/:id', requireSubdireccion, dashboardController.deleteLogro);

module.exports = router;
