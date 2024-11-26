const createError = require('http-errors');
const debug = require('debug')('bot:server');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const favicon = require('serve-favicon');
const expressSession = require('express-session');
const flash = require('express-flash');
const schedule = require('node-schedule');
const passport = require('passport');
const mongoose = require('mongoose');
const http = require('http');
require('module-alias/register');

mongoose.connect('mongodb://root:password@127.0.0.1:27017/cryptobot', {
  useNewUrlParser: true,
  useFindAndModify: false,
  auth: {authSource: "admin"}
});

const app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(favicon(path.join(__dirname, 'public/images/bot.png')));
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(expressSession({secret: 'cryptobot', resave: true, saveUninitialized: true}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

var initPassport = require('@config/initPassport');
initPassport(passport);

var indexRouter = require('@routes/index')(passport);
var apiRouter = require('@routes/api')(passport);
app.use('/', indexRouter);
app.use('/api', apiRouter);

app.use(function(req, res, next) {
  next(createError(404));
});

app.use(function(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

var port = normalizePort(process.env.PORT || '8000');
app.set('port', port);

var server = http.createServer(app);
server.listen(port);

server.on('error', onError);
server.on('listening', onListening);

function normalizePort(val) {
  var port = parseInt(val, 10);
  if (isNaN(port)) {
    return val;
  }
  if (port >= 0) {
    return port;
  }
  return false;
}

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }
  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
}

const commonBinance = require('@libs/commonBinance');
schedule.scheduleJob('*/5 * * * * *', async function() {
  await commonBinance.getInfo();
  commonBinance.updateAll();
});