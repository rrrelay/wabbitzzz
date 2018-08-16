var _ = require('lodash');
var getConnection = require('./get-connection');

var PUBLISH_DEFAULTS = {
	persistent: false,
	contentType: 'application/json',
};

var channel = getConnection()
	.then(function(conn){
		return conn.createConfirmChannel();
	});

function _publish(msg, options){
	return channel
		.then(function(chan){
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
				return chan.assertQueue(delayQueueName, queueOptions)
					.then(() => {
						console.log('what');
						console.dir(delayQueueName);
						return chan.publish('', delayQueueName, Buffer(JSON.stringify(msg)), options);
					});
			} else {

				chan.publish('', key, Buffer(JSON.stringify(msg)), options);
				return chan.waitForConfirms();
			}

		})
		.timeout(20 * 1000);
}


module.exports = _publish;
