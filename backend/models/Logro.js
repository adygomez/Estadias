const mongoose = require('mongoose');

const logroSchema = new mongoose.Schema({
  titulo: { 
    type: String, 
    required: true 
  },
  descripcion: { 
    type: String, 
    required: true 
  },
  orden: { 
    type: Number, 
    required: true,
    unique: true,
    min: 1
  },
  activo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true // Agrega createdAt y updatedAt automáticamente
});

module.exports = mongoose.model('Logro', logroSchema);













