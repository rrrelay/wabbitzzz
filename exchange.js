var Promise = require('bluebird'),
	util = require('util'),
	getConnection = require('./get-connection'),
	Queue = require('./queue'),
	_ = require('lodash'),
	EventEmitter = require('events').EventEmitter,
	defaultExchangePublish = require('./default-exchange-publish');

var EXCHANGE_DEFAULTS = {
	type: 'fanout',
	autoDelete: false,
	durable: true,
	name: '',
};

var PUBLISH_DEFAULTS = {
	persistent: true,
	contentType: 'application/json',
};

var DELAYED_PUBLISH_DEFAULTS = {
	delay: 3000,
	key: '',
};

function _createChannel(params, confirmMode){
	return getConnection()
		.then(function(conn) {
			if (confirmMode){
				return conn.createConfirmChannel();
			}

			return conn.createChannel();
		})
		.then(function(chan){
			// if using the default exchange,
			// then skip the assert
			if (!params.name) return chan;

			const opt = _.cloneDeep(params);
			delete opt.name;
			delete opt.type;

			return chan.assertExchange(params.name, params.type, opt)
				.then(function(){
					return chan;
				});
		});
}

function Exchange(params){
	var self = this;
	EventEmitter.call(self);
	params = _.extend({}, EXCHANGE_DEFAULTS, params);

	var confirmMode = !!params.confirm;
	delete params.confirm;

	var exchangeName = params.name || '';
	var getChannel = _createChannel(params, confirmMode);
	var property = Object.defineProperty.bind(Object, self);

	getChannel
		.then(function(){
			self.emit('ready');
		})
		.catch(function(err){
			console.log('error creating exchange');
			console.log(err);
		});

	property('ready', {
		get: function(){ return getChannel; }
	});

	this.publish = function(msg, publishOptions, cb){
		return getChannel
			.then(function(chan){

				var options = _.extend({}, PUBLISH_DEFAULTS, publishOptions);
				var key = (options.key || 'blank').toString();

				delete options.key;

				msg._exchange = msg._exchange || exchangeName;

				if (confirmMode){
					chan.publish(exchangeName, key, Buffer(JSON.stringify(msg)), options);
					return chan.waitForConfirms()
						.then(() => {
							if (_.isFunction(cb)) cb();
							return true;
						});
				}

				return chan.publish(exchangeName, key, Buffer(JSON.stringify(msg)), options);
			});
	};

	this.delayedPublish = function(msg, publishOptions){
		publishOptions = _.extend({}, DELAYED_PUBLISH_DEFAULTS, publishOptions);

		msg._exchange = msg._exchange || exchangeName;

		return new Promise(function(resolve, reject) {
			var queueName = 'delay_' + exchangeName  +'_by_'+publishOptions.delay+'__'+publishOptions.key;

			var tmp = new Queue({
				name: queueName,
				exclusive: false,
				autoDelete: false,
				arguments: {
					'x-dead-letter-exchange': exchangeName,
					'x-dead-letter-routing-key': publishOptions.key,
					'x-message-ttl': publishOptions.delay,
				},
				ready: function() {
					defaultExchangePublish(msg, { key: queueName })
						.then(function() {
							resolve(true);
						})
						.catch(function(err) {
							reject(err);
						})
						.finally(function(){
							tmp.close();
						});
				},
			});
		});
	};
}

util.inherits(Exchange, EventEmitter);
module.exports = Exchange;
