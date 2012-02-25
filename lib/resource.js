
var coop = require("coop");
var promise = require("node-promise");

var exports = module.exports = {};

var Resource = exports.Resource = new coop.Class([coop.Options], {
	initialize: function(options) {
		this.super.apply(this, arguments);
	},
	
	list: function (callback) {
		callback(null, []);
	}
});
var DelegateResource = exports.DelegateResource = Resource.derived({
	initialize: function (resource) {
		this.super.apply(this, coop.pop(arguments));
		this.resource = resource;
	},

	list: function () {
		return this.resource.list.apply(this.resource, arguments);
	},
	read: function () {
		return this.resource.read.apply(this.resource, arguments);
	},
	create: function (data) {
		return this.resource.create.apply(this.resource, arguments);
	},
	update: function () {
		return this.resource.update.apply(this.resource, arguments);
	},
	delete: function () {
		return this.resource.delete.apply(this.resource, arguments);
	}
});
var DataStoreResource = exports.DataStoreResource = DelegateResource.derived({
	dataStoreType: 'document',

	initialize: function () {
		this.super.apply(this, coop.push(arguments, this.dataStore = this.dataStoreFactory(this.dataStoreType, this)));
	}
});


var ChildResource = exports.ChildResource = DataStoreResource.derived({
	dataStoreType: 'document-child',

	initialize: function (parentModelClass) {
		this.parentModelClass = parentModelClass;
		this.super.apply(this, coop.pop(arguments));
	},
	list: function () {
		return this.resource.list.apply(this.resource, arguments);
	},
	read: function () {
		return this.resource.read.apply(this.resource, arguments);
	},
	create: function (data) {
		return this.resource.create.apply(this.resource, arguments);
	},
	update: function () {
		return this.resource.update.apply(this.resource, arguments);
	},
	delete: function () {
		return this.resource.delete.apply(this.resource, arguments);
	}
});


var Model = exports.Model = new coop.Class({
	initialize: function (data) {
		this.update(data);
	},
	update: function (data) {
		
	},
	bake: function () {
		return {};
	},

	field: function (value) {
		return value;	
	}
});
// Creates a concrete subclass of this model class, bound
// to a resource. Any child resources are initialized.
Model.instantiate = function (resource) {
	var model = this.derived({
		resource: resource
	});

	for(var n in model.prototype) {
		var item = model.prototype[n];
		if(ChildResource.issuperclass(item)) {
			model.prototype[n] = new item(model);
		}
	}

	return model;
}


var ModelResource = exports.ModelResource = new coop.Class({
	Model: function () {
		throw "Model class not defined!";
	},

	initialize: function () {
		this.super.apply(this, arguments);
		this.Model = Model.instantiate.call(this.Model, this);
	},

	create: function (data) {
		for(var n in this.Model.prototype) {
			var child = this.Model.prototype[n];
			if(ChildResource.isinstance(child)) {
				console.log("child", n, child.name, child);
				data[child.name] = [];
			}
		}
		return this.super.apply(this, arguments);
	},

	// Creates an instance of the model from baked data
	ctor: function (data) {
		return new this.Model(data);
	}
});

// API generation


var RESOURCES = {};

function serialize (x) {
	return typeof x.bake === "function" ? x.bake() : x;
}

/**
 * This is the join point between the server and client.
 **/
var ServerPublicResource = new coop.Class([DelegateResource], {
	options: {
		name: "ServerPublicResource"
	},

	initialize: function (resourceURL) {
		this.super.apply(this, coop.pop(arguments));	
	},
	list: function (query) {
		return this.super(query).then(function (items) {
			return items.map(serialize);
		})
	}
});
var ClientPublicResource = new coop.Class([Resource], {
	initialize: function (resourceURL, resource) {
		this.resource = resource;
		this.resourceURL = resourceURL;
	},
	list: function (query) {
		return jQuery.get(this.resourceURL, query).then(function (items) {
			return items.map(function (data) {
				return this.resource.ctor(data);
			}, this);
		});
	},
	read: function (id, query) {
		return jQuery.get(this.resourceURL + "/" + id, query).then(function (data) {
			return this.resource.ctor(data);
		});
	},
	create: function (data, query) {
		// TODO: query
		return jQuery.post(this.resourceURL, data).then(function (data) {
			return this.resource.ctor(data);
		});
	},
	update: function () {
		// TODO
	},
	delete: function () {
		// TODO
	}
});

exports.export = function (resources, baseURL) {
	console.log("export", resources);
	baseURL = baseURL || '/api/';
	RESOURCES = {};
	for(var n in resources) {
		RESOURCES[n] = new ServerPublicResource(baseURL + n, resources[n]);
	};
}
exports.createAPI = function () {
	var api = {};
	for(var n in RESOURCES) {
		api[n] = RESOURCES[n].createAPI();
	};
	console.log("API", api);
	return api;
}


