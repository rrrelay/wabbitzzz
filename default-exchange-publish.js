var _ = require('lodash');
var getConnection = require('./connection').getConnection;

var PUBLISH_DEFAULTS = {
	persistent: false,
	contentType: 'application/json',
};

var channelDict = {};

function getChannel(connString) {
	return getConnection(connString)
		.then(function(conn){
			return conn.createConfirmChannel();
		});
}

function _publish(connString, msg, options){
	const connName = connString ? connString : 'main';
	if (!channelDict[connName]) {
		channelDict[connName] = getChannel(connString);
	}
	return channelDict[connName]
		.then(function(chan) {
			var key = options.key;
			var delay = options.delay;

			options = _.extend({}, PUBLISH_DEFAULTS, options);
			delete options.key;
			delete options.delay;

			if (delay) {
				const queueOptions = {
					arguments: {
						'x-dead-letter-exchange': '',
						'x-dead-letter-routing-key': key,
						'x-message-ttl': delay,
					},
				};

				const delayQueueName = `delay_default_${key}_${delay}`;

				chan.on('close', function() {
					delete channelDict[connName];
				});

				return chan.assertQueue(delayQueueName, queueOptions)
					.then(() => {
						chan.publish('', delayQueueName, Buffer(JSON.stringify(msg)), options);
						return chan.waitForConfirms();
					});
			} else {

				chan.publish('', key, Buffer(JSON.stringify(msg)), options);
				return chan.waitForConfirms();
			}

		})
		.timeout(20 * 1000);
}

module.exports = _publish;
