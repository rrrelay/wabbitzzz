var uuid = require('ezuuid');
var _ = require('lodash');
var defaultExchangePublish = require('./default-exchange-publish');
var q = require('q');
var getConnection = require('./get-connection');
var amqp = require('amqp');

var DEFAULTS = {
	exclusive: false,
	autoDelete: false,
	durable: true,
	ack: true,
	useErrorQueue: false,
};

function _getConnection(){
	var d = q.defer();

	var connection = amqp.createConnection({ url:  process.env.WABBITZZZ_URL || 'amqp://localhost' });
	connection.addListener('ready', d.resolve.bind(d, connection));
	connection.addListener('error', d.reject.bind(d));

	return d.promise;
}

var connection = _getConnection();

function Queue(params){
	params = _.extend({}, DEFAULTS, params);

	var name = params.name || ((params.namePrefix || '') + uuid()),
		errorQueueName = name + '_error',
		routingKey = (params.key || '#').toString(),
		ctag;

	var exchangeNames = _.chain([params.exchangeNames])
		.union([params.exchangeName])
		.flatten()
		.uniq()
		.filter(Boolean)
		.value();

	if (params.useErrorQueue) {
		var tmp = new Queue({ 
			name: errorQueueName, 
			durable: true,
			ready: function(){
				tmp.close();
			},
		});
	}


	var queuePromise = connection
		.then(function(c){
			return _getQueue(c);
		});


	function _getQueue(connection){
		var d = q.defer();

		var readyFn = params.ready;
		delete params.ready;

		var myQ = connection.queue(name, params, function(queue){
			function onBindComplete(){
				if (_.isFunction(readyFn))
					readyFn(queue);
			
				d.resolve(queue);
			}

			if (_.isEmpty(exchangeNames)){
				queue.bind(routingKey, onBindComplete);
			} else {
				exchangeNames.forEach(function(exchangeName){
					// only the last callback is called
					queue.bind(exchangeName, routingKey, onBindComplete);
				});
			}
		});

		myQ.on('error', function(err){
			console.log('unable to bind to queue: '+ name);
			console.error(err);
			d.reject(err);
		});

		return d.promise;
	}


	var receieveFunc = function(fn){
		queuePromise
			.then(function(queue){
				var opt = {};
				if (params.ack) opt.ack = true;

				queue.subscribe(opt, function (message, headers, deliveryInfo) {
					if (deliveryInfo) {
						message._routingKey = message._routingKey || deliveryInfo.routingKey;
						message._replyTo = deliveryInfo.replyTo;
						message._correlationId = deliveryInfo.correlationId;
					}

					if (message.__stop === '_wabbitzzz_stop_please') {

						if (message.pid == process.pid){
							console.log('exit requested');
							queue.shift();
							process.exit();
							return;
						} else {
							console.log('exit requested, but not for this process');
							queue.shift();
							console.dir(message);
							
							return;
						}
					}

					var doneCalled = false;

					var done = function(error){
						if (!opt.ack) return;
						doneCalled = true;

						if (!error){
							return queue.shift();
						}

						if (params.useErrorQueue) {
							message._error = _.extend({}, {message: error.message, stack: error.stack}, error);
							var options = { key: errorQueueName, persistent: true };
							defaultExchangePublish(message, options)
								.then(function(){
									return queue.shift();
								})
								.catch(function(publishError){
									console.error(error);
									console.error(publishError);
								});

						} else {
							console.log('HEY ...........................');
							console.dir(error);
							console.log('BYE ...........................');

							// put the message back on the queue and shut it down
							queue.shift(true, true);
							queue.close();

						}
					};

					try {
						fn(message, done);
					} catch (e){
						if (!doneCalled){
							done(e.toString());
						}
					}
				}).addCallback(function(res){
					ctag = res.consumerTag;
				});
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

