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

    _addInteraction: function (resp) {
        // http://stackoverflow.com/questions/17028830/imageoverlay-and-rectangle-z-index-issue                                                                                        
        var svgObj = $('.leaflet-overlay-pane svg');
        svgObj.css('z-index', 9999);

        var tmp = this.lastOpenPopupId;
        this._poiMarkers.clearLayers();
        this.lastOpenPopupId = tmp;
        var that = this;

        for (var l = 0; l < resp.objects.length; l++) {
            var objects = resp.objects[l].objects;

            var myIcon = L.divIcon({
                className: 'poi-icon',
                iconSize: [16, 16],
                iconAnchor: (this.options.markerIsBalloon) ? [8, 16] : null,
                popupAnchor: (this.options.markerIsBalloon) ? [0, -8] : null
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
                        'weight': 20,
                        opacity: 0.0,
                        noClip: true
                    }).bindPopup(tooltip).addTo(this._poiMarkers);


                    if (this._getId) {
                        if ('p' + id === this.lastOpenPopupId)
                            polyline.openPopup();
    
                        polyline.tag = id;
                        polyline.on('popupopen', function (e) {
                            that.lastOpenPopupId = 'p' + e.target.tag;
                        });
                        polyline.on('popupclose', function (e) {
                            that.lastOpenPopupId = '';
                        });
                    }
                }

                var latlng = this.pixToLatLng(resp.world1, resp.world2, resp.width, resp.height, objects[i].pixel);

                var marker = L.marker(latlng, {
                    icon: myIcon,
                    zIndexOffset: i - 1000 // will correct overlapping objects
                }).bindPopup(tooltip).addTo(this._poiMarkers);

                if (this._getId) {
                    if ('m' + id === this.lastOpenPopupId)
                        marker.openPopup();
    
                    marker.tag = id;
                    marker.on('popupopen', function (e) {
                        that.lastOpenPopupId = 'm' + e.target.tag;
                    });
                    marker.on('popupclose', function (e) {
                        that.lastOpenPopupId = '';
                    });
                }
            }
        }
    },

    lastOpenPopupId: '',
    
    _getId: function (objectInfo) {
        return objectInfo.descr + objectInfo.ref.point.x + +objectInfo.ref.point.y;
    },

    _formatTooltip: function (description) {
        return replaceAll(description, '|', '<br>');
    },
    
    pixToLatLng: function (world1, world2, width, height, point) {
        var m1 = this.latLngToMercator(world1);
        var m2 = this.latLngToMercator(world2);
        var o = L.point(m2.x - m1.x, m2.y - m1.y);
        var rx = point.x / width;
        var ry = point.y / height;
        var mr = L.point(m1.x + rx * o.x, m1.y + ry * o.y);

        return this.mercatorToLatLng(mr);
    },

    mercatorToLatLng: function (p) {
        return L.latLng(
            (360 / Math.PI) * (Math.atan(Math.exp(p.y)) - (Math.PI / 4)),
            (180.0 / Math.PI) * p.x);
    },

    latLngToMercator: function (p) {
        return L.point(
            p.lng * Math.PI / 180.0,
            Math.log(Math.tan(Math.PI / 4.0 + p.lat * Math.PI / 360.0)));
    },

    onAdd: function (map) {
        this._poiMarkers = L.featureGroup().addTo(map);

        L.NonTiledLayer.prototype.onAdd.call(this, map);
    },

    onRemove: function (map) {
        map.removeLayer(this._poiMarkers);
        L.NonTiledLayer.prototype.onRemove.call(this, map);
    },

    getImageUrlAsync: function (bounds, width, height, key, callback) {
        var xMapParams = this.xMapParams;
        var world1 = bounds.getNorthWest();
        var world2 = bounds.getSouthEast();
        xMapParams.width = width;
        xMapParams.height = height;

        var request = this.getRequest(world1, world2, width, height);

        this.runRequest(this._url + '/xmap/rs/XMap/renderMapBoundingBox', request, this.xMapParams.token,
            function (resp) {
                var prefixMap = {
                    'iVBOR': 'data:image/png;base64,',
                    'R0lGO': 'data:image/gif;base64,',
                    '/9j/4': 'data:image/jpeg;base64,',
                    'Qk02U': 'data:image/bmp;base64,'
                };
                resp.world1 = world1;
                resp.world2 = world2;
                resp.width = width;
                resp.height = height;
                var rawImage = resp.image.rawImage;
                callback(key, prefixMap[rawImage.substr(0, 5)] + rawImage, resp);
            },
            function (xhr) {
                callback(L.Util.emptyImageUrl);
            });
    },

    // runRequest executes a json request on PTV xServer internet, 
    // given the url endpoint, the token and the callbacks to be called
    // upon completion. The error callback is parameterless, the success
    // callback is called with the object returned by the server. 
    runRequest: function (url, request, token, handleSuccess, handleError) {
        $.ajax({
            url: url,
            type: 'POST',
            data: JSON.stringify(request),

            headers: {
                'Authorization': 'Basic ' + btoa('xtok:' + token),
                'Content-Type': 'application/json'
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
            'mapSection': {
                'leftTop': {
                    '$type': 'Point',
                    'point': {
                        '$type': 'PlainPoint',
                        'x': world1.lng,
                        'y': world1.lat
                    }
                },
                'rightBottom': {
                    '$type': 'Point',
                    'point': {
                        '$type': 'PlainPoint',
                        'x': world2.lng,
                        'y': world2.lat
                    }
                }
            },
            'mapParams': {
                'showScale': false,
                'useMiles': false
            },
            'layers': [],
            'imageInfo': {
                'format': 'PNG',
                'width': width,
                'height': height
            },
            'includeImageInResponse': true,
            'callerContext': {
                'properties': [{
                    'key': 'Profile',
                    'value': 'ajax-av'
                },
                {
                    'key': 'CoordFormat',
                    'value': 'OG_GEODECIMAL'
                }
                ]
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
        if (typeof this.options.beforeSend === 'function') {
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
        request.layers = [{
            '$type': 'SMOLayer',
            'name': 'default.points-of-interest',
            'visible': true,
            'objectInfos': 'FULLGEOMETRY'
        }];

        return request;
    },

    _formatTooltip: function (description) {
        var fields = description.split(':');

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
        request.layers = [{
            '$type': 'SMOLayer',
            'name': 'traffic.ptv-traffic',
            'visible': true,
            'objectInfos': 'FULLGEOMETRY'
        }];

        return request;
    },

    _formatTooltip: function (description) {
        var fields = description.split('#');

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
        request.layers = [{
            '$type': 'RoadEditorLayer',
            'name': 'truckattributes',
            'visible': true,
            'objectInfos': 'FULLGEOMETRY'
        },
        {
            '$type': 'StaticPoiLayer',
            'name': 'street',
            'visible': 'true',
            'category': -1,
            'detailLevel': 0
        }
        ];
        request.callerContext.properties[0].value = 'truckattributes';

        return request;
    }
});

L.PtvLayer.DataManager = L.PtvLayer.extend({

    // Constructor of the data manager layer.
    // url: String -> 
    // layerId: String -> Id of the data manager layer to display.
    // options: Object -> Options for the layer display.
    initialize: function (url, layerId, options) { // (String, String, Object)
        if (options.minZoom === undefined)
            options.minZoom = 0;
        if (options.maxZoom === undefined)
            options.maxZoom = 19;
        // Saving the layer id for access in the other methods.
        this.layerId = layerId;
        // Initializing the layer.
        L.PtvLayer.prototype.initialize.call(this, url, options);
    },

    layerId: '',

    getRequest: function (world1, world2, width, height) {
        var request = L.PtvLayer.prototype.getRequest.call(this, world1, world2, width, height);
        request.layers = [{
            '$type': 'SMOLayer',
            'name': this.layerId + '.' + this.layerId,
            'visible': true,
            'objectInfos': 'FULLGEOMETRY'
        }];
        request.callerContext.properties.push({
            'key': 'ProfileXMLSnippet',
            'value': '/profiles/datamanager/xmap/' + this.layerId
        });

        return request;
    },

    _formatTooltip: function (description) {
        var fields = description.split('|');
        var response = '';
        for (var p = 0; p < fields.length; p++) {
            if (p === 0) {
                response = 'Id: ' + fields[p].split('#')[1];
            } else if (fields[p] !== '') {
                response += '</br>' + fields[p];
            }
        }
        return response;
    }
});

L.PtvLayer.Tiled = L.TileLayer.extend({
    options: {
        format: 'PNG',
        beforeSend: null,
        errorTileUrl: 'tile-error.png',
        noWrap: true,
        bounds: new L.LatLngBounds([
            [85.0, -178.965000],
            [-66.5, 178.965000]
        ]),
        minZoom: 0,
        maxZoom: 19,
        token: ''
    },

    url: '',

    maxConcurrentRequests: 6,

    activeRequestCount: 0,

    requestQueue: [],

    currentRequests: [],

    initialize: function (url, options) {
        this.url = url;
        L.Util.setOptions(this, options);
    },

    onAdd: function (map) {
        L.TileLayer.prototype.onAdd.call(this, map);

        this._map = map;

        this.redraw();
    },

    createTile: function (coords, done) {
        var tile = document.createElement('img');

        L.DomEvent.on(tile, 'load', L.bind(this._tileOnLoad, this, done, tile));
        L.DomEvent.on(tile, 'error', L.bind(this._tileOnError, this, done, tile));

        if (this.options.crossOrigin) {
            tile.crossOrigin = '';
        }

        /*
         Alt tag is set to empty string to keep screen readers from reading URL and for compliance reasons
         http://www.w3.org/TR/WCAG20-TECHS/H67
        */
        tile.alt = '';

        /*
         Set role="presentation" to force screen readers to ignore this
         https://www.w3.org/TR/wai-aria/roles#textalternativecomputation
        */
        tile.setAttribute('role', 'presentation');

        var tileSize = this.options.tileSize,
            tileBounds = this._tileCoordsToBounds(coords),
            wbbox = tileBounds;

        var mapSection = {
            leftTop: {
                '$type': 'Point',
                point: {
                    '$type': 'PlainPoint',
                    x: wbbox.getNorthWest().lng,
                    y: wbbox.getNorthWest().lat
                }
            },
            rightBottom: {
                '$type': 'Point',
                point: {
                    '$type': 'PlainPoint',
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
                key: 'Profile',
                value: 'ajax-bg'
            }, {
                key: 'CoordFormat',
                value: 'OG_GEODECIMAL'
            }]
        };

        if (typeof this.options.beforeSend === 'function') {
            var req = this.options.beforeSend({
                mapSection: mapSection,
                mapParams: mapParams,
                imageInfo: imageInfo,
                layers: layers,
                includeImageInResponse: includeImageInResponse,
                callerContext: callerContext
            });
            mapSection = req.mapSection;
            mapParams = req.mapParams;
            imageInfo = req.imageInfo;
            layers = req.layers;
            includeImageInResponse = req.includeImageInResponse;
            callerContext = req.callerContext;
        }

        var request = {
            'mapSection': mapSection,
            'mapParams': mapParams,
            'imageInfo': imageInfo,
            'layers': layers,
            'includeImageInResponse': includeImageInResponse,
            'callerContext': callerContext
        };

        tile._map = this._map;
        tile._layers = [];

        this.runRequestQ(
            this.url + '/xmap/rs/XMap/renderMapBoundingBox',
            request,
            this.options.token,

            function (response) {
                var prefixMap = {
                    'iVBOR': 'data:image/png;base64,',
                    'R0lGO': 'data:image/gif;base64,',
                    '/9j/4': 'data:image/jpeg;base64,',
                    'Qk02U': 'data:image/bmp;base64,'
                };
                var rawImage = response.image.rawImage;

                tile.src = prefixMap[rawImage.substr(0, 5)] + rawImage;
            },

            function (xhr) {});

        return tile;
    },

    onRemove: function (map) {
        this._resetQueue();

        L.TileLayer.prototype.onRemove.call(this, map);
    },

    _resetQueue: function() {
        this.requestQueue = [];
        this.cnt = this.cnt + 1;
        for (var i = 0; i < this.currentRequests.length; i++)
            this.currentRequests[i].abort();
        this.currentRequests = [];

        this.activeRequestCount = 0;
    },

    redraw: function () {
        this._resetQueue();

        L.TileLayer.prototype.redraw.call(this);
    },

    cnt: 0,

    runRequestQ: function (url, request, token, handleSuccess, handleError, force) {
        if (!force && this.activeRequestCount >= this.maxConcurrentRequests) {
            this.requestQueue.push({
                url: url,
                request: request,
                token: token,
                handleSuccess: handleSuccess,
                handleError: handleError
            });
            return;
        }
        if (!force)
            this.activeRequestCount++;

        var that = this;
        var cnt = this.cnt;

        var ajaxReq = $.ajax({
            url: url,
            type: 'POST',
            data: JSON.stringify(request),

            headers: {
                'Authorization': 'Basic ' + btoa('xtok:' + token),
                'Content-Type': 'application/json'
            },

            success: function (data, status, xhr) {
                that.currentRequests.splice(that.currentRequests.indexOf(request), 1);
                if (that.cnt == cnt && that.requestQueue.length) {
                    var pendingRequest = that.requestQueue.shift();
                    that.runRequestQ(pendingRequest.url, pendingRequest.request, pendingRequest.token, pendingRequest.handleSuccess, pendingRequest.handleError, true);
                } else {
                    that.activeRequestCount--;
                }
                handleSuccess(data);
            },

            error: function (xhr, status, error) {
                that.currentRequests.splice(that.currentRequests.indexOf(request), 1);
                if (that.cnt == cnt && that.requestQueue.length) {
                    var pendingRequest = that.requestQueue.shift();
                    that.runRequestQ(pendingRequest.url, pendingRequest.request, pendingRequest.token, pendingRequest.handleSuccess, pendingRequest.handleError, true);
                } else {
                    that.activeRequestCount--;
                }

                handleError(xhr);
            }
        });

        this.currentRequests.push(ajaxReq);
    }
});

L.PtvLayer.tiled = function (url, options) {
    return new L.PtvLayer.Tiled(url, options);
};

L.PtvLayer.FeatureLayerFg = L.PtvLayer.NonTiled.extend({
    initialize: function (url, options) { // (String, Object)
        L.PtvLayer.NonTiled.prototype.initialize.call(this, url, options);

        var that = this;
        this.options.beforeSend = function (request) {
            request.callerContext.properties[0] = {
                key: 'Profile',
                value: options.profile
            };

            that._map.eachLayer(function (layer) {
                if (layer.type === 'FeatureLayer' && layer.visible)
                    request.layers.push({
                        '$type': 'FeatureLayer',
                        'name': layer.options.name,
                        'visible': true,
                        'objectInfos': 'REFERENCEPOINT'
                    });
            });


            if (typeof that.options.beforeSend2 === 'function') {
                that.options.beforeSend2(request);
            }

            return request;

        };
    },
    type: 'FeatureLayerFg'
});

function escapeRegExp(string) {
    return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1');
}

function replaceAll(string, find, replace) {
    return string.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}

L.PtvLayer.FeatureLayerBg = L.PtvLayer.Tiled.extend({
    initialize: function (url, options) { // (String, Object)
        L.PtvLayer.Tiled.prototype.initialize.call(this, url, options);

        var that = this;
        this.options.beforeSend = function (request) {
            request.callerContext.properties[0] = {
                key: 'Profile',
                value: options.profile
            };

            that._map.eachLayer(function (layer) {
                if (layer.type === 'FeatureLayer' && layer.visible)
                    request.layers.push({
                        '$type': 'FeatureLayer',
                        'name': layer.options.name,
                        'visible': true
                    });
            });

            if (typeof that.options.beforeSend2 === 'function') {
                that.options.beforeSend2(request);
            }

            return request;
        };
    },
    type: 'FeatureLayerBg'
});

L.PtvLayer.FeatureLayer = L.Layer.extend({
    options: {
        name: ''
    },

    visible: false,

    initialize: function (options) {
        L.setOptions(this, options);
    },

    addTo: function (map) {
        map.addLayer(this);
        return this;
    },

    onAdd: function (map) {
        this.visible = true;
        this.redraw(map);
    },

    onRemove: function (map) {
        this.visible = false;
        var that = this;
        setTimeout(function () {
            that.redraw(map);
        }, 0);
    },

    redraw: function (map) {
        map.eachLayer(function (layer) {
            if (layer.type === 'FeatureLayerBg' || layer.type === 'FeatureLayerFg')
                layer.redraw();
        });

        return this;
    },
    type: 'FeatureLayer'
});