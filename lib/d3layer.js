// a less hackish way to add d3
L.SvgLayer = L.Class.extend({
    includes: L.Mixin.Events,
    options: {
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

    _initPathRoot: function () {
        if (!this._pathRoot) {
            this._pathRoot = L.Path.prototype._createElement('svg');
            this._map.getPanes().overlayPane.appendChild(this._pathRoot);
            if (this.options.pointerEvents) {
                this._pathRoot.setAttribute('pointer-events', this.options.pointerEvents);
            }

            if (this._map.options.zoomAnimation && L.Browser.any3d) {
                L.DomUtil.addClass(this._pathRoot, 'leaflet-zoom-animated');

                this._map.on('zoomanim', this._animatePathZoom, this);
                this._map.on('zoomend', this._endPathZoom, this);
            } else {
                L.DomUtil.addClass(this._pathRoot, 'leaflet-zoom-hide');
            }

            this._map.on('moveend', this._updateSvgViewport, this);
            this._map.on('viewreset', this.reset, this);
            this._updateSvgViewport();
        }
    },

    _uninitPathRoot: function () {
        if (this._pathRoot) {
            //            this._pathRoot = L.Path.prototype._createElement('svg');
            this._map.getPanes().overlayPane.removeChild(this._pathRoot);

            if (this._map.options.zoomAnimation && L.Browser.any3d) {
                this._map.off('zoomanim', this._animatePathZoom, this);
                this._map.off('zoomend', this._endPathZoom, this);
            }

            this._map.off('moveend', this._updateSvgViewport, this);
            this._map.off('viewreset', this.reset, this);
            this.PathRoot = null;
        }
    },

    _animatePathZoom: function (e) {
        var scale = this._map.getZoomScale(e.zoom),
		    offset = this._map._getCenterOffset(e.center)._multiplyBy(-scale)._add(this._pathViewport.min);

        this._pathRoot.style[L.DomUtil.TRANSFORM] =
		        L.DomUtil.getTranslateString(offset) + ' scale(' + scale + ') ';

        this._pathZooming = true;
    },

    _endPathZoom: function () {
        this._pathZooming = false;
    },

    _updatePathViewport: function () {
        var p = L.Path.CLIP_PADDING,
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
		    pane = this._map._panes.overlayPane;

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
