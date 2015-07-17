var Exchange = require('./exchange'),
	Queue = require('./queue'),
	ezuuid = require('ezuuid');

var ex = new Exchange({type:'topic', name: '_rpc_send'});

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
				try {
					if (cb)cb(null, msg);
				} catch (e){
					console.error(e);
				}
				ack();
				q.destroy();
			});
			
		});

	};

};
