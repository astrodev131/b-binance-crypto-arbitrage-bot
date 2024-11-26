const mainCoin = ['BTC', 'ETH', 'BNB', 'XRP'];
const stableCoin = ['USDT', 'TUSD', 'USDC', 'USDS', 'PAX'];
var prices = {};
var exchangeInfo = {};
var balances = {};
var orders = {};

var tick = function() {
  $.ajax({
    url: 'api/check',
    dataType: 'json',
    success: function(res) {
      if(res.status != 200) {
        alert(res.message);
        return;
      }
      prices = res.prices;
      balances = res.balances;
      console.log(balances);
      exchangeInfo = res.exchangeInfo;
      orders = res.orders;
      checkPrice();
      checkOrder();
    },
    error: function() {
      console.log('Server Error!');
    }
  });
}

var checkPrice = function() {
  if($('.price-card').length == 0) {
    $('#dashboard').html('').addClass('row');
    mainCoin.forEach(function(maincoin) {
      var cardStr = '<div class="card price-card mb-4 box-shadow">';
      cardStr = cardStr + '<h4 class="asset-name text-danger">' + maincoin + '</h4>';
      cardStr = cardStr + '<div class="card-info text-center">';
      stableCoin.forEach(function(stablecoin) {
        const targetSymbol = maincoin + stablecoin;
        var targetPrice = prices[targetSymbol];
        if(!targetPrice)
          targetPrice = '';
        cardStr = cardStr + '<div class="mb-2">' + targetSymbol + ': ' + targetPrice + '</div>';
      });
      cardStr = cardStr + '</div>';
      cardStr = '<div class="col-md-6" id="' + maincoin + '-PRICECARD">' + cardStr + '</div>';
      $('#dashboard').append(cardStr);
    });

    var calcCard = '<div class="card calc-card mb-4 box-shadow">';
    calcCard = calcCard + '<h4 class="asset-name text-primary">CALCULATOR</h4>';
    calcCard = calcCard + '<div class="card-info text-center">';
    ///////////////////////////////////////////
    calcCard = calcCard + '<div class="mb-3">';
    calcCard = calcCard + '<label for="altcoin-box">Alt Coin:</label>';
    calcCard = calcCard + '<select id="altcoin-box" onchange="reloadTable()">';
    balances.forEach(function(balance) {
      var asset = balance.asset;
      if(asset.indexOf('USD') != -1 || asset == 'PAX')
        return;
      if(balance.free != 0) {
        calcCard = calcCard + '<option value="' + asset + '">' + asset + '</option>';
        return;
      }
    });
    calcCard = calcCard + '</select>';
    calcCard = calcCard + '</div>';
    ///////////////////////////////////////////
    calcCard = calcCard + '<div class="mb-3">';
    calcCard = calcCard + '<span for="maincoin-box">Main Coin:</span>';
    calcCard = calcCard + '<select id="maincoin-box" onchange="reloadTable()">';
    mainCoin.forEach(function(coin) {
      calcCard = calcCard + '<option value="' + coin + '">' + coin + '</option>';
    });
    calcCard = calcCard + '</select>';
    calcCard = calcCard + '</div>';
    ///////////////////////////////////////////
    calcCard = calcCard + '<div class="mb-3">';
    calcCard = calcCard + '<span for="stablecoin-box">Stable Coin:</span>';
    calcCard = calcCard + '<select id="stablecoin-box" onchange="reloadTable()">';
    stableCoin.forEach(function(coin) {
      calcCard = calcCard + '<option value="' + coin + '">' + coin + '</option>';
    });
    calcCard = calcCard + '</select>';
    calcCard = calcCard + '</div>';
    ///////////////////////////////
    calcCard = calcCard + '<div class="mb-3"><span>Balance: </span><span class="balance-free"></span></div>';

    calcCard = calcCard + '<div class="mb-3"><span class="symbol"></span>: <span class="asset-price"></span></div>';
    calcCard = calcCard + '<div class="mb-3"><span>Profit Percent:</span><input type="number" id="PROFIT-PERCENT" class="form-control" value="1" min="0" onchange="calcLimitPrice()"> %</div>';
    calcCard = calcCard + '<div class="mb-3"><span>Limit Price: </span><span class="limit-price"></span></div>';
    calcCard = calcCard + '<div class="mb-3"><span>Main Coin Amount:</span> <span class="coin-amount"></span></div>';
    calcCard = calcCard + '<div class="mb-3"><span>Loss Limit:</span><input type="number" id="LOSS-PERCENT" class="form-control" value="1" min="0" onchange="calcCancelPrice()"> %</div>';
    calcCard = calcCard + '<div class="mb-3"><span>Cancel Price:</span> <span class="cancel-price"></span></div>';
    calcCard = calcCard + '<button class="btn btn-primary" onclick="addOrder()">Add New</button>';
    calcCard = calcCard + '</div>';
    calcCard = '<div class="col-md-6" id="CALCCARD">' + calcCard + '</div>';
    $('#dashboard').append(calcCard);
    return;
  }
  mainCoin.forEach(function(maincoin) {
    var priceContent = ''
    stableCoin.forEach(function(stablecoin) {
      const targetSymbol = maincoin + stablecoin;
      var targetPrice = prices[targetSymbol];
      if(!targetPrice)
          targetPrice = '';
      priceContent = priceContent + '<div class="mb-2">' + targetSymbol + ': ' + targetPrice + '</div>';
    });
    $('#' + maincoin + '-PRICECARD .card-info').html(priceContent);
  });
}

var checkOrder = function() {
  orders.forEach(function(order) {
    const orderId = order.orderId;
    if(orderExist(orderId))
      return;
    var cardStr = '<div class="card order-card mb-4 box-shadow" data-orderId="' + orderId + '">';
    cardStr = cardStr + '<h4 class="asset-name text-success">' + order.symbol + '</h4>';
    cardStr = cardStr + '<div class="card-info text-center">';
    cardStr = cardStr + '<div class="mb-3"><span>Order Id: ' + order.orderId + '</span></div>';
    cardStr = cardStr + '<div class="mb-3"><span>Stable Coin: ' + order.stableCoin + '</span></div>';
    cardStr = cardStr + '<div class="mb-3"><span>Quantity: ' + order.quantity + '</span></div>';
    cardStr = cardStr + '<div class="mb-3"><span>Profit Percent: ' + order.profitPercent + ' %</span></div>';
    cardStr = cardStr + '<div class="mb-3"><span>Limit Price: ' + order.limitPrice + '</span></div>';
    cardStr = cardStr + '<div class="mb-3"><span>Loss Limit: ' + order.lossPercent + ' %</div>';
    cardStr = cardStr + '<div class="mb-3"><span>Cancel Price: ' + order.cancelPrice + '</span></div>';
    cardStr = cardStr + '<div class="mb-3"><input type="checkbox" data-toggle="toggle" data-onstyle="danger" data-width="100" data-height="35"></div>';
    cardStr = cardStr + '<div class="mb-3"><button class="btn btn-primary" onclick="saveOrder(\'' + order.orderId + '\')">Save</button></div>';
    cardStr = cardStr + '</div>';
    cardStr = '<div class="col-md-6" id="ORDER-' + orderId + '">' + cardStr + '</div>';
    $('#dashboard').append(cardStr);
    $('#ORDER-' + orderId).insertBefore($('#CALCCARD'));
    $('#ORDER-' + order.orderId + ' input[data-toggle]').bootstrapToggle('on');
  });
  $('.order-card').each(function() {
    var orderId = $(this).data('orderid');
    const orderCard = getRecord(orders, 'orderId', orderId);
    if(!orderCard)
      $('#ORDER-' + orderId).remove();
  });
}

var reloadTable = function() {
  $('.balance-free').html('');
  $('.symbol').html('');
  $('.asset-price').html('');
  $('.symbol').html('');
  $('.limit-price').html('');
  $('.coin-amount').html('');
  $('.cancel-price').html('');
  $('.symbol').removeClass('text-danger');
  $('.balance-free').removeClass('text-danger');

  const altCoin = $('#altcoin-box').val();
  const mainCoin = $('#maincoin-box').val();
  if(altCoin == mainCoin)
    return;
  const stableCoin = $('#stablecoin-box').val();
  const symbol = altCoin + mainCoin;
  const cancelSymbol = altCoin + stableCoin;
  const symbolInfo = getRecord(exchangeInfo, 'symbol', symbol);
  const cancelSymbolInfo = getRecord(exchangeInfo, 'symbol', cancelSymbol);
  $('.symbol').html(symbol);
  if(!symbolInfo) {
    $('.symbol').addClass('text-danger');
    return;
  }
  if(!cancelSymbolInfo) {
    $('.symbol').html('Cancellation(' + cancelSymbol + ') Unavailable');
    $('.symbol').addClass('text-danger');
    return;
  }
  const minQty = parseFloat(symbolInfo.filters[2].minQty.replace(/0+$/g, ''));
  const balance = getRecord(balances, 'asset', altCoin);
  var balanceFree = parseFloat(balance.free.replace(/0+$/g, ''));
  $('.balance-free').html(balanceFree);
  if(balanceFree < minQty) {
    $('.balance-free').addClass('text-danger');
    return;
  }

  const assetPrice = prices[symbol];
  $('.asset-price').html(assetPrice);
  calcLimitPrice();
  calcCancelPrice();
}

var calcLimitPrice = function() {
  var assetPrice = parseFloat($('.asset-price').html());
  if(!assetPrice || assetPrice < 0)
    return;
  var profitPercent = parseFloat($('#PROFIT-PERCENT').val());
  if(!profitPercent || profitPercent < 0)
    profitPercent = 0;

  const symbol = $('.symbol').html();
  const symbolInfo = getRecord(exchangeInfo, 'symbol', symbol);
  var tickSize = symbolInfo.filters[0].tickSize;
  tickSize = parseFloat(tickSize.replace(/0+$/g, ''));
  var zeroCount = -Math.floor( Math.log(tickSize) / Math.log(10) + 1);
  var limitPrice = assetPrice * (100 + profitPercent) / 100;
  limitPrice = limitPrice.toFixed(zeroCount + 1).replace(/0+$/g, '');
  $('.limit-price').html(limitPrice);
  var balance = parseFloat($('.balance-free').html());
  if(!balance || balance < 0)
    return;
  var coinAmount = limitPrice * balance;
  coinAmount = coinAmount.toFixed(16).replace(/0+$/g, '');
  $('.coin-amount').html(coinAmount);
}

var calcCancelPrice = function() {
  var assetPrice = parseFloat($('.asset-price').html());
  if(!assetPrice || assetPrice < 0)
    return;
  var lossPercent = parseFloat($('#LOSS-PERCENT').val());
  if(!lossPercent || lossPercent < 0)
    lossPercent = 0;

  const symbol = $('.symbol').html();
  const symbolInfo = getRecord(exchangeInfo, 'symbol', symbol);
  var tickSize = symbolInfo.filters[0].tickSize;
  tickSize = parseFloat(tickSize.replace(/0+$/g, ''));
  var zeroCount = -Math.floor( Math.log(tickSize) / Math.log(10) + 1);
  var cancelPrice = assetPrice * (100 - lossPercent) / 100;
  cancelPrice = cancelPrice.toFixed(zeroCount + 1).replace(/0+$/g, '');
  $('.cancel-price').html(cancelPrice);
}

var orderExist = function(orderId) {
  if($('#ORDER-' + orderId).length > 0)
    return true;
  return false;
}

var getRecord = function(records, field, value) {
  const targetRecord = records.filter(record => {
    return record[field] === value
  });
  if(targetRecord.length > 0)
    return targetRecord[0];
  return null;
}

var addOrder = function() {
  const altCoin = $('#altcoin-box').val();
  const mainCoin = $('#maincoin-box').val();
  if(altCoin == mainCoin) {
    alert('Altcoin and Maincoin can\'t be same!')
    return;
  }
  const stableCoin = $('#stablecoin-box').val();
  const symbol = altCoin + mainCoin;
  if(!(symbol in prices)) {
    alert('Not existing pair!')
    return;
  }
  var profitPercent = parseFloat($('#PROFIT-PERCENT').val());
  if(!profitPercent || profitPercent < 0) {
    alert('Incorrect profit percent!');
    return;
  }
  var lossPercent = parseFloat($('#LOSS-PERCENT').val());
  if(!lossPercent || lossPercent < 0) {
    alert('Incorrect loss percent!');
    return;
  }
  var limitPrice = parseFloat($('.limit-price').html());
  var cancelPrice = parseFloat($('.cancel-price').html());

  const symbolInfo = getRecord(exchangeInfo, 'symbol', symbol);
  const minQty = parseFloat(symbolInfo.filters[2].minQty.replace(/0+$/g, ''));
  var stepSize = symbolInfo.filters[2].stepSize;
  stepSize = parseFloat(stepSize.replace(/0+$/g, ''));

  order = {
    symbol: symbol,
    altCoin: altCoin,
    mainCoin: mainCoin,
    stableCoin: stableCoin,
    profitPercent: profitPercent,
    limitPrice: limitPrice,
    lossPercent: lossPercent,
    cancelPrice: cancelPrice,
    stepSize: stepSize,
    minQty: minQty
  };
  $('#order').val(JSON.stringify(order));
  $('form').submit();
}

var saveOrder = function(orderId) {
  if( $('#ORDER-' + orderId + ' input[data-toggle]').prop('checked') )
    return;
  document.location.href = '/api/cancel?orderId=' + orderId;
}

jQuery(document).ready(function(){
  tick();
  setInterval(tick, 10000);
});