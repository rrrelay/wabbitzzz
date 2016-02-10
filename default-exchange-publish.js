var q = require('q');
var _ = require('lodash');
var amqp = require('amqp');
var getConnection = require('./get-connection');

function _getExchange(){
	var d = q.defer();

	getConnection()
		.then(function(connection){
			var exchange = connection.exchange('', { confirm: true });

			exchange.on('open', function(){
				d.resolve(exchange);
			});

			exchange.on('error', function(err){
				console.error(err);
				d.reject(err);
			});
		})
		.catch(function(err) { d.reject(err); });

	return d.promise;
}

var ex;
function _publish(msg, options){
	if (!ex) {
		ex = _getExchange();
	}

	return ex.then(function(exchange) {
		var key = options.key;
		options = _.extend({}, options);
		delete options.key;

		var d = q.defer();

		exchange.publish(key, msg, options, function(){
			d.resolve(true);
		});

		return d.promise;
	})
	.timeout(40 * 1000);
}

module.exports = _publish;
