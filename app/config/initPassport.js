var LocalStrategy   = require('passport-local').Strategy;
var User = require('../models/user');
var bCrypt = require('bcrypt-nodejs');

module.exports = function(passport){

  passport.serializeUser(function(user, done) {
    done(null, user._id);
  });

  passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
      done(err, user);
    });
  });

  passport.use('login', new LocalStrategy({
      usernameField: 'email',
      passwordField: 'password',
      passReqToCallback : true
    },
    function(req, email, password, done) {
      User.findOne({ 'email' : email }, 
        function(err, user) {
          if (err)
            return done(err);
          
          if (!user) {
            return done(null, false, req.flash('message', 'User Not found.'));
          }

          if (!isValidPassword(user, password)) {
            return done(null, false, req.flash('message', 'Invalid Password'));
          }

          return done(null, user);
        }
      );
    })
  );

  var isValidPassword = function(user, password) {
    return bCrypt.compareSync(password, user.password);
  }
}
