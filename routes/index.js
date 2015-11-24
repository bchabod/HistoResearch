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
  var offsets = [0];
  var links = [];
  var prevPromise = Promise.resolve();
  var P = new Promise(function(resolve, reject) {
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
        if(offset==0) {
          resolve(links);
        }
      }).catch(function(error) {
        reject(error);
      });
    });
  });
  return P;
}

var getTexts = function(urls) {
  var texts = [];
  var offset = 0;
  var prevPromise = Promise.resolve();
  var P = new Promise(function(resolve, reject) {
    urls.forEach(function(url) {  // loop through each title
      prevPromise = prevPromise.then(function() {
        var options = {
          method: 'get',
          url : 'https://access.alchemyapi.com/calls/url/URLGetText?apikey=e94f1ec1221a30783b1e20bfca48c003b9628b27&url=' + url + '&outputMode=json',
          headers: {
            'Accept':'application/json',
          }
        };
        offset++;
        return rp(options);
      }).then(function(body) {
        body = JSON.parse(body);
        texts.push(body["text"]);
        if(offset==8) {
          resolve(texts);
        }
      }).catch(function(error) {
        reject(error);
      });
    });
  });
  return P;
}

var getURIs = function(pages) {
  var URIs = [];
  var offset = 0;
  var confidence = 0.1;
  var support = 50;
  var prevPromise = Promise.resolve();
  var P = new Promise(function(resolve, reject) {
    pages.forEach(function(page) {
      prevPromise = prevPromise.then(function() {
        var options = {
          method: 'post',
          url : 'http://spotlight.dbpedia.org/rest/annotate?text=' + page + '&confidence=' + confidence + '&support=' + support,
          headers: {
            'Accept':'application/json',
            "content-type":"application/x-www-form-urlencoded"
          }
        };
        console.log("Récupération des URI de l'URL numéro" + offset);
        offset++;
        return rp(options);
      }).then(function(body) {
        body = JSON.parse(body);
        for(var element in body["Resources"]){
          var URI = body["Resources"][element]["@URI"];
          console.log(URI);
          URIs.push(URI);
        }
        if(offset==8) {
          console.log("Promesse résolue : ",URIs);
          resolve(URIs);
        }
      }).catch(function(error) {
        //reject(error);
      });
    });
  });
  return P;
}

router.get('/test', function(req, res, next) {
  var keyword = "Hello";
  getResult(keyword).then(function(URLs) {
    return getTexts(URLs);
  })
  .then(function(texts) {
    console.log("Recherche des URIs");
    return getURIs(texts);
  })
  .then(function(URIs) {
    console.log("Fin de la recherche");
    res.send(URIs);
  })
  .catch(function(err) {
    res.send(err);
  });
  console.log("lol");
});

/*router.get('/test', function(req, res, next) {
  var keyword = "Hello";
  getResult(keyword).then(function(URLs) {
    return getTexts(URLs);
  })
  .then(function(texts) {
    res.send(texts);
  });
});*/

module.exports = router;


