var _ = require('lodash');
var q = require('q');
var ezuuid = require('ezuuid');
var getConnection = require('./get-connection');
var ONE_SECOND = 1000;

var DEFAULTS = {
	delay: 5 * ONE_SECOND,
	maxDelay: 30 * ONE_SECOND,
	exclusive: false,
	autoDelete: false,
	durable: true,
	key: '#',
};

function bulkDequeue(opt, cb){
	var options = _.extend({}, DEFAULTS, opt);
	var delay = options.delay;
	var maxDelay = options.maxDelay;
	var queueName = options.name || ezuuid();
	var exchangeNames = _.chain(options.exchangeName)
		.toArray()
		.concat(options.exchangeNames)
		.filter(Boolean)
		.value();


	var deliveries = [];
	var pending = false;

	var done = _.debounce(function(){
		if (pending) return done();

		var myDeliveries = deliveries;
		var myMessages = _.map(myDeliveries, 'message');

		pending = true;
		deliveries = [];

		cb(myMessages, function(err){
			if (err){
				console.log('error: ' + queueName);
				return console.error(err);
			}

			myDeliveries.forEach(function(d){ d.ack(); });
			pending = false;
		});

	}, delay, { maxWait: maxDelay });

	function _getMessages(queue){
		// give me all the messages
		var bulkOptions = {
			ack: true,
			prefetchCount: 0,
		};

		queue.subscribe(bulkOptions, function (message, headers, deliveryInfo, ack) {
			deliveries.push({
				message: message,
				ack: ack.acknowledge.bind(ack),
			});

			done();
		});

		return queue;
	}

	function _getQueue(connection){
		var d = q.defer();

		var myQ = connection.queue(queueName, options, function(queue){
			function onBindComplete(){
				d.resolve(queue);

				if (_.isFunction(options.ready)){
					options.ready();
				}
			}

			if (_.isEmpty(exchangeNames)){
				queue.bind(options.key, onBindComplete);
			} else {
				exchangeNames.forEach(function(exchangeName){
					queue.bind(exchangeName, options.key, onBindComplete);
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

	return getConnection()
		.then(_getQueue)
		.then(_getMessages)
		.then(function(queue){
			return {
				destory: queue.destory.bind(queue),
			};
		});
}

module.exports = bulkDequeue;
