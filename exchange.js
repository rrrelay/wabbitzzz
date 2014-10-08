var q = require('q'),
	util = require('util'),
	amqp = require('amqp'),
	_ = require('lodash'),
	EventEmitter = require('events').EventEmitter;

var EXCHANGE_DEFAULTS = {
	type: 'fanout',
	autoDelete: false,
	durable: true,
	reconnect: true
};

function _getConnection(){
	var d = q.defer();

	var connection = amqp.createConnection({ url:  process.env.WABBITZZZ_URL || 'amqp://localhost' });
	connection.addListener('ready', d.resolve.bind(d, connection));
	connection.addListener('error', d.reject.bind(d));

	return d.promise;
}

var connectionPromise = _getConnection();

function _getExchange(params){
	var d = q.defer();

	var name = params.name;
	delete params.name;
	params = _.extend({}, EXCHANGE_DEFAULTS, params);

	connectionPromise
		.then(function(connection){
			var exchange = connection.exchange(name, params);
			d.fulfill(exchange);
		})
		.done();

	return d.promise;
}

function Exchange(params){
	var self = this;
	EventEmitter.call(self);

	var exchanageName = params.name;
	var exchangePromise = _getExchange(params); 
	var property = Object.defineProperty.bind(Object, self);

	exchangePromise
		.then(function(){
			self.emit('ready');
		}).done();

	property('ready', {
		get: function(){ return exchangePromise; }
	});

	this.publish = function(msg, publishOptions){
		exchangePromise
			.then(function(exchange){
				var options = _.extend({}, {persistent: true}, publishOptions);
				var key = (options.key || 'blank').toString();

				delete options.key;

				msg._exchange = msg._exchange || exchanageName;
				msg._ticks = Date.now();

				exchange.publish(key, msg, options);
			});
	};

	this.sendStopConsumer  = function(pid){
		exchangePromise
			.then(function(exchange){
				var stopMsg = {
					__stop: '_wabbitzzz_stop_please',
					pid: pid,
				};

				exchange.publish('_', stopMsg, {persistent: false});
			});
	};

}

util.inherits(Exchange, EventEmitter);
module.exports = Exchange;
