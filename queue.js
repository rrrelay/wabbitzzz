var uuid = require('ezuuid'),
	amqp = require('amqp'),
	_ = require('lodash'),
	q = require('q');

var DEFAULTS = {
	exclusive: false,
	autoDelete: false,
	durable: true
};



function Queue(params){
	params = _.extend(Object.create(null), DEFAULTS, params);

	var name = params.name || ((params.namePrefix || '') + uuid()),
		routingKey = (params.key || '#').toString(),
		ctag;

	var exchangeNames = _.chain([params.exchangeNames])
		.union([params.exchangeName])
		.flatten()
		.uniq()
		.filter(Boolean)
		.value();

	var queuePromise = _getConnection().then(_getQueue);

	function _getConnection(){
		var deferred = q.defer();
		var connection = amqp.createConnection({ url: process.env.WABBITZZZ_URL || 'amqp://localhost' });
		connection.addListener('ready', deferred.resolve.bind(deferred, connection));

		return deferred.promise;
	}

	function _getQueue(connection){
		var d = q.defer();

		connection.queue(name, params, function(queue){
			d.resolve(queue);
		});

		return d.promise;
	}

	queuePromise
		.then(function(queue){
			exchangeNames.forEach(function(exchangeName){
				queue.bind(exchangeName, routingKey);
			});
		}).done();

	var receieveFunc = function(fn){
		queuePromise
			.then(function(queue){
				queue.subscribe({ack:true}, function (message) {
					var doneCalled = false;

					var done = function(error){
						doneCalled = true;

						if (!error){
							return queue.shift();
						}

						global.logger.error(error);
						
						// put the message back on the queue
						queue.shift(true, true);
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
			});
	};

	receieveFunc.stop = function(){
		queuePromise
			.then(function(queue){
				if (!ctag) return;

				queue.unsubscribe(ctag);
			});
	};

	receieveFunc.destroy = function(){
		queuePromise
			.then(function(queue){

				queue.destroy();
			});
	};

	return receieveFunc;
}

module.exports = Queue;

