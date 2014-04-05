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
		exchangeName = params.exchangeName,
		ctag;

	delete params.name;
	delete params.exchangeName;

	var queuePromise = _getConnection().then(_getQueue);

	function _getConnection(){
		var deferred = q.defer();
		var connection = amqp.createConnection({ host: '127.0.0.1' });
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

	function doBind(fn, theQueue){
		theQueue.bind(exchangeName, '#');

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
		}).addCallback(function(res){
			ctag = res.consumerTag;
		});
	}

	var receieveFunc = function(fn){
		queuePromise
			.then(function(queue){
				doBind(fn, queue);
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

