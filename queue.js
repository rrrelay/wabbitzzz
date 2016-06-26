var uuid = require('ezuuid');
var _ = require('lodash');
var defaultExchangePublish = require('./default-exchange-publish');
var Promise = require('q');
var getConnection = require('./get-connection');

var DEFAULTS = {
	exclusive: false,
	autoDelete: false,
	durable: true,
	ack: true,
	useErrorQueue: false,
};

const pass = function pass(f){
	return (...args) => {
		const chan = _.first(args);
		return f.apply(null, args)
			.then(() => chan);
	};
	

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
		useErrorQueue = params.useErrorQueue,
		errorQueueName = name + '_error',
		routingKey = (params.key || '#').toString(),
		prefetchCount = params.prefetchCount || 1,
		ctag,
		noAck = getNoAckParam(params);

	var exchangeNames = _.chain([params.exchangeNames])
		.union([params.exchangeName])
		.flatten()
		.uniq()
		.filter(Boolean)
		.value();

	delete params.exchangeName;
	delete params.exchangeNames;
	delete params.name;
	delete params.useErrorQueue;
	delete params.key;
	delete params.noAck;
	delete params.ack;

	function bindQueue(chan, exchangeNames, routingKey){
		return _.chain(exchangeNames)
			.toArray()
			.map(function(exchangeName){
				return chan.bindQueue(
					name,
					exchangeName,
					routingKey
					);
			})
			.thru(Promise.all)
			.value()
			.then(_.constant(chan));
	}

	var queuePromise = assertQueue(name, exchangeNames, params)
		.then(function(chan) {
			return bindQueue(chan, exchangeNames, routingKey);
		})
		.then(function(chan){
			if (params.useErrorQueue){
				return chan.assertQueue(errorQueueName, { durable: true })
					.then(_.constant(chan));
			}

			return chan;
		})
		.then(function(chan){
			return chan.prefetch(prefetchCount)
				.then(_.constant(chan));
		})
		.then(function(chan){
			if (_.isFunction(params.ready)) {
				params.ready();
			}

			return chan;
		});

	var receieveFunc = function(fn){
		queuePromise
			.then(function(chan){
				console.log('consuming from ' + name + ' ' + noAck);
				return chan.consume(name, function(msg) {
					var doneCalled = false;
					var done = function(error){
						if (!noAck) return;

						doneCalled = true;

						if (!error){
							return chan.ack(msg);
						}

						if (useErrorQueue) {
							msg._error = _.extend({}, {message: error.message, stack: error.stack}, error);
							var options = { key: errorQueueName, persistent: true };

							defaultExchangePublish(msg, options)
								.then(function(){
									return chan.ack(msg);
								})
								.catch(function(publishError){
									console.error(error);
									console.error(publishError);
								});

						} else {
							console.log('HEY ...........................');
							console.dir(error);
							console.log('BYE ...........................');

							chan.close();
						}
					};

					try {
						var myMessage = JSON.parse(msg.content.toString());
						console.dir(myMessage);
						fn(myMessage, done);
					} catch (e){
						if (!doneCalled){
							done(e.toString());
						}
					}

				}, { noAck: noAck });
			})
			.then(res => {
				ctag = res.consumerTag;
			})
			.catch(function(err){
				console.log('there was a problem create queue: ' + name);
				console.error(err);
			});
	};

	receieveFunc.stop = function(){
		return queuePromise
			.then(function(queue){
				if (!ctag) return false;

				return queue.unsubscribe(ctag);
			});
	};

	receieveFunc.close = function(){
		return queuePromise
			.then(function(queue){
				queue.close();
			});
	};

	receieveFunc.destroy = function(){
		return queuePromise
			.then(function(queue){

				return queue.destroy();
			});
	};

	var property = Object.defineProperty.bind(Object, receieveFunc);
	property('ready', {
		get: function(){ return queuePromise; }
	});

	return receieveFunc;
}

module.exports = Queue;

