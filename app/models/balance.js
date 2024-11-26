var mongoose = require('mongoose');

module.exports = mongoose.model('balance', {
  userId: mongoose.Types.ObjectId,
  balance: Object
});