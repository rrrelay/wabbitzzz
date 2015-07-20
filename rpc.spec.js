var request = require('./request'),
	q  = require('q'),
	_  = require('lodash'),
	Queue = require('./queue'),
	response = require('./response'),
	ezuuid = require('ezuuid'),
	expect = require('chai').expect;

describe('rpc', function(){
	it('should be able to make rpc calls', function(done){
		this.timeout(10000);

		var METHOD_NAME = 'this_is_my_real_exchange';
		var listenOnly = response(METHOD_NAME);
		var listen = response(METHOD_NAME);
		var key = ezuuid();

		listenOnly.disable();

		listenOnly(function(err, req, cb){
			console.log('no one listens to me!: ' + req.msg);
			cb(null, { msg:'just listening...'});
		});

		listen(function(err, req, cb){
			console.log('i gots the good responses');
			cb(null, { isResponse: true, msg:req.msg+ '_' + key});
		});

		var intercept = new Queue({
			exclusive: true,
			autoDelete: true,
			exchangeName: METHOD_NAME,
		});

		intercept(function(msg, ack){
			console.log('|---------intercept------------|');
			console.dir(msg);
			console.log('|---------------------|');
			ack();
		});


		setTimeout(function(){
			_.chain(_.range(6))
				.map(function(){return q.defer();})
				.map(function(d, i){
					request(METHOD_NAME)({msg: i}, function(err, res){
						if (err) return d.reject(err);

						var expected = i + '_'+key;
						expect(res.msg).to.be.equal(expected);
						console.log('i got back: ' + expected);
						d.resolve();
					});
					return d.promise;
				})
				.thru(q.all)
				.value()
				.then(function(){
					done();
				})
				.catch(done);
		}, 2000);
	});

	it('should handle timeouts', function(done){
		this.timeout(4000);

		var METHOD_NAME = 'this_is_my_timeout_Test';
		var listen = response(METHOD_NAME);


		listen(function(err, req, cb){
			console.log('i just don\'t care');
		});

		var intercept = new Queue({
			exclusive: true,
			autoDelete: true,
			durable: false,
			exchangeName: METHOD_NAME,
		});

		intercept(function(msg, ack){
			console.log('|---------intercept------------|');
			console.dir(msg);
			console.log('|---------------------|');
			ack();
		});


		request(METHOD_NAME)({msg: 'goodbye cruel world'}, function(err, res){
			console.error(err);
			console.dir(res);
			if (err) done();
		});
	});
});

