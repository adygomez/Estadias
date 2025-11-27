// backend/routes/dashboard.js
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Todas las rutas del dashboard requieren autenticación y ser admin
router.use(authenticateToken);
router.use(requireAdmin);

router.get('/alumnos', dashboardController.getAllAlumnos);
router.get('/alumno/:id', dashboardController.getAlumno);
router.put('/alumno/:id', dashboardController.updateAlumno);
router.delete('/alumno/:id', dashboardController.deleteAlumno);

// Rutas de logros (requieren autenticación y ser admin)
router.get('/logros', dashboardController.getAllLogros);
router.get('/logro/:id', dashboardController.getLogro);
router.post('/logro', dashboardController.createLogro);
router.put('/logro/:id', dashboardController.updateLogro);
router.delete('/logro/:id', dashboardController.deleteLogro);

module.exports = router;
