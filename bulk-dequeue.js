var _ = require('lodash');
var Promise = require('bluebird');
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

	function _getMessages(chan){
		return chan.consume(queueName, function (message) {
			if (!message) return false;

			var msg = JSON.parse(message.content);
			console.dir(msg);
			deliveries.push({
				message: msg,
				ack: chan.ack.bind(chan, message),
			});

			done();
		}, { noAck: false })
		.then(_.constant(chan));
	}

	function _getQueue(connection){
		return Promise.resolve(connection.createChannel())
			.then(function(chan){
				chan.on('error', function(err){
					console.error('error with bulk-dequeue', err);
				});

				return chan.assertQueue(queueName, options)
					.then(_.constant(chan));
			})
			.then(function(chan){
				// this means give me all the messages
				return chan.prefetch(0)
					.then(_.constant(chan));
			})
			.then(function(chan){
				return _.chain(exchangeNames)
					.toArray()
					.map(function(exchangeName){
						return chan.bindQueue(queueName, exchangeName, options.key);
					})
					.thru(Promise.all)
					.value()
					.then(_.constant(chan));
			})
			.then(function(chan){
				if (_.isFunction(options.ready)){
					options.ready();
				}

				return chan;
			});
	}

	return getConnection()
		.then(_getQueue)
		.then(_getMessages)
		.then(function(chan){
			return {
				destory: chan.deleteQueue.bind(chan, queueName),
			};
		});
}

module.exports = bulkDequeue;
