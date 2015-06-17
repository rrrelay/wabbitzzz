var Exchange = require('./exchange'),
	Queue = require('./queue'),
	ezuuid = require('ezuuid');

module.exports = function(methodName){
	var ex = new Exchange();

	return function(req, cb){
		var key = ezuuid();
		req._rpcKey = key;

		return ex.ready.then(function(){
			var q = new Queue({
				name: key,
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
