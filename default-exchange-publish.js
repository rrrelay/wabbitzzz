var _ = require('lodash');
var getConnection = require('./get-connection');

var PUBLISH_DEFAULTS = {
	persistent: false,
	contentType: 'application/json',
};

function mkCallback(i) {
	return function(err) {
		if (err !== null) { console.error('Message %d failed!', i); }
		else { console.log('Message %d confirmed', i); }
	};
}
function _publish(msg, options){
	return getConnection()
		.then(function(conn){
			return conn.createConfirmChannel();
		})
		.then(function(chan){
			var key = options.key;
			options = _.extend({}, PUBLISH_DEFAULTS, options);
			delete options.key;

			console.log('publishing to ' + key);
			console.dir(options);
			chan.publish('', key, Buffer(JSON.stringify(msg)), options)
			return chan.waitForConfirms()
				.then(function(res){
					console.dir(res);
					console.log('all good');
					return chan.close();
				})
				.then(function(){
					console.log('all good');
					return true;
				});
		})
		.timeout(20 * 1000);
}


module.exports = _publish;
