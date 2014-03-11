var amqp = require('amqp'),
	_ = require('lodash'),
	q = require('q');

var DEFAULTS = {
	exclusive: false,
	autoDelete: false,
	durable: true
};

function _getConnection(){
	var deferred = q.defer();
	var connection = amqp.createConnection({ host: '127.0.0.1' });
	connection.addListener('ready', deferred.resolve.bind(deferred, connection));

	return deferred.promise;
}

function Queue(params){
	params = _.extend(Object.create(null), DEFAULTS, params);
	var name = params.name,
		exchange = params.exchangeName;

	delete params.name;
	delete params.exchangeName;

	function doBind(fn, theQueue){
		theQueue.bind(exchange,'#');

		theQueue.subscribe({ack:true}, function (message) {
			var start = new Date();

			var doneCalled = false;
			var done = function(error){
				if (error){
					global.logger.error(error);
					theQueue.shift(true, true);
				} else {
					theQueue.shift();
				}
				doneCalled = true;
			};

			try {
				fn(message, done);
			} catch (e){
				if (!doneCalled){
					done(e.toString());
				}
			}
		});
	}

	return function(fn){
		_getConnection()
			.then(function(connection){
				connection.queue(name, params, doBind.bind(null, fn));
			});
	};
}

module.exports = Queue;

