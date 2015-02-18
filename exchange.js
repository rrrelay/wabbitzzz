var q = require('q'),
	util = require('util'),
	amqp = require('amqp'),
	Queue = require('./queue'),
	_ = require('lodash'),
	EventEmitter = require('events').EventEmitter;

var EXCHANGE_DEFAULTS = {
	type: 'fanout',
	autoDelete: false,
	durable: true,
	reconnect: true
};

var DELAYED_PUBLISH_DEFAULTS = {
	delay: 3000,
	key: '',
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

	connectionPromise
		.then(function(connection){
			var exchange = connection.exchange(name || '', params);

			exchange.on('open', function(){
				d.fulfill(exchange); 
			});

			exchange.on('error', function(err){
				console.error(err);
			});
		})
		.done();

	return d.promise;
}

function Exchange(params){
	var self = this;
	EventEmitter.call(self);
	params = _.extend({}, EXCHANGE_DEFAULTS, params);

	var exchangeName = params.name;
	var exchangePromise = _getExchange(params); 
	var property = Object.defineProperty.bind(Object, self);

	exchangePromise
		.then(function(){
			self.emit('ready');
		})
		.catch(function(err){
			global.logger.error('error creating exchange');
			global.logger.error(err);
		});

	property('ready', {
		get: function(){ return exchangePromise; }
	});

	this.publish = function(msg, publishOptions, cb){
		exchangePromise
			.then(function(exchange){
				var options = _.extend({}, {persistent: true}, publishOptions);
				var key = (options.key || 'blank').toString();

				delete options.key;

				msg._exchange = msg._exchange || exchangeName;
				msg._ticks = Date.now();
				
				exchange.publish(key, msg, options, cb);
			});
	};

	this.delayedPublish = function(msg, publishOptions){
		publishOptions = _.extend({}, DELAYED_PUBLISH_DEFAULTS, publishOptions);

		var d = q.defer(),
			queueName = 'delay_' + exchangeName  +'_by_'+publishOptions.delay+'__'+publishOptions.key;

		new Queue({
			name: queueName,
			exclusive: false,
			autoDelete: false,
			arguments: {
				'x-dead-letter-exchange': exchangeName,
				'x-dead-letter-routing-key': publishOptions.key,
				'x-message-ttl': publishOptions.delay,
			},
			ready: function(){
				var defaultExchange = new Exchange({confirm:true});

				defaultExchange.on('ready', function(){
					setTimeout(function(){
						defaultExchange.publish(msg, {key: queueName}, function(){
							d.resolve();
						});
					}, 200);
				});
			}
		});


		return d.promise;
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
