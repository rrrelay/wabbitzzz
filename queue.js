var uuid = require('ezuuid'),
	amqp = require('amqp'),
	_ = require('lodash'),
	q = require('q');

var DEFAULTS = {
	exclusive: false,
	autoDelete: false,
	durable: true
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

	var queuePromise = connection.then(_getQueue);

	function _getQueue(connection){
		var d = q.defer();

		connection.queue(name, params, function(queue){
			exchangeNames.forEach(function(exchangeName){
				// only the last callback is called
				queue.bind(exchangeName, routingKey, function(){
					if (_.isFunction(params.ready))
						params.ready(queue);

					d.resolve(queue);
				});
			});
		});

		return d.promise;
	}


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
			})
			.done();
	};

	receieveFunc.stop = function(){
		return queuePromise
			.then(function(queue){
				if (!ctag) return false;

				return queue.unsubscribe(ctag);
			});
	};

	receieveFunc.destroy = function(){
		return queuePromise
			.then(function(queue){

				return queue.destroy();
			});
	};

	return receieveFunc;
}

module.exports = Queue;

