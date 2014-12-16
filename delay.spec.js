var Queue = require('./queue'),
	delay = require('./delay'),
	ezuuid = require('ezuuid');

describe('delay', function(){
	it('should be able to delay a message', function(done){
		this.timeout(15000);

		var message = ezuuid(),
			queueName = ezuuid();

		var beginTicks;

		var queue = new Queue({
			autoDelete: true,
			exclusive: true,
			name: queueName,
			ready: function(){
				beginTicks = Date.now();

				delay({
					duration: 2000,
					queueName: queueName,
					message: {message:message},
				});
			}
		});

		queue(function(msg, ack){
			if (msg.message !== message) return done('got a message I shouldnt have');

			var timeDiff = Date.now() - beginTicks;

			if (timeDiff<=2000){
				return done(new Error('too fast'));
			}

			ack();
			done();
		});

	});
});
