
var resource = module.exports = require('./lib/resource');
var connect = require("connect");
var coop = require("coop");
var promise = require("node-promise");

// Data stores

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



// Server / Client bridge

function serialize (context, x) {
	return typeof x.bake === "function" ? x.bake(context) : x;
}

/**
 * This is the join point between the server and client.
 **/
var ServerPublicResource = resource.ServerPublicResource = resource.DelegateResource.derived({
	options: {
		name: "ServerPublicResource"
	},

	initialize: function (resourceURL) {
		this.super.apply(this, coop.pop(arguments));	
	},
	list: function (context) {
		return this.super.apply(this, arguments).then(function (items) {
			return items.map(serialize.bind(this, context));
		})
	},
	create: function (context) {
		return this.super.apply(this, arguments).then(function (item) {
			return serialize(context, item);
		})
	},
	update: function (context) {
		return this.super.apply(this, arguments).then(function (item) {
			return serialize(context, item);
		})
	}
});

resource.export = function (resources, baseURL) {
	baseURL = baseURL || '/api/';
	var rs = resource.resources = {};
	for(var n in resources) {
		rs[n] = new ServerPublicResource(baseURL + n, resources[n]);
	};
	return resources;
}



// API generation

function handler(fn) {
	return function (req, res) {
		//try {
			fn.apply(this, arguments);
		//} catch (e) {
		//	res.error(e.toString());
		//}
	}
}
function readHandler (r, fn) {
	var _handler = r.createAPIMiddleware()
		.use(handler(function (req,res) {
			var me = this, args = [].slice.call(arguments);
			return promise.when(r.createContextFromRequest(req), function (context) {
				return fn.apply(me, [context,req,res].concat(req.routeArgs));
			});
		}));

	return function (req, res, next) {
		// save routing args
		req.routeArgs = [].slice.call(arguments, 3);
		return _handler(req, res);
	}
}
function modificationHandler (r, fn) {
	var _handler = connect()
		.use(connect.bodyParser())
		.use(r.createAPIMiddleware())
		.use(handler(function (req,res) {
			var me = this, args = [].slice.call(arguments);
			return promise.when(r.createContextFromRequest(req), function (context) {
				return fn.apply(me, [context,req,res].concat(req.routeArgs));
			});
		}));
	
	return function (req, res, next) {
		// save routing args
		req.routeArgs = [].slice.call(arguments, 3);
		return _handler(req, res);
	}
}


resource.DelegateResource.implement({
	createAPI: function () {
		return this.resource.createAPI.apply(this.resource, arguments);
	},
	createChildAPI: function (r) {
		return this.resource.createChildAPI.apply(this.resource, arguments);
	},
	createAPIMiddleware: function () {
		return this.resource.createAPIMiddleware.apply(this.resource, arguments);
	},
	createContextFromRequest: function (req) {
		return this.resource.createContextFromRequest.apply(this.resource, arguments);
	}
});

resource.Resource.implement({
	createContextFromRequest: function (req) {
		return this.createDefaultContextFromRequest(req);
	},
	createDefaultContextFromRequest: function (req) {
		return { isServer: true };
	},
	createChildAPI: function (r) {
		return {
			GET: readHandler(r, function (context,req,res,slug) {
				r.list(context, r.createQueryFromSlug(slug)).then(function (data) {
					res.json(data[0]);
				})
			})
		}
	},
	createAPI: function (r) {
		var me = this;
		return {
			"/:id": r.createChildAPI(r),
			GET: readHandler(r, function (context,req,res) {
				r.list(context, {}).then(function (data) {
					res.json({
						objects: data
					});	
				})
			}),
			POST: modificationHandler(r, function (context, req, res) {
				r.create(context, req.body).then(function (item) {
					res.created().json(item);
				}, function (error) {
					res.error(error.toString());
				});
			})
		}
	},
	createAPIMiddleware: function () {
		return this.createDefaultAPIMiddleware();
	},
	createDefaultAPIMiddleware: function () {
		return connect().use(connect.query());
	}
});

resource.ChildResource.implement({
	createAPI: function (r, modelQueryAccessor) {
		var me = this;
		var api = this.super(r);

		api.POST = function (req, res, next) {
			var args = Array.prototype.slice.call(arguments, 3);
			return (me.createAPIMiddleware()
				.use(connect.bodyParser())
				.use(handler(function (req, res, next) {
					promise.when(me.createContextFromRequest(req), function (context) {
						context.modelQuery = modelQueryAccessor(args);
						r.create(context, req.body).then(function (item) {
							res.created().json(item);
						}, function (error) {
							res.error(error && error.toString());
						});
					});
				}))
			)(req, res, next);
		}
		return api;
	}
});
resource.ModelResource.implement({
	createChildAPI: function (r, parentModelQueryAccessor) {
		var me = this, api = this.super.apply(this, arguments);

		for(var n in this.Model.prototype) {
			var child = this.Model.prototype[n];
			if(resource.ChildResource.isinstance(child)) {
				// found child resource. Create its API, and define a model query
				// accessor
				api["/" + n] = child.createAPI(child, function (args, i, modelQuery) {
					// top of args stack is model slug
					i = i || 0;
					
					modelQuery = connect.utils.merge(
						r.createQueryFromSlug(args[args.length - ++i]), modelQuery
					);

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


resource.createAPI = function () {
	var api = {};
	for(var n in resource.resources) {
		var r = resource.resources[n];
		api[n] = r.createAPI(r);
	};
	console.log("API", api);
	return api;
}

