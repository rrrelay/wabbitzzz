var Promise  = require('bluebird'),
	_  = require('lodash'),
	Queue = require('../queue'),
	getRequest = require('./request'),
	getResponse = require('./response'),
	ezuuid = require('ezuuid'),
	expect = require('chai').expect;

describe('rpc', function(){
	it('should be able to make get calls', function(done){
		this.timeout(15000);

		var METHOD_NAME = ezuuid();
		var listen = getResponse(METHOD_NAME);
		var key = ezuuid();

		listen(function(err, req, cb){
			cb(null, { isResponse: true, msg:req+ '_' + key});
		});

		listen.ready
			.then(function(){
				return _.chain(_.range(1,9))
					.map(function(d, i){
						return new Promise(function(resolve, reject){
							i += 1;
							getRequest({ methodName: METHOD_NAME, timeout: 2000 })(i, function(err, res){
								if (err) {
									console.error(err);
									return reject(err);
								}

								var expected = i + '_'+key;
								expect(res.msg).to.be.eql(expected);
								resolve();

							});
						});
					})
					.thru(Promise.all)
					.value();
			})
			.then(function(){
				listen.disable();

				return _.chain(_.range(1,9))
					.map(function(d, i){
						return new Promise(function(resolve, reject){
							i+=1;
							console.log('waiting: '+i);

							getRequest(METHOD_NAME)(i, function(err, res){
								if (err) return reject(err);

								console.log('not: ' + i);
								expect(res.msg[0]).to.be.equal(i.toString());
								console.log('success: '+i);

								resolve(true);
							});
						});
					})
					.thru(Promise.all)
					.value()
					.then(function(){
						console.log('we did it!');
						done();
					})
					.catch(function(err){
						console.error(err);
					})
					.finally(function(){
						console.log('getting confused');
					});
			})
			.catch(done);

	});

});

