// a less hackish way to add d3
L.SvgLayer = L.Layer.extend({
    includes: L.Mixin.Events,
    options: {
        attribution: '',
        opacity: 1.0,
        zIndex: undefined
    },

    initialize: function (options) {
        L.setOptions(this, options);
    },

    addTo: function (map) {
        map.addLayer(this);
        return this;
    },

    onAdd: function (map) {
        this._map = map;
        this._initPathRoot();
    },

    onRemove: function (map) {
        this._uninitPathRoot();
    },

    getPathRoot: function () {
        return this._pathRoot;
    },

    getMap: function () {
        return this._map;
    },

    getAttribution: function () {
        return this.options.attribution;
    },

    _initPathRoot: function () {
        if (!this._pathRoot) {
            this._pathRoot = L.SVG.create('svg'); //L.Path.prototype._createElement('svg');
            this.getPane().appendChild(this._pathRoot);

            this._pathRoot.setAttribute('pointer-events', 'none');

            if (this.options.zIndex !== undefined) {
                this._pathRoot.style.zIndex = this.options.zIndex;
            }

            L.DomUtil.setOpacity(this._pathRoot, this.options.opacity);

            if (this._map.options.zoomAnimation && L.Browser.any3d) {
                L.DomUtil.addClass(this._pathRoot, 'leaflet-zoom-animated');
            } else {
                L.DomUtil.addClass(this._pathRoot, 'leaflet-zoom-hide');
            }

            this._updateSvgViewport();
        }
    },

    setOpacity: function (opacity) {
        this.options.opacity = opacity;
        if (this._pathRoot) {
            L.DomUtil.setOpacity(this._pathRoot, this.options.opacity);
        }
        return this;
    },

    setZIndex: function (zIndex) {
        if (zIndex) {
            this.options.zIndex = zIndex;
            if (this._pathRoot) {
                this._pathRoot.style.zIndex = this.options.zIndex;
            }
        }
        return this;
    },

    _uninitPathRoot: function () {
        if (this._pathRoot) {
            //            this._pathRoot = L.Path.prototype._createElement('svg');
            this.getPane().removeChild(this._pathRoot);

            this.PathRoot = null;
        }
    },

    getEvents: function () {
        var events = {
            moveend: this._updateSvgViewport,
            zoom: this.reset
        };

        if (this._map.options.zoomAnimation && L.Browser.any3d) {
            events.zoomanim = this._animatePathZoom;
            events.zoomend = this._endPathZoom;
        }

        return events;
    },

    _animatePathZoom: function (e) {
        this._pathZooming = true;
        this._updateTransform(e.center, e.zoom);
    },

    _updateTransform: function (center, zoom) {
        var scale = this._map.getZoomScale(zoom, this._zoom),
            position = L.DomUtil.getPosition(this._pathRoot),
            viewHalf = this._map.getSize().multiplyBy(0.5 + this.CLIP_PADDING),
            currentCenterPoint = this._map.project(this._center, zoom),
            destCenterPoint = this._map.project(center, zoom),
            centerOffset = destCenterPoint.subtract(currentCenterPoint),

            topLeftOffset = viewHalf.multiplyBy(-scale).add(position).add(viewHalf).subtract(centerOffset);

        L.DomUtil.setTransform(this._pathRoot, topLeftOffset, scale);
    },

    _endPathZoom: function () {
        this._pathZooming = false;
    },

    CLIP_PADDING: (function () {
        var max = L.Browser.mobile ? 1280 : 2000,
            target = (max / Math.max(window.outerWidth, window.outerHeight) - 1) / 2;
        return Math.max(0, Math.min(0.5, target));
    })(),

    _updatePathViewport: function () {

        var p = this.CLIP_PADDING,
            size = this._map.getSize(),
            panePos = L.DomUtil.getPosition(this._map._mapPane),
            min = panePos.multiplyBy(-1)._subtract(size.multiplyBy(p)._round()),
            max = min.add(size.multiplyBy(1 + p * 2)._round());

        this._pathViewport = new L.Bounds(min, max);
    },

    resetSvg: function () {
    },

    reset: function () {
        this.resetSvg(this);
    },

    _updateSvgViewport: function () {
        this._center = this._map.getCenter();

        if (this._pathZooming) {
            // Do not update SVGs while a zoom animation is going on otherwise the animation will break.
            // When the zoom animation ends we will be updated again anyway
            // This fixes the case where you do a momentum move and zoom while the move is still ongoing.
            return;
        }

        this._updatePathViewport();

        var vp = this._pathViewport,
            min = vp.min,
            max = vp.max,
            width = max.x - min.x,
            height = max.y - min.y,
            root = this._pathRoot,
            pane = this.getPane();

        // Hack to make flicker on drag end on mobile webkit less irritating
        if (L.Browser.mobileWebkit) {
            pane.removeChild(root);
        }

        L.DomUtil.setPosition(root, min);
        root.setAttribute('width', width);
        root.setAttribute('height', height);
        root.setAttribute('viewBox', [min.x, min.y, width, height].join(' '));

        if (L.Browser.mobileWebkit) {
            pane.appendChild(root);
        }
    }
});