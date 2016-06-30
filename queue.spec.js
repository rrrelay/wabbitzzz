var Queue = require('./queue'),
	Promise = require('bluebird'),
	_ = require('lodash'),
	Exchange = require('./exchange'),
	ezuuid = require('ezuuid'),
	expect = require('chai').expect;


describe('queue', function(){
	it('should be able to bind to a single exchange', function(done){
		this.timeout(5000);

		var exchangeName = ezuuid();
		var message = ezuuid();

		var exchange1 = new Exchange({name: exchangeName, autoDelete: true});

		exchange1.on('ready', function(){

			var queue = new Queue({
				autoDelete: true,
				exclusive: true,
				exchangeName: exchangeName,
				ready: function(){
					exchange1.publish({key:message});
				},
			});

			queue(function(msg, ack){
				if (msg.key !== message) return done('got a message I shouldnt have');

				ack();
				done();
			});

		});
	});

	it('should be able to bind to a single exchange with the exchangeNames property', function(done){
		this.timeout(5000);

		var exchangeName = ezuuid();
		var message = ezuuid();

		var exchange1 = new Exchange({name: exchangeName, autoDelete: true});

		exchange1.on('ready', function(){

			var queue = new Queue({
				autoDelete: true,
				exclusive: true,
				exchangeNames: [exchangeName],
				ready: function(){
					exchange1.publish({key:message});
				},
			});

			queue(function(msg, ack){
				if (msg.key !== message) return done('got a message I shouldnt have');

				ack();
				done();
			});

		});
	});

	it('should be able to bind to multiple exchanges', function(done){
		this.timeout(5000);

		var exchangeName1 = ezuuid(),
			exchangeName2 = ezuuid(),
			message1 = ezuuid(),
			message2 = ezuuid();

		var exchange1 = new Exchange({name: exchangeName1, autoDelete: true, durable: false});
		var exchange2 = new Exchange({name: exchangeName2, autoDelete: true, durable: false});

		Promise.all([exchange1.ready, exchange2.ready])
			.then(function(){
				var queue = new Queue({
					autoDelete: true,
					exclusive: true,
					exchangeNames: [exchangeName1, exchangeName2]
				});

				var gotMessage1 = false, 
					gotMessage2 = false;
				
				queue(function(msg, ack){
					if (msg.key === message1) {
						gotMessage1 = true;
					}
					if (msg.key === message2) {
						gotMessage2 = true;
					}

					ack();

					if (gotMessage1 && gotMessage2){
						done();
					}
				});

				_.delay(exchange1.publish, 200, {key:message1});
				_.delay(exchange2.publish, 200, {key:message2});
			});
	});

	it('should include the _exchange property', function(done){
		this.timeout(5000);

		var exchangeName = ezuuid();
		var message = ezuuid();

		var exchange1 = new Exchange({name: exchangeName, autoDelete: true});

		exchange1.on('ready', function(){

			var queue = new Queue({
				autoDelete: true,
				exclusive: true,
				exchangeName: exchangeName,
				ready: function(){
					exchange1.publish({key:message});
				},
			});

			queue(function(msg, ack){
				if (msg.key !== message) return done('got a message I shouldnt have');

				if (msg._exchange !== exchangeName) return done('bad _exchangeName');

				ack();
				done();
			});

		});
	});

	it('should be able to push errors to xxx_error queue', function(done){
		this.timeout(8000);

		function _readError(){
			var errorQueue = new Queue({
				name: queueName +  '_error',
			});

			errorQueue(function(msg, ack){
				expect(msg._error).to.be.okay;
				expect(msg._error.message).to.be.equal(errorKey);
				ack();

				errorQueue.destroy();
				done();
			});

		}

		var exchangeName = ezuuid();
		var queueName = ezuuid();
		var message = ezuuid();
		var errorKey = ezuuid();

		var exchange1 = new Exchange({name: exchangeName, autoDelete: true});

		exchange1.on('ready', function(){
			var queue = new Queue({
				name: queueName,
				autoDelete: true,
				exclusive: true,
				useErrorQueue: true,
				exchangeName: exchangeName,
				ready: function(){
					console.log('pooblishing');
					exchange1.publish({ key: message });
				},
			});

			queue(function(msg, ack){
				if (msg.key !== message) return done('got a message I shouldnt have');
				if (msg._exchange !== exchangeName) return done('bad _exchangeName');

				ack(new Error(errorKey));

				queue.destroy();
				_readError();
			});
		});
	});

	it('should be able to bind with different routing keys', function(done){
		this.timeout(5000);

		var exchangeName1 = ezuuid(),
			exchangeName2 = ezuuid(),
			message1 = ezuuid(),
			message2 = ezuuid();

		var key1 = 'some_cool_key';
		var key2 = 'some_lame_key';
		var exchange1 = new Exchange({name: exchangeName1, autoDelete: true, durable: false, type: 'direct'});
		var exchange2 = new Exchange({name: exchangeName2, autoDelete: true, durable: false, type: 'direct'});

		Promise.all([exchange1.ready, exchange2.ready])
			.then(function(){
				var queue = new Queue({
					autoDelete: true,
					exclusive: true,
					exchanges: [
						{ name: exchangeName1, key: key1 },
						{ name: exchangeName2, key: key2 },
					],
				});

				var gotMessage1 = false,
					gotMessage2 = false;
				
				queue(function(msg, ack){
					if (msg.msg === message1) {
						gotMessage1 = true;
					} else if (msg.msg === message2) {
						gotMessage2 = true;
					} else {
						done(new Error('got a bad message'));
					}

					ack();

					if (gotMessage1 && gotMessage2){
						done();
					}
				});

				_.delay(exchange1.publish, 200, {msg:message1}, {key: 'some_wrong_key' });
				_.delay(exchange2.publish, 200, {msg:message2}, {key: 'some_wrong_key' });
				_.delay(exchange1.publish, 400, {msg:message1}, {key: key1 });
				_.delay(exchange2.publish, 400, {msg:message2}, {key: key2 });
			});
	});

	it('should be able to create an exchange on the fly if give the data', function(done){
		var exchangeName1 = ezuuid(),
			exchangeName2 = ezuuid(),
			message1 = ezuuid(),
			message2 = ezuuid();

		var key1 = 'some_cool_key';
		var key2 = 'some_lame_key';

		var queue = new Queue({
			autoDelete: true,
			exclusive: true,
			bindings: [
				{ name: exchangeName1, key: key1, type: 'direct', durable: false, autoDelete: true },
				{ name: exchangeName2, key: key2, type: 'direct', durable: false, autoDelete: true },
			],
			ready: function(){
				// now that the binding should have created the exchanges already
				var exchange1 = new Exchange({name: exchangeName1, autoDelete: true, durable: false, type: 'direct'});
				var exchange2 = new Exchange({name: exchangeName2, autoDelete: true, durable: false, type: 'direct'});

				_.delay(exchange1.publish, 200, {msg:message1}, {key: 'some_wrong_key' });
				_.delay(exchange2.publish, 200, {msg:message2}, {key: 'some_wrong_key' });
				_.delay(exchange1.publish, 400, {msg:message1}, {key: key1 });
				_.delay(exchange2.publish, 400, {msg:message2}, {key: key2 });
			},
		});

		var gotMessage1 = false,
			gotMessage2 = false;
		
		queue(function(msg, ack){
			if (msg.msg === message1) {
				gotMessage1 = true;
			} else if (msg.msg === message2) {
				gotMessage2 = true;
			} else {
				done(new Error('got a bad message'));
			}

			ack();

			if (gotMessage1 && gotMessage2){
				done();
			}
		});
	});
});
