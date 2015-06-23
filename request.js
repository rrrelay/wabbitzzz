var Exchange = require('./exchange'),
	Queue = require('./queue'),
	ezuuid = require('ezuuid');

var ex = new Exchange();

module.exports = function(methodName){

	return function(req, cb){
		var key = ezuuid();
		req._rpcKey = key;

		return ex.ready.then(function(){
			var q = new Queue({
				name: key,
				autoDelete: true,
				exclusive: true,
				ready: function(){
					ex.publish(req, {key: methodName});
				},
			});

			q(function(msg, ack){
				if (cb)cb(null, msg);
				ack();
				q.destroy();
			});
			
		});

	};

};
