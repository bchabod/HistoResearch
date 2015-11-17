var express = require('express');
var request = require('request');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  var url = 'http://google.fr';

  var callback = function(error, response, body) {
    if (error || response.statusCode !== 200) {
      res.status(500).send();
    } else {
      res.send(body);
    }
  };

  request(url, callback);

});

module.exports = router;
