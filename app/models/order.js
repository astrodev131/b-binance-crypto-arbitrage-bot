var mongoose = require('mongoose');

module.exports = mongoose.model('order', {
  userId: mongoose.Types.ObjectId,
  orderId: Number,
  clientOrderId: String,
  altCoin: String,
  mainCoin: String,
  stableCoin: String,
  symbol: String,
  quantity: Number,
  executedQty: Number,
  price: Number,
  profitPercent: Number,
  limitPrice: Number,
  lossPercent: Number,
  cancelPrice: Number,
  status: Number,
  side: String,
  type: String,
  transactTime: Number
});