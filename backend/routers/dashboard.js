const express = require('express');
const router = express.Router();
const eventoController = require('../controllers/eventoController');
const { uploadEventoImagen } = require('../utils/multerEvento');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

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

router.use(authenticateToken);

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
