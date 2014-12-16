var Queue = require('./queue'),
	Exchange = require('./exchange'),
	expect = require('chai').expect,
	ezuuid = require('ezuuid'),
	_ = require('lodash'),
	q = require('q');

var DEFAULTS = {
	duration: 3000,
};
module.exports = function(msg){
	msg = _.extend({}, DEFAULTS, msg);

	var d = q.defer(),
		queueName = 'delay_' + msg.duration +'_to_'+msg.queueName;

	new Queue({
		name: queueName,
		exclusive: false,
		autoDelete: false,
		arguments: {
			'x-dead-letter-exchange': '',
			'x-dead-letter-routing-key': msg.queueName,
			'x-message-ttl': msg.duration,
		},
		ready: function(){
			var defaultExchange = new Exchange();

			defaultExchange.on('ready', function(){
				defaultExchange.publish(msg.message, {key: queueName});
			});
		}
	});

	return d.promise;
};
