const express = require('express');
const router = express.Router();

var isAuthenticated = function (req, res, next) {
  if (req.isAuthenticated())
    return next();
  res.redirect('/login');
}

module.exports = function(passport){

  router.get('/', isAuthenticated, function(req, res) {
    res.render('index');
  });

  router.get('/login', function(req, res) {
    res.render('login', { message: req.flash('message') });
  });

  router.post('/login', passport.authenticate('login', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash : true  
  }));

  router.get('/signout', function(req, res) {
    req.logout();
    res.redirect('/');
  });

  return router;
}
