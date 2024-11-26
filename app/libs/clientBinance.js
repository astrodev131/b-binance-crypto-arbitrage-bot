const Binance = require('binance-api-node').default;
const Balance = require('../models/balance');
const Order = require('../models/order');
const orderStatus = {
  NEW: 1,
  PARTIALLY_FILLED: 2,
  FILLED: 3,
  CANCELED: 4,
  REJECTED: 5,
  EXPIRED: 6,
  PROCESSED: 7
}

class ClientBinance {

  constructor(apiKey, secretKey, userId) {
    this.binance = new Binance({
      apiKey: apiKey,
      apiSecret: secretKey,
      useServerTime: true
    });
    this.userId = userId;
  }

  async loadBalances() {
    try {
      const userBalance = await Balance.findOne({ 'userId': this.userId });
      this.userBalance = userBalance.balance;
    } catch(err) {
      if (err)
        console.log('Error while retrieving user balances: ' + err);
    }
  }

  async getBalances() {
    await this.loadBalances();
    return this.userBalance;
  }

  async fetchBalances() {
    try {
      const accountInfo = await this.binance.accountInfo({recvWindow: 60000});
      const newBalance = {balance: accountInfo.balances, userId: this.userId};
      Balance.updateOne({userId: this.userId}, newBalance, {upsert: true}, function(err) {
        if(err)
          console.log('Error while updating user balance' + err);
      });
      this.userBalance = accountInfo.balances;
      return this.userBalance;
    } catch(err) {
      if(err)
        console.log('Error while fetching user balance: ' + err);
    }
  }

  getAssetBalance(asset, type = 'free') {
    const balance = this.userBalance.filter(assetBalance => {
      return assetBalance.asset === asset
    });
    if(balance.length == 0)
      return 0;
    return balance[0][type];
  }

  async getOrders(status = 'NEW') {
    try {
      var orders = await Order.find({userId: this.userId, status: orderStatus[status]});
      return orders;
    } catch(err) {
      if (err)
        console.log('Error while retrieving user orders: ' + err);
    }
  }

  async placeLimitOrder(order) {
    if(!this.userBalance || this.userBalance.length == 0)
      return;
   
    var limitOrder = {};
    limitOrder.quantity     = parseFloat(this.getAssetBalance(order.altCoin));
    if(limitOrder.quantity < order.minQty)
      return;
    limitOrder.quantity     = Math.floor(limitOrder.quantity / order.stepSize) * order.stepSize;
    limitOrder.symbol       = order.symbol;
    limitOrder.side         = 'SELL';
    limitOrder.type         = 'LIMIT';
    limitOrder.price        = order.limitPrice;
    limitOrder.timeInForce  = 'GTC';
    limitOrder.recvWindow   = 60000;
    console.log('New limit order from userId: ' + this.userId);
    console.log(limitOrder);

    try {
      var orderResult = await this.binance.order(limitOrder);
      console.log('Limit order result for userId: ' + this.userId);
      console.log(orderResult);
      var newOrder = new Order();
      newOrder.userId         = this.userId;
      newOrder.altCoin        = order.altCoin;
      newOrder.mainCoin       = order.mainCoin;
      newOrder.stableCoin     = order.stableCoin;
      newOrder.profitPercent  = order.profitPercent;
      newOrder.limitPrice     = orderResult.price;
      newOrder.lossPercent    = order.lossPercent;
      newOrder.cancelPrice    = order.cancelPrice;
      newOrder.symbol         = orderResult.symbol;
      newOrder.quantity       = orderResult.origQty;
      newOrder.executedQty    = 0;
      newOrder.orderId        = orderResult.orderId;
      newOrder.clientOrderId  = orderResult.clientOrderId;
      newOrder.transactTime   = orderResult.transactTime;
      newOrder.status         = orderStatus[orderResult.status];
      newOrder.side           = orderResult.side;
      newOrder.type           = 'LIMIT';
      newOrder.save(function(err) {
        if (err) {
          console.log('Error in saving new limit order: ' + err);
        }
      });
      console.log('Limit order record in db for userId: ' + this.userId);
      console.log(newOrder);
    } catch(err) {
      if (err) {
        console.log('Failed to place limit order: ' + err);
      }
    }
  }

  async placeMarketOrder(symbol, quantity) {
    var marketOrder = {};
    marketOrder.symbol = symbol;
    marketOrder.side = 'SELL';
    marketOrder.type = 'MARKET';
    marketOrder.quantity = quantity;
    marketOrder.recvWindow = 60000;
    console.log('New market order from userId: ' + this.userId);
    console.log(marketOrder);

    try {
      var orderResult = await this.binance.order(marketOrder);
      console.log('Market order result for userId: ' + this.userId);
      console.log(orderResult);
      var newOrder = new Order();
      newOrder.userId         = this.userId;
      newOrder.symbol         = orderResult.symbol;
      newOrder.orderId        = orderResult.orderId;
      newOrder.clientOrderId  = orderResult.clientOrderId;
      newOrder.transactTime   = orderResult.transactTime;
      newOrder.limitPrice     = orderResult.price;
      newOrder.status         = orderStatus[orderResult.status];
      newOrder.side           = orderResult.side;
      newOrder.type           = 'MARKET';
      newOrder.save(function(err) {
        if (err) {
          console.log('Error in saving new market order: ' + err);
        }
      });
      console.log('Market order record in db for userId: ' + this.userId);
      console.log(newOrder);
    } catch(err) {
      if (err) {
        console.log('Failed to place market order: ' + err);
      }
    }
  }

  async checkOrder(orderId, orderSymbol) {
    try {
      var checkResult = await this.binance.getOrder({
        symbol: orderSymbol,
        orderId: orderId,
        recvWindow: 60000
      });
      if(checkResult.status != 'NEW') {
        Order.updateOne(
          {userId: this.userId, orderId: orderId},
          {status: orderStatus[checkResult.status], executedQty: checkResult.executedQty, price: checkResult.price},
          function(err) {
            if(err)
              console.log('Error while updating order status: ' + err);
          }
        );
      }
    } catch(err) {
      if (err)
        console.log('Error while checking user order: ' + err);
    }
  }

  async cancelOrder(orderId, orderSymbol = '', orderCheck = true) {
    try {
      if(orderCheck) {
        var openOrder = await Order.findOne({userId: this.userId, orderId: orderId, status: orderStatus.NEW});
        if(!openOrder)
          return;
        orderSymbol = openOrder.symbol;
      }
      var cancelResult = await this.binance.cancelOrder({
        symbol: orderSymbol,
        orderId: orderId,
        recvWindow: 60000
      });
      console.log('Order canceled from userId: ' + this.userId);
      console.log(cancelResult);
      Order.updateOne({userId: this.userId, orderId: orderId}, {status: orderStatus.CANCELED},
        function(err) {
          if(err)
            console.log('Error while updating order status: ' + err);
        }
      );
      return cancelResult;
    } catch(err) {
      if (err)
        console.log('Error while canceling user order: ' + err);
    }
  }
}

module.exports = function(apiKey, secretKey, userId) {
  return new ClientBinance(apiKey, secretKey, userId);
};