var express = require('express');
var request = require('request');
var rp = require('request-promise');
var Promise = require('promise-js');
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

var getResult = function(keyword) {
  var offsets = [0,8,16,24,32,40,48,56];
  var links = [];
  var prevPromise = Promise.resolve();
  offsets.forEach(function(offset) {  // loop through each title
    prevPromise = prevPromise.then(function() {
      var options = {
        method: 'get',
        url : 'https://ajax.googleapis.com/ajax/services/search/web?v=1.0&rsz=8&q=' + encodeURI(keyword) + '&start=' + offset,
        headers: {
          'Accept':'application/json',
        }
      };
      return rp(options);
    }).then(function(body) {
      body = JSON.parse(body);
      for(var element in body["responseData"]["results"]){
        var URL = body["responseData"]["results"][element]["url"];
        links.push(URL);
      }
      console.log(links);
    }).catch(function(error) {
      console.log(error);
    });
  });
}

router.get('/test', function(req, res, next) {
  var keyword = "Hello";
  getResult(keyword);
});

module.exports = router;