
var resource = module.exports = require('./lib/resource');
var connect = require("connect");

resource.Resource.implement({
	serverDataStores: {},
	dataStoreFactory: function (type, resource) {
		if(type in this.serverDataStores) {
			return this.serverDataStores[type](resource);
		} else {
			throw "Data store not registered: " + type;
		}
	}
});

resource.Resource.implement({
	createAPI: function () {
		var r = this;
		return {
			GET: function (req,res) {
				r.list({}).then(function (data) {
					res.json({
						objects: data
					});	
				})
			},
			POST: connect(
				connect.bodyParser(),
				function (req, res) {
					res.end("data: " + req.body.test);
					//r.create()
				}
			)
		}
	}
});
