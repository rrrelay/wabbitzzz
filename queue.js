var uuid = require('ezuuid');
var _ = require('lodash');
var defaultExchangePublish = require('./default-exchange-publish');
var Promise = require('bluebird');
var getConnection = require('./get-connection');

var EXCHANGE_ATTRIBUTE_NAMES = [
	'durable',
	'autoDelete',
	'arguments',
	'internal',
	'alternateExchange',
];

var DEFAULTS = {
	exclusive: false,
	autoDelete: false,
	durable: true,
	ack: true,
	useErrorQueue: false,
};

function assertQueue(queueName, exchangeNames, params){
	return getConnection()
		.then(function(conn){
			return conn.createChannel();
		})
		.then(function(chan){
			return chan.assertQueue(queueName, params)
				.then(_.constant(chan));
		});
}

function getNoAckParam(params){
	if (params.noAck !== undefined && params.ack !== undefined){
		throw new Error('cannot specifiy both ack and noAck params');
	}

	if (params.noAck !== undefined) return !!params.noAck;
	if (params.ack !== undefined) return !params.ack;

	// default is to ack
	return false;
}

function Queue(params){
	params = _.extend({}, DEFAULTS, params);

	var name = params.name || ((params.namePrefix || '') + uuid()),
		useErrorQueue = !!params.useErrorQueue,
		errorQueueName = name + '_error',
		prefetchCount = params.prefetchCount|| 1,
		ctag,
		noAck = getNoAckParam(params);

	if (noAck){
		prefetchCount = 0;
	}

	var bindings = _.chain([params.exchangeNames])
		.concat([params.exchangeName])
		.concat([params.bindings])
		.concat([params.exchanges])
		.flatten()
		.filter(Boolean)
		.map(function(ex){
			if (_.isObject(ex)) return ex;
			if (_.isString(ex)) return  { name: ex };
			throw new Error('invalid binding/exchange');
		})
		.uniq(function(binding){ return [binding.name, binding.key].join('_'); })
		.forEach(function(binding){
			if (binding.key !== undefined) return;

			binding.key = binding.key || (params.key || '#').toString();
		})
		.value();


	delete params.exchangeName;
	delete params.exchangeNames;
	delete params.bindings;
	delete params.name;
	delete params.useErrorQueue;
	delete params.key;
	delete params.noAck;
	delete params.ack;

	function bindingHasExchangeAttributes(binding){
		return !_.chain(binding)
			.keys()
			.intersection(EXCHANGE_ATTRIBUTE_NAMES)
			.isEmpty()
			.value();
	}

	function bindQueue(chan, bindings){
		return _.chain(bindings)
			.toArray()
			.map(function(binding){
				if (binding.type){
					var exParams = _.chain(EXCHANGE_ATTRIBUTE_NAMES)
						.filter(function(k){ return binding[k] !== undefined; })
						.map(function(k){ return [k, binding[k]]; })
						.fromPairs()
						.value();

					return chan.assertExchange(binding.name, binding.type, exParams)
						.then(function(){ return chan.bindQueue(name, binding.name, binding.key); });
				}

				return chan.bindQueue(name, binding.name, binding.key);
			})
			.thru(Promise.all)
			.value()
			.then(_.constant(chan));
	}

	var queuePromise = assertQueue(name, bindings, params)
		.then(function(chan){
			chan.on('error', function(err){
				console.log('error binding ' + name);
				console.log(err.message);
				console.error(err);
				console.log('------------------------');
			});

			return Promise.resolve(true)
				.then(function(){
					return chan;
				})
				.then(function(chan){
					if (useErrorQueue){
						return chan.assertQueue(errorQueueName, { durable: true })
							.then(_.constant(chan));
					}

					return chan;
				})
				.then(function(chan){
					return chan.prefetch(prefetchCount)
						.then(_.constant(chan));
				})
				.then(function(chan) {
					return bindQueue(chan, bindings);
				})
				.then(function(chan){
					if (_.isFunction(params.ready)) {
						params.ready();
					}

					return chan;
				})
				.catch(function(err){
					console.error(err);
					return false;
				});
		});

	var receieveFunc = function(fn){
		queuePromise
			.then(function(chan){
				if (!chan) return false;

				return chan.consume(name, function(msg) {
					if (!msg){
						// this means the queue has been cancelled.
						return false;
					}

					var myMessage;
					try {
						myMessage = JSON.parse(msg.content.toString());

						if (msg.properties){
							if (msg.properties.replyTo) myMessage._replyTo = msg.properties.replyTo;
							if (msg.properties.correlationId) myMessage._correlationId = msg.properties.correlationId;
						}
					} catch (err){
						console.error('error deserializing message', err);
						myMessage = {};
					}

					var doneCalled = false;
					var done = function(error){
						if (noAck) return;

						doneCalled = true;

						if (!error){
							return chan.ack(msg);
						}

						if (useErrorQueue) {
							myMessage._error = _.extend({}, {message: error.message, stack: error.stack}, error);
							var options = {
								key: errorQueueName,
								persistent: true,
							};

							defaultExchangePublish(myMessage, options)
								.then(function(){
									return chan.ack(msg);
								})
								.catch(function(publishError){
									console.error(error);
									console.error(publishError);
								});
						} else {
							console.log('bad ack', error);
						}
					};

					try {
						fn(myMessage, done);
					} catch (e){
						if (!doneCalled){
							done(e.toString());
						}
					}
				}, { noAck: noAck });
			})
			.then(function(res){
				ctag = res.consumerTag;
			})
			.catch(function(err){
				console.log('there was a problem create queue: ' + name);
				console.error(err);
			});
	};

	receieveFunc.stop = function(){
		return queuePromise
			.then(function(chan){
				if (!ctag) return false;

				return chan.cancel(ctag);
			});
	};

	receieveFunc.close = function(){
		return queuePromise
			.then(function(chan){
				chan.close();
			});
	};

	receieveFunc.destroy = function(){
		return queuePromise
			.then(function(chan){
				return chan.deleteQueue(name)
					.then(_.constant(chan));
			})
			.then(function(chan){
				chan.close();
			});
	};

	var property = Object.defineProperty.bind(Object, receieveFunc);
	property('ready', {
		get: function(){ return queuePromise; }
	});
	property('started', {
		get: function(){ return queuePromise; }
	});

	return receieveFunc;
}

module.exports = Queue;

