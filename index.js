if (!token)
    alert('you need an xServer internet token to run this sample!');

var hour = moment('2015-08-17T18:30:00+02:00');
var enableSpeedPatterns = true;
var enableRestrictionZones = false;
var enableTrafficIncidents = false;
var enableTruckAttributes = false;
var dynamicTimeOnStaticRoute = true;
var staticTimeOnStaticRoute = true;
var itineraryLanguage = 'EN';
var routingProfile = 'carfast';
var replaySpeed = 100;
var responses = null;
var doLoop = null;
var scenario = 'New York';

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
    buildD3Animations(map, responses, replaySpeed, doLoop);
};

var getLayers = function (profile) {
    //add tile layer
    var bgLayer = new L.PtvLayer.FeatureLayerBg('https://api-eu-test.cloud.ptvgroup.com', {
        token: token,
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
        token: token,
        attribution: attribution,
        profile: profile + '-fg',
        pane: 'labels',
        beforeSend2: function (request) {
            request.mapParams.referenceTime = hour.format();

            // include time domain for incidents
            if (incidents.visible)
                request.callerContext.properties.push({
                    'key': 'ProfileXMLSnippet',
                    'value': '<Profile xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><FeatureLayer majorVersion="1" minorVersion="0"><GlobalSettings enableTimeDependency="true"/><Themes><Theme id="PTV_TrafficIncidents" enabled="true"><FeatureDescription includeTimeDomain="true" /></Theme></Themes></FeatureLayer></Profile>'
                });

        }
    });

    return L.layerGroup([bgLayer, fgLayer]);
};

var incidents = new L.PtvLayer.FeatureLayer({
    name: 'PTV_TrafficIncidents'
}).addTo(map);
var speedPatterns = new L.PtvLayer.FeatureLayer({
    name: 'PTV_SpeedPatterns'
}).addTo(map);
var restrictionZones = new L.PtvLayer.FeatureLayer({
    name: 'PTV_RestrictionZones'
}).addTo(map);
var truckAttributes = new L.PtvLayer.FeatureLayer({
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
    'Incidents': incidents,
    'Truck Attributes': truckAttributes,
    'Restriction Zones': restrictionZones,
    'Speed Patterns': speedPatterns
}, {
    position: 'topleft'
}).addTo(map);

new L.Control.Zoom({
    position: 'bottomleft'
}).addTo(map);

// update ui
$('#range').attr('value', hour.format());
$('#enableSpeedPatterns').attr('checked', enableSpeedPatterns);
$('#enableRestrictionZones').attr('checked', enableRestrictionZones);
$('#enableTrafficIncidents').attr('checked', enableTrafficIncidents);
$('#enableTruckAttributes').attr('checked', enableTruckAttributes);
$('#dynamicTimeOnStaticRoute').attr('checked', dynamicTimeOnStaticRoute);
$('#staticTimeOnStaticRoute').attr('checked', staticTimeOnStaticRoute);
$('#languageSelect').val(itineraryLanguage);
$('#routingProfile').val(routingProfile);
$('#replaySpeed').val(replaySpeed);
$('#doLoop').attr('checked', doLoop);
$('#scenarioSelect').val(scenario);

var sidebar = L.control.sidebar('sidebar').addTo(map);
sidebar.open('home');

fixClickPropagationForIE(sidebar._sidebar);

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
            L.latLng(y = 48.92233, 2.32382),
            L.latLng(y = 48.80220, 2.44454)
        ]);
    else if (scenario === 'Karlsruhe')
        routingControl.setWaypoints([
            L.latLng(49.01502, 8.37922),
            L.latLng(49.01328, 8.42806)
        ]);

    routingControl.route();
};

var updateParams = function (refreshFeatureLayer, setTimeNow) {
    if (setTimeNow)
        $('#range').val(moment().format());

    hour = moment($('#range').val());

    enableSpeedPatterns = $('#enableSpeedPatterns').is(':checked');
    enableRestrictionZones = $('#enableRestrictionZones').is(':checked');
    enableTruckAttributes = $('#enableTruckAttributes').is(':checked');
    enableTrafficIncidents = $('#enableTrafficIncidents').is(':checked');
    dynamicTimeOnStaticRoute = $('#dynamicTimeOnStaticRoute').is(':checked');
    staticTimeOnStaticRoute = $('#staticTimeOnStaticRoute').is(':checked');
    itineraryLanguage = $('#languageSelect option:selected').val();
    routingProfile = $('#routingProfile option:selected').val();

    if (refreshFeatureLayer || setTimeNow) {
        speedPatterns.redraw(map);

    }

    routingControl._router.options.numberOfAlternatives = ((dynamicTimeOnStaticRoute) ? 1 : 0) + ((staticTimeOnStaticRoute) ? 1 : 0);
    routingControl.route();
};

var routingControl = L.Routing.control({
    plan: L.Routing.plan([], {
        createMarker: function (i, wp) {
            return L.marker(wp.latLng, {
                draggable: true,
                icon: L.icon.glyph({
                    glyph: String.fromCharCode(65 + i)
                })
            });
        },
        geocoder: L.Control.Geocoder.ptv({
            serviceUrl: 'https://api-eu-test.cloud.ptvgroup.com/xlocate/rs/XLocate/',
            token: token
        }),
        reverseWaypoints: true
    }),
    altLineOptions: {
        styles: [{
            color: 'black',
            opacity: 0.15,
            weight: 9
        },
        {
            color: 'white',
            opacity: 0.8,
            weight: 6
        },
        {
            color: 'blue',
            opacity: 0.5,
            weight: 2
        }
        ],
    },
    showAlternatives: true,
    router: L.Routing.ptv({
        serviceUrl: 'https://api-eu-test.cloud.ptvgroup.com/xroute/rs/XRoute/',
        token: token,
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
        roundingSensitivity: 1000
    }),
    routeWhileDragging: false,
    routeDragInterval: 1000,    
    collapsible: true
}).addTo(map);

routingControl.on('routingerror', function (e) {
    alert(e.error.responseJSON.errorMessage);
});

updateScenario();