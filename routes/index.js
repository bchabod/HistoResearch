var express = require('express');
var request = require('request');
var rp = require('request-promise');
var Promise = require('promise-js');
var router = express.Router();

var prevURIs=[];

function promiseLoop(array,optionsCallback,resultCallback) {
  var output = [];
  var counter = 0;
  var finalPromise = new Promise(function(resolve, reject) {
    array.forEach(function(element) {
      var options = optionsCallback(element);
      rp(options).then(function(body) {
        output = resultCallback(body, output);
        counter++;
        if(counter == array.length) {
          resolve(output);
        }
      }).catch(function(error) {
        counter++;
        if(counter == array.length) {
          resolve(output);
        }
      });
    });
  });
  return finalPromise;
}

function getResult (keyword) {
  var optionsCallback = function(offset) {
    return {
      method: 'get',
      url : 'https://ajax.googleapis.com/ajax/services/search/web?v=1.0&rsz=8&q=' + encodeURI(keyword) + '&start=' + offset,
      headers: {
        'Accept':'application/json',
      }
    };
  };
  var buildResult = function(body, links) {
    body = JSON.parse(body);
    for(var element in body["responseData"]["results"]){
      var URL = body["responseData"]["results"][element]["url"];
      links.push(URL);
    }
    return links;
  }
  var offsets = [0];
  return promiseLoop(offsets, optionsCallback, buildResult);
}

function getTexts (urls) {
  var optionsCallback = function(url) {
    return {
      method: 'get',
      url : 'https://access.alchemyapi.com/calls/url/URLGetText?apikey=df295c00eafc10dcecf7318f57c54d216107017f&url=' + url + '&outputMode=json',
      headers: {
        'Accept':'application/json',
      }
    }
  };
  var buildResult = function(body, texts) {
    body = JSON.parse(body);
    texts.push(body["text"]);
    return texts;
  }
  return promiseLoop(urls, optionsCallback, buildResult);
}

function getURIs (pages) {
  var confidence = 0.2;
  var support = 80;
  var timeout = 30000;
  console.log("Got text splits : " , pages.length);
  var optionsCallback = function(page) {
    return {
      method: 'get',
      url : 'http://spotlight.dbpedia.org/rest/annotate?text=' + encodeURI(page) + '&confidence=' + confidence + '&support=' + support + '&timeout=' + timeout,
      headers: {
        'Accept':'application/json'
      }
    }
  };
  var buildResult = function(body, URIs) {
    console.log("Got one bunch of URIs");
    body = JSON.parse(body);
    for(var element in body["Resources"]){
      var URI = body["Resources"][element]["@URI"];
      URIs.push(URI);
    }
    return URIs;
  }
  return promiseLoop(pages, optionsCallback, buildResult);
}

function splitText(texts) {
  console.log("Splitting texts ! ");
  var MAX = 1500;
  var newTexts = [];
  texts.forEach(function(element) {
    var offset = 0;
    while(offset<element.length) {
      var substr = element.substring(offset,offset+Math.min(element.length-offset,MAX));
      newTexts.push(substr);
      offset += MAX;
    }
  });
  return newTexts;
}

router.post('/search', function(req, res, next) {
  var keyword = req.body.keywords;
  console.log("Request for keywords : ", keyword);
  getResult(keyword).then(function(URLs) {
    console.log("Got URLs (",URLs.length,")");
    return getTexts(URLs);
  })
  .then(function(texts) {
    console.log("Got texts (",texts.length,")");
    texts = splitText(texts);
    return getURIs(texts);
  })
  .then(function(URIs) {
    console.log("Got results (",URIs.length,")");
    URIs.sort();
    URIs=computeUniqueArray(URIs);
    console.log(computeCoeffJaccard(prevURIs,URIs));
    prevURIs=URIs;
    res.render("results",{array : URIs});
  })
  .catch(function(err) {
    console.log("Got error - ", err);
    res.send(err);
  });
});

router.get('/search', function(req, res, next) {
  res.render('search');
});

function computeUniqueArray(array){
  var res=[];
  res.push(array[0]);
  for(var i=1;i<array.length;++i){
    if(array[i]!=array[i-1])
      res.push(array[i]);
  }
  return res;
};

function computeCoeffJaccard(arrayURI1,arrayURI2){
  var total= arrayURI1.length + arrayURI2.length;
  var matching=0;
  for(var i=0;i<arrayURI1.length;++i){
    for(var j=0;j<arrayURI2.length;++j)
    {
      if(arrayURI1[i]===arrayURI2[j])
        matching++;  
    }
  }

  return matching/(total - matching);
};

module.exports = router;

