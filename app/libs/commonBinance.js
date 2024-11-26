const Binance = require('binance-api-node').default;
const Users = require('../models/user');
const Price = require('../models/price');
const Balance = require('../models/balance');
const Order = require('../models/order');
const mainCoin = ['BTC', 'ETH', 'BNB', 'XRP'];

class CommonBinance {

  constructor() {
    this.binance = Binance();
    this.stableCoin = 'USDT';
  }

  async getInfo() {
    const promisePrices = this.binance.prices({recvWindow: 60000});
    const promiseExchangeInfo = this.binance.exchangeInfo({recvWindow: 60000});
    await Promise.all([promisePrices, promiseExchangeInfo]).then(function(values) {
      this.prices = values[0];
      this.exchangeInfo = values[1].symbols;
      Price.updateOne({}, {prices: this.prices, exchangeInfo: this.exchangeInfo}, {upsert: true}, function(err) {
        if (err) {
          console.log('Error in saving price: ' + err);
        }
      });
    }.bind(this));

    // Object.keys(prices).forEach(function(symbol) {
    //   var priceValue = prices[symbol];
    //   var newPrice = new Price();
    //   newPrice.symbol = symbol;
    //   newPrice.value = priceValue;
    //   var priceData = newPrice.toObject();
    //   delete priceData._id;
    //   Price.updateOne({symbol: symbol}, priceData, {upsert: true}, function(err) {
    //     if(err) {
    //       console.log('Error in saving price: ' + err);
    //       throw err;
    //     }
    //   });
    // });
  }

  updateAll() {
    Users.find({}, function(err, users) {
      if (err)
        console.log('db user list retreive error' + err);
      users.forEach(function(user) {
        this.updateUser(user);
      }.bind(this));
    }.bind(this));
  }

  updateUser(user) {
    const clientBinance = require('./clientBinance')(user.apiKey, user.secretKey, user._id);
    var promiseBalance = clientBinance.fetchBalances();
    var promiseOpenOrders = clientBinance.getOrders('NEW');
    var promiseFilledOrders = clientBinance.getOrders('FILLED');
    Promise.all([promiseBalance, promiseOpenOrders, promiseFilledOrders]).then(function(values) {
      const openOrders = values[1];
      const filledOrders = values[2];
      openOrders.forEach(function(openOrder) {
        const currentPrice = this.prices[openOrder.symbol];
        if (currentPrice < openOrder.cancelPrice) {
          clientBinance.cancelOrder(openOrder.orderId, openOrder.symbol, false);
          var orderPromise = new Promise((resolve, reject) => {
            setTimeout(function(){
              const cancelSymbol = openOrder.altCoin + openOrder.stableCoin;
              const symbolInfo = this.getRecord(this.exchangeInfo, 'symbol', cancelSymbol);
              if(!symbolInfo) {
                console.log('Unable to place cancellation order(not supported)');
                resolve();
              }
              var assetBalance = parseFloat(clientBinance.getAssetBalance(openOrder.altCoin, 'free'));
              assetBalance = assetBalance + parseFloat(clientBinance.getAssetBalance(openOrder.altCoin, 'lock'));
              var stepSize = symbolInfo.filters[2].stepSize;
              stepSize = parseFloat(stepSize.replace(/0+$/g, ''));
              assetBalance = Math.floor(assetBalance / stepSize) * stepSize;
              if(!this.checkQuantity(symbolInfo, assetBalance)) {
                console.log('Unable to place cancellation order(LOT_SIZE)');
                resolve();
              }
              const marketPrice = this.prices[cancelSymbol];
              if(!this.checkNotional(symbolInfo, assetBalance, marketPrice)) {
                console.log('Unable to place cancellation order(MIN_NOTIONAL)');
                resolve();
              }
              clientBinance.placeMarketOrder(cancelSymbol, assetBalance);
              resolve();
            }, 2000);
          });
          orderPromise.then(function(){});
        } else {
          clientBinance.checkOrder(openOrder.orderId, openOrder.symbol);
        }
      }.bind(this));

      filledOrders.forEach(function(filledOrder) {
        const targetSymbol = filledOrder.mainCoin + filledOrder.stableCoin;
        const symbolInfo = this.getRecord(this.exchangeInfo, 'symbol', targetSymbol);
        if(!symbolInfo) {
          console.log('Unable to process order(not supported)');
          return;
        }
        var resultQuantity = filledOrder.executedQty * filledOrder.price;
        var stepSize = symbolInfo.filters[2].stepSize;
        stepSize = parseFloat(stepSize.replace(/0+$/g, ''));
        resultQuantity = Math.floor(resultQuantity / stepSize) * stepSize;
        if(!this.checkQuantity(symbolInfo, resultQuantity)) {
          console.log('Unable to place market order(LOT_SIZE)');
          return;
        }
        const marketPrice = this.prices[targetSymbol];
        if(!this.checkNotional(symbolInfo, resultQuantity, marketPrice)) {
          console.log('Unable to place market order(MIN_NOTIONAL)');
          return;
        }
        this.stableCoin = filledOrder.stableCoin;
        clientBinance.placeMarketOrder(targetSymbol, resultQuantity);
        Order.updateOne(
          {userId: filledOrder.userId, orderId: filledOrder.orderId},
          {status: clientBinance.orderStatus.PROCESSED},
          function(err) {
            if(err)
              console.log('Error while updating order status: ' + err);
          }
        );
      }.bind(this));

      if(!filledOrders) {
        mainCoin.forEach(function(maincoin) {
          const targetSymbol = maincoin + this.stableCoin;
          const symbolInfo = this.getRecord(this.exchangeInfo, 'symbol', targetSymbol);
          if(!symbolInfo) {
            console.log('Unable to process gunbot result(not supported)');
            return;
          }
          var resultQuantity = parseFloat(clientBinance.getAssetBalance(maincoin, 'free'));
          var stepSize = symbolInfo.filters[2].stepSize;
          stepSize = parseFloat(stepSize.replace(/0+$/g, ''));
          resultQuantity = Math.floor(resultQuantity / stepSize) * stepSize;
          if(!this.checkQuantity(symbolInfo, resultQuantity)) {
            console.log('Unable to place market order(LOT_SIZE) --- gunbot');
            return;
          }
          const marketPrice = this.prices[targetSymbol];
          if(!this.checkNotional(symbolInfo, resultQuantity, marketPrice)) {
            console.log('Unable to place market order(MIN_NOTIONAL) --- gunbot');
            return;
          }
          clientBinance.placeMarketOrder(targetSymbol, resultQuantity);
        })
      }
    }.bind(this));
  }

  getRecord(records, field, value) {
    const targetRecord = records.filter(record => {
      return record[field] === value
    });
    if(targetRecord.length > 0)
      return targetRecord[0];
    return null;
  }

  checkQuantity(symbolInfo, assetBalance) {
    const minQty = parseFloat(symbolInfo.filters[2].minQty.replace(/0+$/g, ''));
    if(assetBalance >= minQty)
      return true;
    return false;
  }

  checkNotional(symbolInfo, assetBalance, quantity) {
    const minNotional = parseFloat(symbolInfo.filters[3].minNotional.replace(/0+$/g, ''));
    if(assetBalance * quantity >= minNotional)
      return true;
    return false;
  }
}


module.exports = new CommonBinance();