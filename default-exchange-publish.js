var _ = require('lodash');
var getConnection = require('./get-connection');

var PUBLISH_DEFAULTS = {
	persistent: false,
	contentType: 'application/json',
};

function _publish(msg, options){
	return getConnection()
		.then(function(conn){
			return conn.createConfirmChannel();
		})
		.then(function(chan){
			var key = options.key;
			options = _.extend({}, PUBLISH_DEFAULTS, options);
			delete options.key;

			chan.publish('', key, Buffer(JSON.stringify(msg)), options);

			return chan.waitForConfirms()
				.then(function(){
					return chan.close();
				});
		})
		.timeout(20 * 1000);
}


module.exports = _publish;
