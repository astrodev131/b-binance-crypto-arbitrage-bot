var mongoose = require('mongoose');

module.exports = mongoose.model('price', {
  prices: Object,
  exchangeInfo: Object
});