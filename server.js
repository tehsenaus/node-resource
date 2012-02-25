
var resource = module.exports = require('./lib/resource');
var connect = require("connect");

resource.Resource.serverDataStores = {};
resource.Resource.implement({
	dataStoreFactory: function (type, res, dataStoreName) {
		dataStoreName = dataStoreName || res.name;
		if(!dataStoreName) {
			throw "Data store has no name: " + type;
		}

		if(type in resource.Resource.serverDataStores) {
			console.log("Creating data store", dataStoreName, type);
			return resource.Resource.serverDataStores[type](res, dataStoreName);
		} else {
			throw "Data store not registered: " + type;
		}
	}
});

resource.DelegateResource.implement({
	createAPI: function () {
		return this.resource.createAPI.apply(this.resource, arguments);
	}
});


resource.DataStoreResource.implement({
	createQueryFromSlug: function (slug) {
		return {
			test: slug
		};
	},
	createChildAPI: function (queryStack) {
		var r = this;
		return {
			GET: function (req,res,slug) {
				r.list(this.createQueryFromSlug(slug)).then(function (data) {
					res.json({
						objects: data
					});
				})
			}
		}
	},
	createAPI: function (queryStack) {
		var r = this;
		return {
			"/:id": this.createChildAPI(),
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
					//res.end("data: " + req.body.test);
					r.create(req.body).then(function (item) {
						res.json(item);
					}, function (error) {
						res.error(error);
					});
				}
			)
		}
	}
});

resource.ChildResource.implement({
	createAPI: function (modelQueryAccessor) {
		var r = this;
		var api = this.super();
		api.POST = function (req, res, next) {
			var args = Array.prototype.slice.call(arguments, 3);
			return (connect(
				connect.bodyParser(),
				function (req, res, next) {
					var modelQuery = modelQueryAccessor(args);
					//res.end("data: " + req.body.test);
					r.create(modelQuery, req.body).then(function (item) {
						res.json(item);
					}, function (error) {
						res.error(error && error.toString());
					});
				}
			))(req, res, next);
		}
		return api;
	}
});
resource.ModelResource.implement({
	createChildAPI: function (parentModelQueryAccessor) {
		var me = this, api = this.super();

		console.log("createChildAPI", this.Model);

		for(var n in this.Model.prototype) {
			var child = this.Model.prototype[n];
			if(resource.ChildResource.isinstance(child)) {
				// found child resource. Create its API, and define a model query
				// accessor
				api["/" + n] = child.createAPI(function (args, i, modelQuery) {
					// top of args stack is model slug
					i = i || 0;
					
					modelQuery = connect.utils.merge(
						me.createQueryFromSlug(args[args.length - ++i]), modelQuery
					);
					
					console.log("create", args, modelQuery);

					// parent model query accessor 
					if(parentModelQueryAccessor) {
						var parentModelQuery = {};
						parentModelQuery[child.name] = modelQuery;
						return parentModelQueryAccessor(args, i, parentModelQuery);
					} else {
						return modelQuery;
					}
				});
			}
		}

		return api;
	}
});
