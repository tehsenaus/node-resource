
var coop = require("coop");
var promise = require("node-promise");

var exports = module.exports = {};

var Resource = exports.Resource = new coop.Class([coop.Options], {
	initialize: function(options) {
		this.super.apply(this, arguments);
		
		this.name = this.options.name;
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
		return this.resource.list.apply(this, arguments);
	},
	read: function () {
		return this.resource.read.apply(this, arguments);
	},
	create: function () {
		return this.resource.create.apply(this, arguments);
	},
	update: function () {
		return this.resource.update.apply(this, arguments);
	},
	delete: function () {
		return this.resource.delete.apply(this, arguments);
	}
});
var DataStoreResource = exports.DataStoreResource = DelegateResource.derived({
	dataStoreType: 'document',

	initialize: function () {
		this.super.apply(this, arguments);

		this.dataStore = this.dataStoreFactory(this.dataStoreType, this);
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
	}
});

var ModelResource = exports.ModelResource = new coop.Class({
	Model: function () {
		throw "Model class not defined!";
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
	list: function (query) {
		return this.super(query).then(function (items) {
			return items.map(serialize);
		})
	}
});
var ClientPublicResource = new coop.Class([Resource], {
	initialize: function (resource, resourceURL) {
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
		RESOURCES[n] = new ServerPublicResource(resources[n], baseURL + n);
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


