var _ = require('lodash');
var Promise = require('bluebird');
var ezuuid = require('ezuuid');
var getConnection = require('./get-connection');
var ONE_SECOND = 1000;
var Queue = require('./queue');

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
	options.name = queueName;

	var deliveries = [];
	var pending = false;

	function _getMessages(chan) {
		var done = _.debounce(function() {
			if (pending) return done();

			var myDeliveries = deliveries;
			var myMessages = _.map(myDeliveries, 'message');

			pending = true;
			deliveries = [];

			cb(myMessages, function(err){
				pending = false;

				if (err) {
					chan.nackAll();
				} else {
					chan.ackAll();
				}
			});

		}, delay, { maxWait: maxDelay });

		return chan.consume(queueName, function (message) {
			if (!message) return false;

			var msg = JSON.parse(message.content);
			deliveries.push({
				message: msg,
				ack: chan.ack.bind(chan, message),
			});

			done();
		}, { noAck: false })
		.then(_.constant(chan));
	}

	function _getQueue(){
		return new Promise((resolve, reject) => {
			var oldReady = options.ready;
			options.ready = function(err) {
				if (err) {
					reject(err);
				} else {
					resolve(true);
				}
				// no need to keep this channel open after the queue
				// has been created
				q.close();

				if (_.isFunction(oldReady)){
					oldReady();
				}
			};
			var q = new Queue(options);
		})
	}

	return _getQueue()
		.then(() => getConnection())
		.then(conn => conn.createChannel())
		.then(_getMessages)
		.then(function(chan){
			return {
				destory: chan.deleteQueue.bind(chan, queueName),
			};
		})
}

module.exports = bulkDequeue;
