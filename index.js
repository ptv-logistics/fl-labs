if (!window.token)
    alert('you need an xServer internet token to run this sample!');

//    var hour = moment('2015-08-17T18:30:00+02:00');
var hour = moment();
var enableSpeedPatterns = true;
var enableRestrictionZones = false;
var enableTrafficIncidents = true;
var enableTruckAttributes = false;
var dynamicTimeOnStaticRoute = true;
var staticTimeOnStaticRoute = true;
var itineraryLanguage = 'EN';
var routingProfile = 'truckfast';
var replaySpeed = 100;
var responses = null;
var doLoop = false;
var scenario = 'New York';
var useImperial = false;

var map = L.map('map', {
    minZoom: 6,
    zoomControl: false,
    contextmenu: true,
    contextmenuWidth: 200,
    contextmenuItems: [{
        text: 'Add Waypoint At Start',
        callback: function (ev) {
            if (routingControl._plan._waypoints[0].latLng)
                routingControl.spliceWaypoints(0, 0, ev.latlng);
            else
                routingControl.spliceWaypoints(0, 1, ev.latlng);
        }
    }, {
        text: 'Add Waypoint At End',
        callback: function (ev) {
            if (routingControl._plan._waypoints[routingControl._plan._waypoints.length - 1].latLng)
                routingControl.spliceWaypoints(routingControl._plan._waypoints.length, 0, ev.latlng);
            else
                routingControl.spliceWaypoints(routingControl._plan._waypoints.length - 1, 1, ev.latlng);
        }
    }]
});


var attribution = '<a href="http://www.ptvgroup.com">PTV</a>, TOMTOM';

// create a separate pane for the xmap labels, so they are displayed on top of the route line
map.createPane('labels');
map.getPane('labels').style.zIndex = 500;
map.getPane('labels').style.pointerEvents = 'none';

map.setView([0, 0], 0);

var replay = function () {
    replaySpeed = $('#replaySpeed option:selected').val();
    doLoop = $('#doLoop').is(':checked');
    window.buildD3Animations(map, responses, replaySpeed, doLoop);
};

var getLayers = function (profile) {
    //add tile layer
    var bgLayer = new L.PtvLayer.FeatureLayerBg('https://api-eu-test.cloud.ptvgroup.com', {
        token: window.token,
        attribution: attribution,
        profile: profile + '-bg',
        beforeSend2: function (request) {
            request.mapParams.referenceTime = hour.format();
            request.callerContext.properties.push({
                'key': 'ProfileXMLSnippet',
                'value': '<Profile xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><FeatureLayer majorVersion="1" minorVersion="0"><GlobalSettings enableTimeDependency="true"/></FeatureLayer></Profile>'
            });
        }
    });

    //add fg layer
    var fgLayer = new L.PtvLayer.FeatureLayerFg('https://api-eu-test.cloud.ptvgroup.com', {
        token: window.token,
        attribution: attribution,
        profile: profile + '-fg',
        pane: 'labels',
        imperial: useImperial,
        beforeSend2: function (request) {
            request.mapParams.referenceTime = hour.format();
            // include time domain for incidents
            if (incidentsLayer.visible)
                request.callerContext.properties.push({
                    'key': 'ProfileXMLSnippet',
                    'value': '<Profile xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><FeatureLayer majorVersion="1" minorVersion="0"><GlobalSettings enableTimeDependency="true"/><Themes><Theme id="PTV_TrafficIncidents" enabled="true"><FeatureDescription includeTimeDomain="true" /></Theme></Themes></FeatureLayer></Profile>'
                });
        }
    });

    return L.layerGroup([bgLayer, fgLayer]);
};

var incidentsLayer = new L.PtvLayer.FeatureLayer({
    name: 'PTV_TrafficIncidents'
}).addTo(map);
var speedPatternsLayer = new L.PtvLayer.FeatureLayer({
    name: 'PTV_SpeedPatterns'
}).addTo(map);
var restrictionZonesLayer = new L.PtvLayer.FeatureLayer({
    name: 'PTV_RestrictionZones'
}); // .addTo(map);
var truckAttributesLayer = new L.PtvLayer.FeatureLayer({
    name: 'PTV_TruckAttributes'
}); //.addTo(map);
//var preferredRoutes = new L.PtvLayer.FeatureLayer({ name: 'PTV_PreferredRoutes' }).addTo(map);

var baseLayers = {
    'PTV classic': getLayers('ajax'),
    'PTV sandbox': getLayers('sandbox'),
    'PTV silkysand': getLayers('silkysand'),
    'PTV gravelpit': getLayers('gravelpit').addTo(map)
};

L.control.layers(baseLayers, {
    'Incidents': incidentsLayer,
    'Speed Patterns': speedPatternsLayer,
    'Truck Attributes': truckAttributesLayer,
    'Restriction Zones': restrictionZonesLayer
}, {
    position: 'topleft'
}).addTo(map);

new L.Control.Zoom({
    position: 'bottomleft'
}).addTo(map);

var indSelf = false;

var _onLayerAdd = function (e) {
    //	return; // only one-way sync

    if (indSelf) // event was triggered by panel
        return;

    if (e.layer === truckAttributesLayer) {
        enableTruckAttributes = true;
        $('#enableTruckAttributes').prop('checked', enableTruckAttributes);
    } else if (e.layer === incidentsLayer) {
        enableTrafficIncidents = true;
        $('#enableTrafficIncidents').prop('checked', enableTrafficIncidents);
    } else if (e.layer === speedPatternsLayer) {
        enableSpeedPatterns = true;
        $('#enableSpeedPatterns').prop('checked', enableSpeedPatterns);
    } else if (e.layer === restrictionZonesLayer) {
        enableRestrictionZones = true;
        $('#enableRestrictionZones').prop('checked', enableRestrictionZones);
    } else return;

    if (routingControl)
        routingControl.route();
};

var _onLayerRemove = function (e) {
    //	return; // only one-way sync

    if (indSelf) // event was triggered by panel
        return;

    if (e.layer === truckAttributesLayer) {
        enableTruckAttributes = false;
        $('#enableTruckAttributes').prop('checked', enableTruckAttributes);
    } else if (e.layer === incidentsLayer) {
        enableTrafficIncidents = false;
        $('#enableTrafficIncidents').prop('checked', enableTrafficIncidents);
    } else if (e.layer === speedPatternsLayer) {
        enableSpeedPatterns = false;
        $('#enableSpeedPatterns').prop('checked', enableSpeedPatterns);
    } else if (e.layer === restrictionZonesLayer) {
        enableRestrictionZones = false;
        $('#enableRestrictionZones').prop('checked', enableRestrictionZones);
    } else return;

    if (routingControl)
        routingControl.route();
};

map.on('layeradd', _onLayerAdd, this);
map.on('layerremove', _onLayerRemove, this);

// update ui
$('#range').attr('value', hour.format());
$('#enableSpeedPatterns').attr('checked', enableSpeedPatterns);
$('#enableRestrictionZones').attr('checked', enableRestrictionZones);
$('#enableTrafficIncidents').attr('checked', enableTrafficIncidents);
$('#enableTruckAttributes').attr('checked', enableTruckAttributes);
$('#dynamicTimeOnStaticRoute').attr('checked', dynamicTimeOnStaticRoute);
$('#useImperial').attr('checked', useImperial);
$('#staticTimeOnStaticRoute').attr('checked', staticTimeOnStaticRoute);
$('#languageSelect').val(itineraryLanguage);
$('#routingProfile').val(routingProfile);
$('#replaySpeed').val(replaySpeed);
$('#doLoop').attr('checked', doLoop);
$('#scenarioSelect').val(scenario);

var sidebar = L.control.sidebar('sidebar').addTo(map);
sidebar.open('home');

var buildProfile = function () {
    var template = '<Profile xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"><FeatureLayer majorVersion=\"1\" minorVersion=\"0\"><GlobalSettings enableTimeDependency=\"true\"/><Themes><Theme id=\"PTV_RestrictionZones\" enabled=\"{enableRestrictionZones}\" priorityLevel=\"0\"></Theme><Theme id=\"PTV_SpeedPatterns\" enabled=\"{enableSpeedPatterns}\" priorityLevel=\"0\"/><Theme id=\"PTV_TrafficIncidents\" enabled=\"{enableTrafficIncidents}\" priorityLevel=\"0\"/><Theme id=\"PTV_TruckAttributes\" enabled=\"{enableTruckAttributes}\" priorityLevel=\"0\"/><Theme id=\"PTV_TimeZones\" enabled=\"true\" priorityLevel=\"0\"/></Themes></FeatureLayer><Routing majorVersion=\"2\" minorVersion=\"0\"><Course><AdditionalDataRules enabled=\"true\"/></Course></Routing></Profile>';

    template = template.replace('{enableRestrictionZones}', enableRestrictionZones);
    template = template.replace('{enableSpeedPatterns}', enableSpeedPatterns);
    template = template.replace('{enableTruckAttributes}', enableTruckAttributes);
    template = template.replace('{enableTrafficIncidents}', enableTrafficIncidents);

    return template;
};

var setNow = function () {
    $('#range').val(moment().format());
    updateParams(true);
};

var updateScenario = function () {
    scenario = $('#scenarioSelect option:selected').val();

    if (scenario === 'New York')
        routingControl.setWaypoints([
            L.latLng(40.78263, -74.03331),
            L.latLng(40.71307, -74.00724)
        ]);
    else if (scenario === 'Paris')
        routingControl.setWaypoints([
            L.latLng(48.92233, 2.32382),
            L.latLng(48.80220, 2.44454)
        ]);
    else if (scenario === 'Karlsruhe')
        routingControl.setWaypoints([
            L.latLng(49.01502, 8.37922),
            L.latLng(49.01328, 8.42806)
        ]);

    routingControl.route();
};

var updateParams = function (refreshFeatureLayer) {
    hour = moment($('#range').val());
    enableSpeedPatterns = $('#enableSpeedPatterns').is(':checked');
    enableRestrictionZones = $('#enableRestrictionZones').is(':checked');
    enableTruckAttributes = $('#enableTruckAttributes').is(':checked');
    enableTrafficIncidents = $('#enableTrafficIncidents').is(':checked');
    dynamicTimeOnStaticRoute = $('#dynamicTimeOnStaticRoute').is(':checked');
    staticTimeOnStaticRoute = $('#staticTimeOnStaticRoute').is(':checked');
    itineraryLanguage = $('#languageSelect option:selected').val();
    useImperial = $('#useImperial').is(':checked');
    routingProfile = $('#routingProfile option:selected').val();

    // sync panel->layers
    indSelf = true;

    if (enableTruckAttributes)
        map.addLayer(truckAttributesLayer);
    else
        map.removeLayer(truckAttributesLayer);

    if (enableTrafficIncidents)
        map.addLayer(incidentsLayer);
    else
        map.removeLayer(incidentsLayer);

    if (enableSpeedPatterns)
        map.addLayer(speedPatternsLayer);
    else
        map.removeLayer(speedPatternsLayer);

    if (enableRestrictionZones)
        map.addLayer(restrictionZonesLayer);
    else
        map.removeLayer(restrictionZonesLayer);

    indSelf = false;

    if (refreshFeatureLayer) {
        map.eachLayer(function(layer){
            if(layer.options.profile)
            {
                layer.options.imperial = useImperial;
                layer.redraw(map);
            }
        });
    }

    routingControl._router.options.numberOfAlternatives = ((dynamicTimeOnStaticRoute) ? 1 : 0) + ((staticTimeOnStaticRoute) ? 1 : 0);
    routingControl._formatter.options.units = useImperial? 'imperial' : 'metric';
    routingControl.route();

};

var routingControl = L.Routing.control({
    plan: L.Routing.plan([], {
        createMarker: function (i, wp) {
            var m = L.marker(wp.latLng, {
                draggable: true,
                icon: L.icon.glyph({
                    glyph: String.fromCharCode(65 + i)
                })
            });
            m.id = 'wpmarker' + i;
            return m;
        },
        geocoder: L.Control.Geocoder.ptv({
            serviceUrl: 'https://api-eu-test.cloud.ptvgroup.com/xlocate/rs/XLocate/',
            token: window.token
        }),
        reverseWaypoints: true
    }),
    altLineOptions: {
        styles: [{
            color: 'black',
            opacity: 0.15,
            weight: 9
        }, {
            color: 'white',
            opacity: 0.8,
            weight: 6
        }, {
            color: 'blue',
            opacity: 0.5,
            weight: 2
        }],
    },
    showAlternatives: true,
    router: L.Routing.ptv({
        serviceUrl: 'https://api-eu-test.cloud.ptvgroup.com/xroute/rs/XRoute/',
        token: window.token,
        numberOfAlternatives: ((dynamicTimeOnStaticRoute) ? 1 : 0) + ((staticTimeOnStaticRoute) ? 1 : 0),
        beforeSend: function (request, currentResponses, idx) {
            if (hour)
                request.options.push({
                    parameter: 'START_TIME',
                    value: hour.format() // moment.utc().add(hour, 'hours').format()
                });

            if (idx == 1 && dynamicTimeOnStaticRoute) // alt is static route with dynamic time
                request.options.push({
                    parameter: 'DYNAMIC_TIME_ON_STATICROUTE',
                    value: true
                });

            request.options.push({
                parameter: 'ROUTE_LANGUAGE',
                value: itineraryLanguage
            });

            if (idx == 0 || (idx == 1 && dynamicTimeOnStaticRoute))
                request.callerContext.properties.push({
                    key: 'ProfileXMLSnippet',
                    value: buildProfile()
                });

            request.callerContext.properties.push({
                key: 'Profile',
                value: routingProfile
            });

            return request;
        },
        routesCalculated: function (alts, r) {
            responses = r;
            alts[0].name = '<i style="background:yellow"></i>Dynamic Route';
            if (!dynamicTimeOnStaticRoute) {
                if (staticTimeOnStaticRoute)
                    alts[1].name = '<i style="background:black"></i>Static Route';

                responses[2] = responses[1];
                responses[1] = null;
            } else {
                alts[1].name = '<i style="background:#a00"></i>Static Route /w dynamic Time';
                if (staticTimeOnStaticRoute)
                    alts[2].name = '<i style="background:black"></i>Static Route';
            }
            replay();
        }
    }),
    formatter: new L.Routing.Formatter({
//        roundingSensitivity: 1,
        units: useImperial? 'imperial' : 'metric'
    }),
    routeWhileDragging: false,
    routeDragInterval:  1000,
    collapsible: true
}).addTo(map);

routingControl.on('routingerror', function (e) {
    responses = [];
    replay();
    alert(e.error.responseJSON.errorMessage);
});

updateScenario();

var merctoLatLng = function (x ,y) {
    return L.latLng(
        (360 / Math.PI) * (Math.atan(Math.exp(y / 6371000.0)) - (Math.PI / 4)),
        (180.0 / Math.PI) * (x / 6371000.0));    
};

var parseRequest = function () {
    var x = document.getElementById('RequestInput').value;
    var r = JSON.parse(x);
    var wp = r.waypoints
        .map(function (d) {
            return L.latLng(d.coords[0].point.y, d.coords[0].point.x);
//            return merctoLatLng(d.coords[0].point.x, d.coords[0].point.y);
        });

    routingControl.setWaypoints(wp);
};
