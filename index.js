if (!token)
    alert("you need an xServer internet token to run this sample!");

var hour = 18;
var enableSpeedPatterns = true;
var enableRestrictionZones = true;
var enableTrafficIncidents = true;
var enableTruckAttributes = true;
var itineraryLanguage = 'EN';
var routingProfile = 'truckfast';

var map = L.map('map', {
                zoomControl: false,
                contextmenu: true,
                contextmenuWidth: 200,
                contextmenuItems: [{
                    text: 'Add Waypoint At Start',
                    callback: function(ev) {routingControl.spliceWaypoints(0, 0, ev.latlng);}
                },{
                    text: 'Add Waypoint At End',
                    callback: function(ev) {routingControl.spliceWaypoints(routingControl._plan._waypoints.length, 0, ev.latlng);}
                }]});

var attribution = '<a href="http://www.ptvgroup.com">PTV</a>, TOMTOM';
var cluster = 'eu-n-test';

// create a separate pane for the xmap labels, so they are displayed on top of the route line
// http://bl.ocks.org/rsudekum/5431771
map._panes.labelPane = map._createPane('leaflet-top-pane', map.getPanes().shadowPane);


var getLayers = function(profile) {

//add tile layer
    var bgLayer = new L.PtvLayer.FeatureLayerBg("https://xmap-eu-n-test.cloud.ptvgroup.com", {
        token: token,
        attribution: attribution,
        profile: profile + "-bg",
        beforeSend2: function(request) {
//            request.mapParams.referenceTime = "2014-01-07T" + ((hour == 24) ? '00' : (hour >= 10) ? hour : '0' + hour) + ":00:00+02:00";
        }
    });

//add fg layer
    var fgLayer = new L.PtvLayer.FeatureLayerFg("https://xmap-eu-n-test.cloud.ptvgroup.com", {
        token: token,
        attribution: attribution,
        profile: profile + "-fg",
        pane: map._panes.labelPane,
        beforeSend2: function (request) {
//            request.mapParams.referenceTime = "2014-01-07T" + ((hour == 24) ? '00' : (hour >= 10) ? hour : '0' + hour) + ":00:00+02:00";
        }
    });

    return L.layerGroup([bgLayer, fgLayer]);
}

var incidents = new L.PtvLayer.FeatureLayer({ name: 'PTV_TrafficIncidents' }).addTo(map);
var restrictionZones = new L.PtvLayer.FeatureLayer({ name: 'PTV_RestrictionZones' }).addTo(map);
var truckAttributes = new L.PtvLayer.FeatureLayer({ name: 'PTV_TruckAttributes' }).addTo(map);
var speedPatterns = new L.PtvLayer.FeatureLayer({ name: 'PTV_SpeedPatterns' }).addTo(map);
//var preferredRoutes = new L.PtvLayer.FeatureLayer({ name: 'PTV_PreferredRoutes' }).addTo(map);

var baseLayers = {
    "PTV classic": getLayers("ajax"),
    "PTV sandbox": getLayers("sandbox"),
    "PTV silkysand": getLayers("silkysand"),
    "PTV gravelpit": getLayers("gravelpit").addTo(map)
};

L.control.layers(baseLayers, {
    "Incidents": incidents,
    "Restriction Zones": restrictionZones,
    "Truck Attributes": truckAttributes,
    "Speed Patterns": speedPatterns
}, { position: 'topleft' }).addTo(map);

new L.Control.Zoom({ position: 'bottomleft' }).addTo(map);

$('#range').attr("value", hour);
$('#enableSpeedPatterns').attr("checked", enableSpeedPatterns);
$('#enableRestrictionZones').attr("checked", enableRestrictionZones);
$('#enableTrafficIncidents').attr("checked", enableTrafficIncidents);
$('#enableTruckAttributes').attr("checked", enableTruckAttributes);
$('#languageSelect').val(itineraryLanguage);
$('#routingProfile').val(routingProfile);

var sidebar = L.control.sidebar('sidebar').addTo(map);
sidebar.open("home");

var buildProfile = function () {
    var template = '<Profile xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"><FeatureLayer majorVersion=\"1\" minorVersion=\"0\"><GlobalSettings enableTimeDependency=\"true\"/><Themes><Theme id=\"PTV_RestrictionZones\" enabled=\"{enableRestrictionZones}\" priorityLevel=\"0\"></Theme><Theme id=\"PTV_SpeedPatterns\" enabled=\"{enableSpeedPatterns}\" priorityLevel=\"0\"/><Theme id=\"PTV_TrafficIncidents\" enabled=\"{enableTrafficIncidents}\" priorityLevel=\"0\"/><Theme id=\"PTV_TruckAttributes\" enabled=\"{enableTruckAttributes}\" priorityLevel=\"0\"/><Theme id=\"PTV_TimeZones\" enabled=\"true\" priorityLevel=\"0\"/></Themes></FeatureLayer><Routing majorVersion=\"2\" minorVersion=\"0\"><Course><AdditionalDataRules enabled=\"true\"/></Course></Routing></Profile>'

    template = template.replace("{enableRestrictionZones}", enableRestrictionZones);
    template = template.replace("{enableSpeedPatterns}", enableSpeedPatterns);
    template = template.replace("{enableTruckAttributes}", enableTruckAttributes);
    template = template.replace("{enableTrafficIncidents}", enableTrafficIncidents);

    return template;
}

var updateParams = function (refreshFeatureLayer) {
    hour = $('#range').val();
    enableSpeedPatterns = $('#enableSpeedPatterns').is(':checked');
    enableRestrictionZones = $('#enableRestrictionZones').is(':checked');
    enableTruckAttributes = $('#enableTruckAttributes').is(':checked');
    enableTrafficIncidents = $('#enableTrafficIncidents').is(':checked');
    itineraryLanguage = $('#languageSelect option:selected').val();
    routingProfile = $('#routingProfile option:selected').val();

    if (refreshFeatureLayer) {
        speedPatterns.redraw();
    }

    routingControl.route();
}

var routingControl = L.Routing.control({
    plan: L.Routing.plan([
		L.latLng(48.813194201165274, 9.2841339111328125),
		L.latLng(48.694133170886325, 9.122772216796875)
    ], {
        createMarker: function (i, wp) {
            return L.marker(wp.latLng, {
                draggable: true,
                icon: new L.Icon.Label.Default({ labelText: String.fromCharCode(65 + i) })
            });
        },
        geocoder: L.Control.Geocoder.ptv({ token: token })
    }),
    lineOptions: {
        styles: [
          // Shadow
          { color: 'black', opacity: 0.4, weight: 12 },
          // Outline
          { color: 'blue', opacity: 0.8, weight: 8 },
          // Center
          { color: 'lightblue', opacity: 1, weight: 4 }
        ]
    },
    router: L.Routing.ptv({
        token: token, beforeSend: function (request) {
            //request.options.push({
            //    parameter: "START_TIME",
            //    value: "2014-01-07T" + ((hour == 24) ? '00' : (hour >= 10) ? hour : '0' + hour) + ":00:00+02:00"
            //});

            request.options.push({
                parameter: "ROUTE_LANGUAGE",
                value: itineraryLanguage
            });

            request.callerContext.properties.push({
                key: "ProfileXMLSnippet",
                value: buildProfile()
            });

            request.callerContext.properties.push({ key: "Profile", value: routingProfile });

            return request;
        }
    }),
    routeWhileDragging: false,
    routeDragInterval: 1000
}).addTo(map);

routingControl.on('routingerror', function (e) {
    alert(e.error.responseJSON.errorMessage);
});
