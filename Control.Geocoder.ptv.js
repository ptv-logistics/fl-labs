if(!L.Control.Geocoder)
    L.Control.Geocoder = {};

L.Control.Geocoder.Ptv = L.Class.extend({
    options: {
        serviceUrl: 'https://xlocate-eu-n-test.cloud.ptvgroup.com/xlocate/rs/XLocate/',
        token: '',
        fixedCountry: ''
    },

    initialize: function (options) {
        L.Util.setOptions(this, options);
    },

    _buildAddressString: function (address) {
        var street = (address.street + ' ' + address.houseNumber).trim();
        var city = (address.postCode + ' ' + address.city).trim();
        city = (address.state + ' ' + city).trim();
        if (!this.options.fixedCountry)
            city = (address.country + ' ' + city).trim();

        if (!street)
            return city;
        else if (!city)
            return street;
        else
            return street + ', ' + city;
    },

    // using standard xLocate geocoding as suggest/autocompletion
    suggest: function(query, cb, context) {
        return this.geocode(query, cb, context);
    },

    geocode: function (query, cb, context) {
        var coord = query.match(new RegExp('^\\s*([-+]?\\d*\\.?\\d*)\\s*,\\s*([-+]?\\d*\\.?\\d*)\\s*$'));
        if(coord) {
            var loc = L.latLng(coord[1],coord[2]);
            
            cb.call(context, [{
                name: query,
                center: loc,
                bbox: L.latLngBounds(loc, loc)
            }]);

            return;
        }

        var that = this;
        var url = this.options.serviceUrl + 'findAddressByText';
        // sample PTV xLocate request
        var request = {
            'address': query,
            'country': this.options.fixedCountry,
            'options': [],
            'sorting': [],
            'additionalFields': [],
            'callerContext': {
                'properties': [{
                    'key': 'CoordFormat',
                    'value': 'OG_GEODECIMAL'
                }, {
                    'key': 'Profile',
                    'value': 'default'
                }]
            }
        };

        runRequest(url, request, this.options.token,

            function (response) {
                var results = [];
                for (var i = response.resultList.length - 1; i >= 0; i--) {
                    var resultAddress = response.resultList[i];
                    var loc = L.latLng(resultAddress.coordinates.point.y, resultAddress.coordinates.point.x);
                    results[i] = {
                        name: that._buildAddressString(resultAddress),
                        center: loc,
                        bbox: L.latLngBounds(loc, loc)
                    };
                }
                cb.call(context, results);
            },

            function (xhr) {
                console.log(xhr);
            });
    },

    reverse: function (location, scale, cb, context) {
        var that = this;
        var url = this.options.serviceUrl + 'findLocation';
        // sample PTV xLocate request
        var request = {
            'location': {
                'coordinate': {
                    'point': {
                        'x': location.lng,
                        'y': location.lat
                    }
                }
            },
            'options': [],
            'sorting': [],
            'additionalFields': [],
            'callerContext': {
                'properties': [{
                    'key': 'CoordFormat',
                    'value': 'OG_GEODECIMAL'
                },
                {
                    'key': 'Profile',
                    'value': 'default'
                }
                ]
            }
        };

        runRequest(url, request, this.options.token,

            function (response) {
                if (response.resultList.length == 0)
                    return;
                var resultAddress = response.resultList[0];
                var loc = L.latLng(resultAddress.coordinates.point.y, resultAddress.coordinates.point.x);
                cb.call(context, [{
                    name: that._buildAddressString(resultAddress),
                    center: loc,
                    bounds: L.latLngBounds(loc, loc)
                }]);
            },

            function (xhr) {
                console.log(xhr);
            });
    }
});

L.Control.Geocoder.ptv = function (options) {
    return new L.Control.Geocoder.Ptv(options);
};