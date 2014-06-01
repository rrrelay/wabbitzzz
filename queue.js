var uuidModule = require('uuid');
var uuid = uuidModule.v4.bind(uuidModule);
var amqp = require('amqp'),
	_ = require('lodash'),
	q = require('q');

var DEFAULTS = {
	exclusive: false,
	autoDelete: false,
	durable: true
};

var Exchange = require('./exchange');
var badMessageExchange = new Exchange({
	name: 'bad_message'
});

function Queue(params){
	params = _.extend(Object.create(null), DEFAULTS, params);

	var name = params.name || uuid(),
		routingKey = (params.key || '#').toString(),
		exchangeName = params.exchangeName,
		ctag;

	delete params.name;
	delete params.key;
	delete params.exchangeName;

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
			queue.bind(exchangeName, routingKey);
		});

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

	return receieveFunc;
}

module.exports = Queue;

