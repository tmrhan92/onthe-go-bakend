const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  provider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  hours: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'completed', 'disputed'],
    default: 'pending'
  },
  providerRating: { type: Number },
  receiverRating: { type: Number },
  completedAt: { type: Date }
});

module.exports = mongoose.model('Transaction', transactionSchema);
