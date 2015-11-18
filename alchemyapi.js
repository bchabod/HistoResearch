urlkey = 'http://www.tudogostoso.com.br/receita/29124-bolo-simples.html';
extractText(urlkey, callback);

function callback(x){
       console.log('Return: ' + x + ' \n End Return');
}

function extractText(key, callback){

	var http = require('http');
	var body = '';

	http.get({
        host: 'access.alchemyapi.com',
        path: '/calls/url/URLGetText?apikey=e94f1ec1221a30783b1e20bfca48c003b9628b27&url=' + key + '&outputMode=json'
    }, function(res) {
	  	res.on('data', function (chunk) {
    		body += chunk;
 		});
 		res.on('end', function() {
                callback(body);
    		console.log('No more data in response.')
  		})
	}).on('error', function(e) {
	  	console.log("Got error: " + e.message);
	});
}