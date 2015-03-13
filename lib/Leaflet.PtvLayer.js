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

    _addInteraction: function (resp) {
        var tmp = this.lastOpenPopupId;
        this._poiMarkers.clearLayers();
        this.lastOpenPopupId = tmp;
        var that = this;

        if (!resp || !resp.objects || !resp.objects[0])
            return;

        var objects = resp.objects[0].objects,
        myIcon = L.divIcon({
            className: 'poi-icon',
            iconSize: [16, 16],
            iconAnchor: (this.options.markerIsBalloon)? [8, 16] : null,
            popupAnchor: (this.options.markerIsBalloon)? [0, -8] : null
        });

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

            var containerPoint = [objects[i].pixel.x + 1, objects[i].pixel.y];
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

L.PtvLayer.TruckParking = L.PtvLayer.extend({
    initialize: function (url, options) { // (String, Object)
        //stars css style invoke
        //http://stackoverflow.com/questions/1987524/turn-a-number-into-star-rating-display-using-jquery-and-css	
        var dataUrl = 'data:image/png;base64,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';
        $('<style type="text/css">span.stars, span.stars span {display: inline-block;background: url(' + dataUrl + ') 0 -16px repeat-x; width: 80px; height: 16px; } span.stars span { background-position: 0 0; }</style>').appendTo($('head'));
        if (options.minZoom === undefined)
            options.minZoom = 9;
        options.maxZoom = 19;

        L.PtvLayer.prototype.initialize.call(this, url, options);
    },

    getRequest: function (world1, world2, width, height) {
        var request = L.PtvLayer.prototype.getRequest.call(this, world1, world2, width, height);
        request.layers = [{ "$type": "SMOLayer", "name": "tpe.tpe", "visible": true, "objectInfos": "FULLGEOMETRY" }];

        return request;
    },

    _formatTooltip: function (description) {
        var fields = description.split("$$", 4);

        return '<div><p style="display:inline;padding-right:1em"><b>' +
			fields[1] + '</b></p><span class="stars"><span style="width: ' +
			Math.max(0, (Math.min(5, parseFloat(fields[3]))) * 16) + 'px;"></span></span></div><p>' +
			fields[2].replace(new RegExp(',', 'g'), '<br>') +
			'</p><p>Source: <a href="http://www.truckparkingeurope.com" target="_blank">www.truckparkingeurope.com</a></p>';
    }
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

        token: ''
    },

    url: '',

    maxConcurrentRequests: 4,

    activeRequestCount: 0,

    requestQueue: [],

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
        this.requestQueue.length = 0;
        L.TileLayer.prototype.onAdd.call(this, map);
    },

    onRemove: function (map) {
        this.requestQueue.length = 0;
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
        this.requestQueue.length = 0;
        L.TileLayer.prototype._reset.call(this);
    },

    // runRequest executes a json request on PTV xServer internet,
    // given the url endpoint, the token and the callbacks to be called
    // upon completion. The error callback is parameterless, the success
    // callback is called with the object returned by the server.
    runRequestQ: function (url, request, token, handleSuccess, handleError, force) {
        if (!force && this.activeRequestCount >= 4) {
            this.requestQueue.push({ url: url, request: request, token: token, handleSuccess: handleSuccess, handleError: handleError });
            return;
        }
        if (!force)
            this.activeRequestCount++;

        var that = this;
        $.ajax({
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
                }

                handleError(xhr);
            }
        });
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
            tile.src = self.options.errorTileUrl;
            console.log(xhr);
        });
    }
});

L.PtvLayer.tiled = function (url, options) {
    return new L.PtvLayer.Tiled(url, options);
};



