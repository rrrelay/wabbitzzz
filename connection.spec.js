const Queue = require('./queue')();
const Exchange = require('./exchange')();
const Connection = require('./connection');

const ezuuid = require('ezuuid');

describe('connection', function() {
	it('should be able to publish to the exchange with default connection', function(done) {
		const message = ezuuid();
		const exchangeName = ezuuid();

		const exchange = new Exchange({
				autoDelete: true,
				name: exchangeName
			});

		exchange.on('ready', function() {
			const queue = new Queue({
				autoDelete: true,
				exclusive: true,
				exchangeNames: [exchangeName],
				ready: function() {
					beginTicks = Date.now();
					exchange.publish({message: message});
				}
			});

			queue(function(msg, ack) {
				if (msg.message !== message) return done('got a message I shouldnt have');
				ack();
				done();
			});
		});
	});

	it('should be able to publish to the exchange with custom connection', function(done) {
		const message = ezuuid();
		const exchangeName = ezuuid();

		const connection = new Connection();

		connection.connect()
			.then((connection) => {
				const exchange = new Exchange({
						autoDelete: true,
						name: exchangeName
					});

				exchange.on('ready', function() {
					const queue = new Queue({
						autoDelete: true,
						exclusive: true,
						exchangeNames: [exchangeName],
						ready: function() {
							exchange.publish({message: message});
						}
					});

					const ct = 0;

					queue(function(msg, ack) {
						if (msg.message !== message) return done('got a message I shouldnt have');
						ack();
						connection.close().then(() => {
							done();
						});
					});
				});
		})
	});

	it('should fail to publish to the exchange with custom connection after closed', function(done) {
		const message = ezuuid();
		const exchangeName = ezuuid();

		const connection = new Connection();

		connection.connect()
			.then(() => {
				const exchange = new Exchange({
						autoDelete: true,
						name: exchangeName
					});

				exchange.on('ready', function() {
					const queue = new Queue({
						autoDelete: true,
						exclusive: true,
						exchangeNames: [exchangeName],
						ready: function() {
							exchange.publish({message: message});
						}
					});

					queue(function(msg, ack) {
						if (msg.message !== message) return done('got a message I shouldnt have');
						ack();

						connection.close();
						exchange.publish({message: message})
							.catch((err) => {
								console.log(err.name);
								done();
							});
					});
				});
		});
	});
});
