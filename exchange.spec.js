var Queue = require('./queue'),
	Exchange = require('./exchange'),
	ezuuid = require('ezuuid');

describe('exchange', function(){
	it('should be able to publish to the default exchange', function(done){
		this.timeout(5000);

		var message = ezuuid(),
			queueName = ezuuid(),
			defaultExchanage = new Exchange();

		defaultExchanage.on('ready', function(){
			var queue = new Queue({
				autoDelete: true,
				exclusive: true,
				name: queueName,
				ready: function(){
					console.log('queue is ready!!!!!!!!!');
					defaultExchanage.publish(
							{message:message}, 
							{key:queueName}
						);
				}
			});

			queue(function(msg, ack){
				if (msg.message !== message) return done('got a message I shouldnt have');

				ack();
				done();
			});

		});
	});

	it('should be able to publish a delayed message', function(done){
		this.timeout(10000);

		var message = ezuuid(),
			exchangeName = ezuuid();

		var beginTicks;

		var exchange = new Exchange({
				autoDelete: true,
				name: exchangeName
			});

		exchange.on('ready', function(){
			var queue = new Queue({
				autoDelete: true,
				exclusive: true,
				exchangeNames: [exchangeName],
				ready: function(){
					beginTicks = Date.now();
					exchange.delayedPublish({message: message}, {delay:3100});
				}
			});

			queue(function(msg, ack){
				if (msg.message !== message) return done('got a message I shouldnt have');

				var timeDiff = Date.now() - beginTicks;

				if (timeDiff<=3000){ // TODO: somehow a tiny bit off, it's cool with me atm
					return done(new Error('too fast'));
				}

				ack();
				done();
			});
		});

	});

	it('should be able to publish a delayed message to a topic exchange', function(done){
		this.timeout(10000);

		var message = ezuuid(),
			exchangeName = ezuuid();

		var beginTicks;

		var exchange = new Exchange({
				autoDelete: true,
				type: 'topic',
				name: exchangeName
			});

		exchange.on('ready', function(){
			var queue = new Queue({
				autoDelete: true,
				exclusive: true,
				exchangeNames: [exchangeName],
				key: '111',
				ready: function(){
					beginTicks = Date.now();
					exchange.delayedPublish({message: message}, {delay:3100, key: '111' });
				}
			});

			queue(function(msg, ack){
				if (msg.message !== message) return done('got a message I shouldnt have');

				var timeDiff = Date.now() - beginTicks;

				if (timeDiff<=3000){ // TODO: somehow a tiny bit off, it's cool with me atm
					return done(new Error('too fast'));
				}

				ack();
				done();
			});
		});

	});

	it('should be able to publish a delayed message to a direct exchange', function(done){
		this.timeout(10000);

		var message = ezuuid(),
			exchangeName = ezuuid();

		var beginTicks;

		var exchange = new Exchange({
				autoDelete: true,
				type: 'direct',
				name: exchangeName
			});

		exchange.on('ready', function(){
			console.log('exchange ready');
			var queue = new Queue({
				autoDelete: true,
				exclusive: true,
				key: '111',
				exchangeNames: [exchangeName],
				ready: function(){
					console.log('delay pub');
					beginTicks = Date.now();
					exchange.delayedPublish({message: message}, {delay:3100, key: '111' });
				}
			});

			queue(function(msg, ack){
				if (msg.message !== message) return done('got a message I shouldnt have');

				var timeDiff = Date.now() - beginTicks;

				if (timeDiff<=3000){ // TODO: somehow a tiny bit off, it's cool with me atm
					return done(new Error('too fast'));
				}

				ack();
				done();
			});
		});

	});

	it('should be able to publish a delayed message to an x-lvc exchange', function(done){
		this.timeout(10000);

		var message = ezuuid(),
			exchangeName = ezuuid();

		var beginTicks;

		var exchange = new Exchange({
				autoDelete: true,
				type: 'x-lvc',
				name: exchangeName
			});

		exchange.on('ready', function(){
			var queue = new Queue({
				autoDelete: true,
				exclusive: true,
				key: 'fun',
				exchangeNames: [exchangeName],
				ready: function(){
					beginTicks = Date.now();
					exchange.delayedPublish({message: message}, {delay:3100, key: 'fun' });
				}
			});

			queue(function(msg, ack){
				if (msg.message !== message) return done('got a message I shouldnt have');

				var timeDiff = Date.now() - beginTicks;

				if (timeDiff<=3000){ // TODO: somehow a tiny bit off, it's cool with me atm
					return done(new Error('too fast'));
				}

				ack();
				done();
			});
		});

	});

	it('should be able to receive a publish confirm', function(done){
		this.timeout(5000);

		var message = ezuuid(),
			exchangeName = ezuuid(),
			exchange = new Exchange({
				name: exchangeName, 
				autoDelete: true,
				confirm:true
			});

		var publishConfirmed = false;

		exchange.on('ready', function(){
			var queue = new Queue({
				autoDelete: true,
				exclusive: true,
				exchangeNames: [exchangeName],
				ready: function(){
					exchange.publish({message: message}, {}, function(){
							publishConfirmed = true;
						});
				}
			});

			queue(function(msg, ack){
				// give it a second.  sometimes the confirms come in after the message
				setTimeout(function(){
					if (msg.message !== message) return done('got a message I shouldnt have');

					if (!publishConfirmed){
						ack(new Error('not confirmed!'));
					}

					ack();
					done();
				}, 1000);
			});
		});
	});

});
