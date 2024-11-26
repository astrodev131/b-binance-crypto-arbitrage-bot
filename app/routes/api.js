const express = require('express');
const router = express.Router();
const Price = require('../models/price');
const Balance = require('../models/balance');

var isAuthenticated = function (req, res, next) {
  if (req.isAuthenticated())
    return next();
  res.json({
    status: 403,
    message: 'Access Forbidden.'
  });
}

module.exports = function(passport){

  router.get('/check', isAuthenticated, function(req, res) {
    const clientBinance = require('@libs/clientBinance')(req.user.apiKey, req.user.secretKey, req.user._id);

    var promisePrice = Price.findOne({});
    var promiseBalance = clientBinance.getBalances();
    var promiseOrders = clientBinance.getOrders();
    Promise.all([promisePrice, promiseBalance, promiseOrders]).then(function(values) {
      const currentPrice = values[0];
      const currentBalance = values[1];
      const openOrders = values[2];
      res.json({status: 200, prices: currentPrice.prices, exchangeInfo: currentPrice.exchangeInfo, balances: currentBalance, orders: openOrders});
    });
  });

  router.post('/add', isAuthenticated, async function(req, res) {
    const clientBinance = require('@libs/clientBinance')(req.user.apiKey, req.user.secretKey, req.user._id);
    const order = JSON.parse(req.body.order);
    await clientBinance.loadBalances();
    clientBinance.placeLimitOrder(order);
    res.redirect('/');
  });

  router.get('/cancel', isAuthenticated, async function(req, res) {
    const clientBinance = require('@libs/clientBinance')(req.user.apiKey, req.user.secretKey, req.user._id);
    const orderId = req.query.orderId;
    clientBinance.cancelOrder(orderId);
    res.redirect('/');
  });

  return router;
}
