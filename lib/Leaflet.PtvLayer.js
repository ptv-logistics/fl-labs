/*
* L.PtvLayer is used for putting xMap layers with tool tips on the map.
*/
L.PtvLayer = L.NonTiledLayer.extend({
    defaultXMapParams: {
        format: 'PNG',
        token: '',
        markerIsBalloon: false
    },

    initialize: function (url, options) { // (String, Object)
        this._url = url;
        var xMapParams = L.extend({}, this.defaultXMapParams);

        for (var i in options) {
            // all keys that are not NonTiledLayer options go to xMap params
            if (!this.options.hasOwnProperty(i)) {
                xMapParams[i] = options[i];
            }
        }

        this.xMapParams = xMapParams;

        L.NonTiledLayer.prototype.initialize.call(this, options);
    },

    onAdd: function (map) {
        this._poiMarkers = L.featureGroup().addTo(map);

        L.NonTiledLayer.prototype.onAdd.call(this, map);
    },

    onRemove: function (map) {
        map.removeLayer(this._poiMarkers);
        L.NonTiledLayer.prototype.onRemove.call(this, map);
    },

    getImageUrlAsync: function (world1, world2, width, height, key, callback) {
        var xMapParams = this.xMapParams;
        xMapParams.width = width;
        xMapParams.height = height;

        var request = this.getRequest(world1, world2, width, height);

        this.runRequest(this._url + '/xmap/rs/XMap/renderMapBoundingBox', request, this.xMapParams.token,
            function (resp) {
                var prefixMap = {
                    "iVBOR": "data:image/png;base64,",
                    "R0lGO": "data:image/gif;base64,",
                    "/9j/4": "data:image/jpeg;base64,",
                    "Qk02U": "data:image/bmp;base64,"
                };
                var rawImage = resp.image.rawImage;
                callback(key, prefixMap[rawImage.substr(0, 5)] + rawImage, resp);
            }, function (xhr) { callback(L.Util.emptyImageUrl); });
    },

    _formatTooltip: function (description) {
        return description;
    },

    _getId: function (objectInfo) {
        return objectInfo.loId;
    },

    lastOpenPopupId: '',

    _addInteraction: function(resp) {
        var tmp = this.lastOpenPopupId;
        this._poiMarkers.clearLayers();
        this.lastOpenPopupId = tmp;

        if (!resp || !resp.objects || !resp.objects[0])
            return;

        var objects = resp.objects[0].objects;

        _addinteractionForLayer(objects);
    },

    _addinteractionForLayer: function (objects) {
        var that = this;
        var myIcon = L.divIcon({
            className: 'poi-icon',
            iconSize: [16, 16],
            iconAnchor: (this.options.markerIsBalloon)? [8, 16] : null,
            popupAnchor: (this.options.markerIsBalloon) ? [0, -8] : null
        });


        var bounds = this._map.getBounds();
        // re-project to corresponding pixel bounds
        var pix1 = this._map.latLngToContainerPoint(bounds.getNorthWest());
        var pix2 = this._map.latLngToContainerPoint(bounds.getSouthEast());

        // get pixel size
        var width = pix2.x - pix1.x;
        var height = pix2.y - pix1.y;


        for (var i = 0; i < objects.length; i++) {
            var tooltip = this._formatTooltip(objects[i].descr);
            var id = (this._getId) ? this._getId(objects[i]) : null;

            if (objects[i].geometry) {
                var lineString = [];
                for (var j = 0; j < objects[i].geometry.pixelGeometry.points.length; j++) {
                    var p = objects[i].geometry.pixelGeometry.points[j];
                    var g = this._map.containerPointToLatLng([p.x, p.y]);
                    lineString[j] = [g.lat, g.lng];
                }

                // create a transparent polyline from an arrays of LatLng points and bind it to the popup
                var polyline = L.polyline(lineString, {
                    color: 'white',
                    "weight": 20,
                    opacity: 0.0,
                    noClip: true
                }).bindPopup(tooltip).addTo(this._poiMarkers);

                if (this._getId) {
                    if ("p" + id === this.lastOpenPopupId)
                        polyline.openPopup();

                    polyline.tag = id;
                    polyline.on('popupopen', function (e) {
                        that.lastOpenPopupId = "p" + e.target.tag;
                    });
                    polyline.on('popupclose', function (e) {
                        that.lastOpenPopupId = '';
                    });
                }
            }

            // http://stackoverflow.com/questions/17028830/imageoverlay-and-rectangle-z-index-issue                                                                                        
            var svgObj = $('.leaflet-overlay-pane svg');
            svgObj.css('z-index', 9999);

            var containerPoint = [objects[i].pixel.x + 1, height-objects[i].pixel.y];
            //if (this.options.markerIsBalloon) {
            //    containerPoint[1] = containerPoint[1] - 8;
            //}

            var latlng = this._map.containerPointToLatLng(containerPoint);
            var marker = L.marker(latlng, {
                icon: myIcon,
                zIndexOffset: i // will correct overlapping objects?
            }).bindPopup(tooltip).addTo(this._poiMarkers);

            if (this._getId) {
                if ("m" + id === this.lastOpenPopupId)
                    marker.openPopup();

                marker.tag = id;
                marker.on('popupopen', function (e) {
                    that.lastOpenPopupId = "m" + e.target.tag;
                });
                marker.on('popupclose', function (e) {
                    that.lastOpenPopupId = '';
                });
            }
        }
    },

    // runRequest executes a json request on PTV xServer internet, 
    // given the url endpoint, the token and the callbacks to be called
    // upon completion. The error callback is parameterless, the success
    // callback is called with the object returned by the server. 
    runRequest: function (url, request, token, handleSuccess, handleError) {
        $.ajax({
            url: url,
            type: "POST",
            data: JSON.stringify(request),

            headers: {
                "Authorization": "Basic " + btoa("xtok:" + token),
                "Content-Type": "application/json"
            },

            success: function (data, status, xhr) {
                handleSuccess(data);
            },

            error: function (xhr, status, error) {
                handleError(xhr);
            }
        });
    },

    setParams: function (params, noRedraw) {
        L.extend(this.xMapParams, params);

        if (!noRedraw) {
            this.redraw();
        }

        return this;
    },

    getRequest: function (world1, world2, width, height) {
        var request = {
            "mapSection":
                {
                    "leftTop":
                      {
                          "$type": "Point", "point":
                            { "$type": "PlainPoint", "x": world1.lng, "y": world1.lat }
                      }, "rightBottom":
                      {
                          "$type": "Point", "point":
                             { "$type": "PlainPoint", "x": world2.lng, "y": world2.lat }
                      }
                }, "mapParams": { "showScale": false, "useMiles": false },
            "layers": [],
            "imageInfo": { "format": "PNG", "width": width, "height": height },
            "includeImageInResponse": true, "callerContext": {
                "properties": [
                     { "key": "Profile", "value": "ajax-av" },
                     { "key": "CoordFormat", "value": "OG_GEODECIMAL" }]
            }
        };
        return request;
    },
});

L.PtvLayer.NonTiled = L.PtvLayer.extend({
    initialize: function (url, options) { // (String, Object)
        if (options.minZoom === undefined)
            options.minZoom = 0;
        if (options.maxZoom === undefined)
            options.maxZoom = 19;
        
        L.PtvLayer.prototype.initialize.call(this, url, options);
    },

    getRequest: function (world1, world2, width, height) {
        var request = L.PtvLayer.prototype.getRequest.call(this, world1, world2, width, height);
        if (typeof this.options.beforeSend === "function") {
            this.options.beforeSend(request);
        }

        return request;
    },
});


L.PtvLayer.POI = L.PtvLayer.extend({
    initialize: function (url, options) { // (String, Object)
        if (options.minZoom === undefined)
            options.minZoom = 16;
        options.maxZoom = 19;

        L.PtvLayer.prototype.initialize.call(this, url, options);
    },

    getRequest: function (world1, world2, width, height) {
        var request = L.PtvLayer.prototype.getRequest.call(this, world1, world2, width, height);
        request.layers = [{ "$type": "SMOLayer", "name": "default.points-of-interest", "visible": true, "objectInfos": "FULLGEOMETRY" }];

        return request;
    },

    _formatTooltip: function (description) {
        var fields = description.split(":");

        return fields[1];
    }
});

L.PtvLayer.TrafficInformation = L.PtvLayer.extend({
    initialize: function (url, options) { // (String, Object)
        if (options.minZoom === undefined)
            options.minZoom = 10;
        options.maxZoom = 19;

        L.PtvLayer.prototype.initialize.call(this, url, options);
    },

    getRequest: function (world1, world2, width, height) {
        var request = L.PtvLayer.prototype.getRequest.call(this, world1, world2, width, height);
        request.layers = [{ "$type": "SMOLayer", "name": "traffic.ptv-traffic", "visible": true, "objectInfos": "FULLGEOMETRY" }];

        return request;
    },

    _formatTooltip: function (description) {
        var fields = description.split("#");

        return fields[1];
    }
});

L.PtvLayer.TruckAttributes = L.PtvLayer.extend({
    initialize: function (url, options) { // (String, Object)
        if (options.minZoom === undefined)
            options.minZoom = 15;
        options.maxZoom = 19;

        L.PtvLayer.prototype.initialize.call(this, url, options);
    },

    getRequest: function (world1, world2, width, height) {
        var request = L.PtvLayer.prototype.getRequest.call(this, world1, world2, width, height);
        request.layers = [{ "$type": "RoadEditorLayer", "name": "truckattributes", "visible": true, "objectInfos": "FULLGEOMETRY" },
                { "$type": "StaticPoiLayer", "name": "street", "visible": "true", "category": -1, "detailLevel": 0 }];
        request.callerContext.properties[0].value = "truckattributes";

        return request;
    },

    _getId: null // doesn't provide any IDs
});

L.PtvLayer.DataManager = L.PtvLayer.extend({

    // Constructor of the data manager layer.
    // url: String -> 
    // layerId: String -> Id of the data manager layer to display.
    // options: Object -> Options for the layer display.
    initialize: function(url, layerId, options) { // (String, String, Object)
        if (options.minZoom === undefined)
            options.minZoom = 0;
        if (options.maxZoom === undefined)
            options.maxZoom = 19;
        // Saving the layer id for access in the other methods.
        this.layerId = layerId;
        // Initializing the layer.
        L.PtvLayer.prototype.initialize.call(this, url, options);
    },

    // Global variable of this class containing the id of the currently displayed layer.
    layerId: "",

    // Method setting up the xServer request getting the xmap bitmap of the map containing the data manager content.
    // Adds the layer id to the request and returns the request.
    // world1: ??? -> ???
    // world2: ??? -> ???
    // width: ??? -> Width of the requested image.
    // height: ??? -> Height of the requested image.
    // returns: A xMap request containing the layer information.
    getRequest: function (world1, world2, width, height) {
        var request = L.PtvLayer.prototype.getRequest.call(this, world1, world2, width, height);
        request.layers = [{ "$type": "SMOLayer", "name": this.layerId + "." + this.layerId, "visible": true, "objectInfos": "FULLGEOMETRY" }];
        request.callerContext.properties.push({ "key": "ProfileXMLSnippet", "value": "/profiles/datamanager/xmap/" + this.layerId });

        return request;
    },

    // Method setting up the tooltip text which is displayed for a certain object.
    // Parses the description content in a readable manner. The fields are listed in the sequence they appear in the description.
    // The internal id is shown as "Id:".
    _formatTooltip: function(description) {
        var fields = description.split("|");
        var response = '';
        for (var p = 0; p < fields.length; p++) {
            if (p === 0) {
                response = "Id: " + fields[p].split("#")[1];
            } else if (fields[p] !== '') {
                response += "</br>" + fields[p];
            }
        }
        return response;
    }
});

/*
* L.PtvBackground is used for putting special xMap TileLayer on the map.
*/

/**
 Provides the PTV Background TileLayer class.
 @class L.PtvLayer.Background
 @extends L.TileLayer
 @params {XMapClient} client XMapClient object
 @params {Object} options The options object
 @params {String} [options.format] The image format used in tile requests.
 @params {String} [options.beforeSend] Function to be called before sending the request with the request object given as first parameter. The (modified) request object must be returned.
 @params {String} [options.errorTileUrl] The image to display when requests fail.
 @constructor
 **/
L.PtvLayer.Tiled = L.TileLayer.extend({

    /**
     Default options used in this class.
     @property options
     @type Object
     **/
    options: {
        /**
         The image format used in tile requests.
         @property options.format
         @type String
         @default "PNG"
         **/
        format: 'PNG',

        /**
         Function to be called before sending the request with the request object given as first parameter. The (modified) request object must be returned.
         @property options.beforeSend
         @type function
         @default null
         **/
        beforeSend: null,

        /**
         The image to display when requests fail.
         @property options.errorTileUrl
         @type String
         @default "tile-error.png"
         **/
        errorTileUrl: 'tile-error.png',

        /**
         If set to true, the tiles just won't load outside the world width (-180 to 180 longitude) instead of repeating.
         @property options.noWrap
         @type boolean
         @default true
         **/
        noWrap: true,

        /**
         The world bounds for PTV Maps.
         @property options.bounds
         @type L.LatLngBounds
         @default [[85.0, -178.965000], [-66.5, 178.965000]]
         **/
        bounds: new L.LatLngBounds([[85.0, -178.965000], [-66.5, 178.965000]]),

        /**
         Minimum zoom number.
         @property options.minZoom
         @type boolean
         @default true
         **/
        minZoom: 0,

        maxZoom: 19,

        token: ''
    },

    url: '',

    maxConcurrentRequests: 6,

    activeRequestCount: 0,

    requestQueue: [],
	
	currentRequests: [],

    /**
     Constructor
     @method L.PtvLayer.Background
     @param {XMapClient} client optional XMapClient object
     @param {Object} options optional options object
     **/
    initialize: function (url, options) {
        this.url = url;
        L.Util.setOptions(this, options);
    },

    onAdd: function (map) {
        this._map = map;
		
        this.requestQueue = [];
        this.activeRequestCount = 0;
		for(var i = 0; i < this.currentRequests.length; i++)
			 this.currentRequests[i].abort();
		this.currentRequests = [];

        L.TileLayer.prototype.onAdd.call(this, map);
    },

    onRemove: function (map) {
        this.requestQueue = [];
        this.activeRequestCount = 0;
		for(var i = 0; i < this.currentRequests.length; i++)
			 this.currentRequests[i].abort();
		this.currentRequests = [];

        L.TileLayer.prototype.onRemove.call(this, map);
    },

    /**
     Loads a specific tile and shows the result when finished.
     @method _loadTile
     @private
     @param {DOMElement} tile The tile dom img element
     @param {Point} tilePoint The tile point
     **/
    _loadTile: function (tile, tilePoint) {
        tile._layer = this;
        tile.onload = this._tileOnLoad;
        tile.onerror = this._tileOnError;

        this._requestTile(tile, tilePoint);
    },

    _reset: function () {
        this.requestQueue = [];
		for(var i = 0; i < this.currentRequests.length; i++)
			 this.currentRequests[i].abort();
		this.currentRequests = [];

        this.activeRequestCount = 0;
        L.TileLayer.prototype._reset.call(this);
    },

    // runRequest executes a json request on PTV xServer internet,
    // given the url endpoint, the token and the callbacks to be called
    // upon completion. The error callback is parameterless, the success
    // callback is called with the object returned by the server.
    runRequestQ: function (url, request, token, handleSuccess, handleError, force) {
        if (!force && this.activeRequestCount >= this.maxConcurrentRequests) {
            this.requestQueue.push({ url: url, request: request, token: token, handleSuccess: handleSuccess, handleError: handleError });
            return;
        }
        if (!force)
            this.activeRequestCount++;

        var that = this;
        var request = $.ajax({
            url: url,
            type: "POST",
            data: JSON.stringify(request),

            headers: {
                "Authorization": "Basic " + btoa("xtok:" + token),
                "Content-Type": "application/json"
            },

            success: function (data, status, xhr) {
                if (that.requestQueue.length) {
                    var pendingRequest = that.requestQueue.shift();
                    that.runRequestQ(pendingRequest.url, pendingRequest.request, pendingRequest.token, pendingRequest.handleSuccess, pendingRequest.handleError, true);
                }
                else {
                    that.activeRequestCount--;
					that.currentRequests.splice(that.currentRequests.indexOf(request),1);                
                }
                handleSuccess(data);
            },

            error: function (xhr, status, error) {
                if (that.requestQueue.length) {
                    var pendingRequest = that.requestQueue.shift();
                    that.runRequestQ(pendingRequest.url, pendingRequest.request, pendingRequest.token, pendingRequest.handleSuccess, pendingRequest.handleError, true);
                }
                else {
                    that.activeRequestCount--;
					that.currentRequests.splice(that.currentRequests.indexOf(request),1);                
				}

                handleError(xhr);
            }
        });
		
		this.currentRequests.push(request);
    },


    /**
     Requests a specific tile from the server.
     @method _requestTile
     @private
     @param {DOMElement} tile The tile dom img element
     @param {Point} tilePoint The tile point
     **/
    _requestTile: function (tile, tilePoint) {
        var self = this, map = this._map, crs = map.options.crs, tileSize = this.options.tileSize, zoom = this._map.getZoom(), nwPoint = tilePoint.multiplyBy(tileSize), sePoint = nwPoint.add(new L.Point(tileSize, tileSize)),
        nw = crs.project(map.unproject(nwPoint, zoom)), se = crs.project(map.unproject(sePoint, zoom)), bbox = new L.LatLngBounds([se.y, nw.x], [nw.y, se.x]),
        wnw = map.unproject(nwPoint, zoom), wse = map.unproject(sePoint, zoom), wbbox = new L.LatLngBounds([wse.lat, wnw.lng], [wnw.lat, wse.lng]);

        var mapSection = {
            leftTop: {
                "$type": "Point",
                point: {
                    "$type": "PlainPoint",
                    x: wbbox.getNorthWest().lng,
                    y: wbbox.getNorthWest().lat
                }
            },
            rightBottom: {
                "$type": "Point",
                point: {
                    "$type": "PlainPoint",
                    x: wbbox.getSouthEast().lng,
                    y: wbbox.getSouthEast().lat
                }
            }
        };

        var mapParams = {
            showScale: false,
            useMiles: false
        };

        var imageInfo = {
            format: this.options.format,
            width: tileSize,
            height: tileSize
        };

        var layers = [];
        var includeImageInResponse = true;

        var callerContext = {
            properties: [{
                key: "Profile",
                value: "ajax-bg"
            }, {
                key: "CoordFormat",
                value: "OG_GEODECIMAL"
            }]
        };

        if (typeof this.options.beforeSend === "function") {
            var req = this.options.beforeSend({ mapSection: mapSection, mapParams: mapParams, imageInfo: imageInfo, layers: layers, includeImageInResponse: includeImageInResponse, callerContext: callerContext });
            mapSection = req.mapSection;
            mapParams = req.mapParams;
            imageInfo = req.imageInfo;
            layers = req.layers;
            includeImageInResponse = req.includeImageInResponse;
            callerContext = req.callerContext;
        }

        var request = {
            "mapSection": mapSection,
            "mapParams": mapParams,
            "imageInfo": imageInfo,
            "layers": layers,
            "includeImageInResponse": includeImageInResponse,
            "callerContext": callerContext
        };

        this.runRequestQ(
        this.url + '/xmap/rs/XMap/renderMapBoundingBox',
        request,
        this.options.token,

        function (response) {
            var prefixMap = {
                "iVBOR": "data:image/png;base64,",
                "R0lGO": "data:image/gif;base64,",
                "/9j/4": "data:image/jpeg;base64,",
                "Qk02U": "data:image/bmp;base64,"
            };
            var rawImage = response.image.rawImage;

            tile.src = prefixMap[rawImage.substr(0, 5)] + rawImage;
        },

        function (xhr) {
        });
    }
});

L.PtvLayer.tiled = function (url, options) {
    return new L.PtvLayer.Tiled(url, options);
};

L.PtvLayer.FeatureLayerFg = L.PtvLayer.NonTiled.extend({
    initialize: function(url, options) { // (String, Object)
        L.PtvLayer.NonTiled.prototype.initialize.call(this, url, options);

        var that = this;
        this.options.beforeSend = function(request) {
            request.callerContext.properties[0] = { key: "Profile", value: options.profile };

            that._map.eachLayer(function (layer) {
                if (layer.type === 'FeatureLayer' && layer.visible)
                    request.layers.push({ "$type": "FeatureLayer", "name": layer.options.name, "visible": true, "objectInfos": "REFERENCEPOINT" });
            });


            if (typeof that.options.beforeSend2 === "function") {
                that.options.beforeSend2(request);
            };

            //if (map.getZoom() < 10) // don't display feature layer for low zoom levels
            //    return request;

            //       request.mapParams.referenceTime = "2014-01-07T" + ((hour == 24) ? '00' : (hour >= 10) ? hour : '0' + hour) + ":00:00+02:00";
            //request.callerContext.properties.push({
            //    key: "ProfileXMLSnippet",
            //    value: buildMapProfile()
            //});

            return request;

        }
    },
    type: 'FeatureLayerFg',
    _addInteraction: function(resp) {
            var tmp = this.lastOpenPopupId;
            this._poiMarkers.clearLayers();
            this.lastOpenPopupId = tmp;
            var that = this;

            if (!resp || !resp.objects || !resp.objects[0])
                return;

            for(var i = 0; i < resp.objects.length; i++)
                this._addinteractionForLayer(resp.objects[i].objects);
    },
    _getId: function (objectInfo) {
        return objectInfo.descr + objectInfo.ref.point.x + +objectInfo.ref.point.y;
    },
    _formatTooltip: function (description) {
        return replaceAll(description, "|", "<br>");
    }

});

function escapeRegExp(string) {
    return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}

function replaceAll(string, find, replace) {
    return string.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}

L.PtvLayer.FeatureLayerBg = L.PtvLayer.Tiled.extend({
    initialize: function (url, options) { // (String, Object)
        L.PtvLayer.Tiled.prototype.initialize.call(this, url, options);

        var that = this;
        this.options.beforeSend = function (request) {
            request.callerContext.properties[0] = { key: "Profile", value: options.profile };

            that._map.eachLayer(function (layer) {
                if (layer.type === 'FeatureLayer' && layer.visible)
                    request.layers.push({ "$type": "FeatureLayer", "name": layer.options.name, "visible": true});
            });

            if (typeof that.options.beforeSend2 === "function") {
                that.options.beforeSend2(request);
            };


            //if (map.getZoom() < 10) // don't display feature layer for low zoom levels
            //    return request;

            //       request.mapParams.referenceTime = "2014-01-07T" + ((hour == 24) ? '00' : (hour >= 10) ? hour : '0' + hour) + ":00:00+02:00";
            //request.callerContext.properties.push({
            //    key: "ProfileXMLSnippet",
            //    value: buildMapProfile()
            //});

            return request;
        }
    },
    type: 'FeatureLayerBg'
});

L.PtvLayer.FeatureLayer = L.Class.extend({
    includes: L.Mixin.Events,
    options: {
        name: '',
        renderbg: false,
        renderfg: false
    },

    visible: false,

    initialize: function (options) {
        L.setOptions(this, options);
    },

    addTo: function (map) {
        map.addLayer(this);
        return this;
    },

    onAdd: function(map) {
        this._map = map;
        this.visible = true;
        this.redraw();
    },

    onRemove: function(map) {
        this.visible = false;
        this.redraw();
    },

    redraw: function() {
        if (this._map) {
            this._map.eachLayer(function(layer) {
                if (layer.type === 'FeatureLayerBg' || layer.type === 'FeatureLayerFg')
                    layer.redraw();
            });
        }
        return this;
    },
    type: 'FeatureLayer'
});

