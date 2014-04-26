var q = require('q');
var amqp = require('amqp');
var _ = require('lodash');
var prettyError = require('prettify-error');

var DEFAULTS = {
	type:'fanout',
	autoDelete: false,
	durable: true,
	reconnect: true
};

function _getExchange(params){
	var d = q.defer();
	var connection = amqp.createConnection({ url: process.env.WABBITZZZ_URL || 'amqp://localhost' });

	var name = params.name;
	delete params.name;
	params = _.extend({}, DEFAULTS, params);

	connection.addListener('error', function(err){
		if (global.logger){
			global.logger.error(prettyError(err) || err);
		} else {
			console.error(prettyError(err) || err);
		}
	});

	connection.addListener('ready', function(){
		var exchange = connection.exchange(name, params);
		d.fulfill(exchange);
	});

	return d.promise;
}

function Exchange(params){

	var exchangePromise = _getExchange(params); 

	this.publish = function(msg, publishOptions){

		exchangePromise
			.then(function(exchange){
				var options = _.extend({}, {persistent: true}, publishOptions);
				exchange.publish('key.test', msg, options);
			});
	};
}

module.exports = Exchange;
