var express = require('express');
var request = require('request');
var rp = require('request-promise');
var Promise = require('promise-js');
var fs = require('fs');
var _ = require('lodash');
var router = express.Router();

function promiseLoop(array,optionsCallback,resultCallback) {
  var output = [];
  var counter = 0;
  var finalPromise = new Promise(function(resolve, reject) {
    array.forEach(function(element) {
      var options = optionsCallback(element);
      rp(options).then(function(body) {
        output = resultCallback(body, output, element);
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

function getURIs (texts, confidence, support, nbPages) {
  var timeout = 30000;
  var optionsCallback = function(page) {
    return {
      method: 'get',
      url : 'http://spotlight.dbpedia.org/rest/annotate?text=' + encodeURI(page) + '&confidence=' + confidence + '&support=' + support + '&timeout=' + timeout,
      headers: {
        'Accept':'application/json'
      }
    }
  };
  var buildResult = function(body, URIs, pageOrigin) {
    if(URIs.length==0) {
      for (var i=0; i<nbPages; i++) {
        URIs[i] = [];
      }
    }
    console.log("Got one bunch of URIs for page #", pageOrigin.id);
    body = JSON.parse(body);
    for(var element in body["Resources"]){
      var URI = body["Resources"][element]["@URI"];
      URIs[pageOrigin.id].push(URI);
    }
    return URIs;
  }
  return promiseLoop(texts, optionsCallback, buildResult);
}

function getEvents (URIs) {
  var timeout = 30000;
  var optionsCallback = function(URI) {
    URI = encodeURIComponent(decodeURI(URI));
    return {
      method: 'get',
      url : 'http://dbpedia.org/sparql?default-graph-uri=http%3A%2F%2Fdbpedia.org&query=SELECT+DISTINCT+%3FE+%3FDATE+%3FIMG+%3FTEXT+%3FNAME+WHERE+%7B%0D%0A%7B%3FE+rdf%3Atype+dbo%3AEvent%7D+.%0D%0A%7B%3FE+dbo%3Adate+%3FDATE%7D+.%0D%0A%7B%3FE+dbo%3Athumbnail+%3FIMG%7D+.%0D%0A%7B%3FE+rdfs%3Acomment+%3FTEXT%7D+.%0D%0A%7B%3FE+foaf%3Aname+%3FNAME%7D+.%0D%0A%7B%3FE+%3FP+%3C' + URI + '%3E%7D+UNION+%7B%3C' + URI + '%3E+%3FP+%3FE%7D+.%0D%0AFILTER+%28langMatches%28lang%28%3FTEXT%29%2C+%22en%22%29%29+.%0D%0A%7D&format=application%2Fsparql-results%2Bjson&CXML_redir_for_subjs=121&CXML_redir_for_hrefs=&timeout=30000&debug=on',
      headers: {}
    }
  };
  var buildResult = function(body, events) {
    body = JSON.parse(body);
    body["results"]["bindings"].forEach(function(element) { 
      var event = {
        link: element["E"]["value"],
        name: element["NAME"]["value"],
        description: element["TEXT"]["value"],
        date: element["DATE"]["value"],
        img: element["IMG"]["value"]
      }
      events.push(event);
    });
    return events;
  }
  return promiseLoop(URIs, optionsCallback, buildResult);
}

function splitText(texts) {
  console.log("Splitting texts ! ");
  var MAX = 1500;
  var newTexts = [];
  for(var i=0;i<texts.length;i++) {
    var element = texts[i];
    var offset = 0;
    while(offset<element.length) {
      var substr = {
        id: i,
        text: element.substring(offset,offset+Math.min(element.length-offset,MAX))
      };
      offset += MAX;
      newTexts.push(substr);
    }
  };
  return newTexts;
}

router.post('/search', function(req, res, next) {
  console.log(req.body);

  var keyword = req.body.keywords;
  var confidence = req.body.confidence/10;
  var support = req.body.support;
  var cachePath = './cache/' + keyword;
  var network;

  if (fs.existsSync(cachePath)) {
    console.log("Cache for keywords : ", keyword);
    fs.readFile(cachePath, 'utf8', function (err,data) {
      if (err) {
        return console.log("Error reading cache - ", err);
      }
      data = JSON.parse(data);
      getEvents(_.flatten(data.ressources)).then(function(events) {
        events = _.uniq(events, function(item) { 
          return item.name;
        });
        events = events = _.sortBy(events, function(o) { return o.date; });
        console.log("Got events (",events.length,")");
        res.render("results",{array : events});
      });
    });
  } else {
    console.log("Request for keywords : ", keyword);
    getResult(keyword).then(function(URLs) {
      console.log("Got URLs (",URLs.length,")");
      return getTexts(URLs);
    })
    .then(function(texts) {
      var nbPages = texts.length;
      console.log("Got texts (",nbPages,")");
      texts = splitText(texts);
      console.log("Got text splits : " , texts.length);
      return getURIs(texts, confidence, support, nbPages);
    })
    .then(function(URIs) {
      var counter = 0;
      for (var i=0; i<URIs.length; i++) {
       URIs[i] = _.uniq(URIs[i]).sort();
       counter += URIs[i].length;
     }
     console.log("Got results (",counter,")");
     var network = computeGraph(URIs,keyword);
     var output = {ressources : URIs};
      fs.writeFile(cachePath, JSON.stringify(output), function(err) {
        if(err) {
          console.log("Error writing cache - ", err);
        } else {
          console.log("Request saved to " + cachePath);
        }
      });
      return getEvents(_.flatten(URIs));
    })
    .then(function(events) {
      events = _.uniq(events, function(item) { 
          return item.name;
      });
      events = events = _.sortBy(events, function(o) { return o.date; });
      console.log("Got events (",events.length,")");
      res.render("results",{array : events, keyword: keyword, network: network});
    })
    .catch(function(err) {
      console.log("Got error - ", err, err.stack);
      res.send(err);
    });
  }
});

router.get('/search', function(req, res, next) {
  res.render('search');
});

function computeGraph(URIs, keyword)
{
  var edges=[];
  var nodes=[];
  for(var i=0;i<URIs.length;++i)
  {
    edges[i]=[];
    nodes[i]=0;
  }
  for(var i=0;i<URIs.length;++i){
    for(var j=0;j<URIs.length;++j){
      if(i==j)
        edges[i][j]=0;
      else if(computeCoeffJaccard(URIs[i],URIs[j])>0.1)
      {
        edges[i][j]=1;
        nodes[i]=1;
        nodes[j]=1;
      }
      else 
        edges[i][j]=0;
    }
  }
  var data='dinetwork {';
  var first=0;
  for(var i=0;i<URIs.length;++i){
    text="";
    for(var j=i+1;j<URIs.length;++j){
      if(edges[i][j]==1 && first==1)
        data+=';' + (i+1) + ' -- ' + (j+1);
      else if(edges[i][j]==1 && first==0)
      {
       data+= (i+1) +' -- ' + (j+1); 
       first=1;
      }
      text+=edges[i][j]+" ";
    }
    console.log(text);
  }
  data+='}';
  console.log(data);
  return data;
}

function computeCoeffJaccard(arrayURI1,arrayURI2){
  var total= arrayURI1.length + arrayURI2.length;
  var matching=0;
  for(var i=0;i<arrayURI1.length;++i){
    for(var j=0;j<arrayURI2.length;++j)
    {
      if(arrayURI1[i]==arrayURI2[j])
        matching++;  
    }
  }

  return matching/(total - matching);
};

module.exports = router;

