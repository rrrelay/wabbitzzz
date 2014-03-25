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
			var metadata = message.wabbittzzz;
			var doneCalled = false;

			delete message.wabbittzzz;

			var done = function(error){
				doneCalled = true;

				if (!error){
					return theQueue.shift();
				}

				global.logger.error(error);
				
				if (metadata){
					message.wabbittzzz = metadata;
					metadata.attempts += 1;

					if (metadata.attempts > 2){ 
						// if this is the 3rd failure
						// then remove the message from the queue
						// and push to the bad message exchange.

						theQueue.shift();
						badMessageExchange.publish(message, {persistent:true});
						return;
					} 
				}
				else {
					message.wabbittzzz = { attempts: 1 };
				}
				
				// put the message back on the queue
				theQueue.shift(true, true);
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

