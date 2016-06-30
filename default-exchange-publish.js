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
			options = _.extend({}, PUBLISH_DEFAULTS, options);
			delete options.key;

			chan.publish('', key, Buffer(JSON.stringify(msg)), options);

			return chan.waitForConfirms();
		})
		.timeout(20 * 1000);
}


module.exports = _publish;
