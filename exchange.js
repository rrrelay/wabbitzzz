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

function _createChannel(connString, confirmMode){
	return getConnection(connString)
		.then(function(conn) {
			if (confirmMode){
				return conn.createConfirmChannel();
			}

			return conn.createChannel();
		});
}

function _assertExchange(channel, params) {
	// if using the default exchange,
	// then skip the assert
	if (!params.name) return channel;

	var opt = _.cloneDeep(params);
	delete opt.name;
	delete opt.type;

	return channel.assertExchange(params.name, params.type, opt)
		.then(function() {
			return channel;
		});
}

var channelDict = {
	main: _createChannel(),
};

module.exports = function (opt) {
	var connString = opt.connString;
	if (connString && !channelDict[connString]) {
		channelDict[connString] = _createChannel(connString);
	}
	function Exchange(params){
		var self = this;
		EventEmitter.call(self);
		params = _.extend({}, EXCHANGE_DEFAULTS, params);

		var confirmMode = !!params.confirm;
		delete params.confirm;

		var exchangeName = params.name || '';
		var getChannel;
		if (confirmMode) {
			getChannel = _createChannel(connString, true);
		}
		else if (connString) {
			getChannel = channelDict[connString];
		} else {
			getChannel = channelDict.main;
		}

		getChannel = getChannel
		.then(function(c) { return _assertExchange(c, params); });

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
			// make sure we arent publishing fancy mongoose objects
			if (msg && _.isFunction(msg.toObject)) {
				msg = msg.toObject();
			}

			return getChannel
			.then(function(chan){

				var options = _.extend({}, PUBLISH_DEFAULTS, publishOptions);
				var key = (options.key || 'blank').toString();

				delete options.key;

				msg._exchange = msg._exchange || exchangeName;

				if (confirmMode){
					chan.publish(exchangeName, key, Buffer(JSON.stringify(msg)), options);
					return chan.waitForConfirms()
					.then(function(){
						if (_.isFunction(cb)) cb();
						return true;
					});
				}

				return chan.publish(exchangeName, key, Buffer(JSON.stringify(msg)), options);
			});
		};

		this.delayedPublish = function(msg, publishOptions){
			// make sure we arent publishing fancy mongoose objects
			if (msg && _.isFunction(msg.toObject)) {
				msg = msg.toObject();
			}

			publishOptions = _.extend({}, DELAYED_PUBLISH_DEFAULTS, publishOptions);

			msg._exchange = msg._exchange || exchangeName;
			// negative delays break things
			var delay = Math.max(publishOptions.delay, 1);

			return new Promise(function(resolve, reject) {
				var queueName = 'delay_' + exchangeName  +'_by_'+publishOptions.delay+'__'+publishOptions.key;

				var tmp = new Queue({
					name: queueName,
					exclusive: false,
					autoDelete: false,
					arguments: {
						'x-dead-letter-exchange': exchangeName,
						'x-dead-letter-routing-key': publishOptions.key,
						'x-message-ttl': delay,
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

	return Exchange;
};
