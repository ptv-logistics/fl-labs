if (!token)
    alert("you need an xServer internet token to run this sample!");

var hour = 18;
var enableSpeedPatterns = true;
var enableRestrictionZones = true;
var itineraryLanguage = 'EN';
var routingProfile = 'truckfast';

var map = L.map('map', { 
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

//add tile layer
var bgLayer = new L.PtvLayer.Tiled("https://xmap-" + cluster + ".cloud.ptvgroup.com", {
    token: token, attribution: attribution, beforeSend: function (request) {
        request.callerContext.properties[0] = { key: "Profile", value: "silkysand-bg" };

        if (map.getZoom() < 10) // don't display feature layer for low zoom levels
            return request;

        request.mapParams.referenceTime = "2014-01-07T" + ((hour == 24) ? '00' : (hour >= 10) ? hour : '0' + hour) + ":00:00+02:00";
        request.callerContext.properties.push({
            key: "ProfileXMLSnippet",
            value: buildProfile()
        });

        return request;
    }
}).addTo(map);

// create a separate pane for the xmap labels, so they are displayed on top of the route line
// http://bl.ocks.org/rsudekum/5431771
map._panes.labelPane = map._createPane('leaflet-top-pane', map.getPanes().shadowPane);

// add (non-tiled) label layer
var fgLayer = new L.NonTiledLayer.WMS("https://xmap-" + cluster + ".cloud.ptvgroup.com" + '/WMS/WMS?xtok=' + token, {
    opacity: 1.0,
    layers: 'xmap-silkysand-fg',
    format: 'image/png',
    transparent: true,
    attribution: attribution,
	pane: map._panes.labelPane
}).addTo(map);

$('#range').attr("value", hour);
$('#enableSpeedPatterns').attr("checked", enableSpeedPatterns);
$('#enableRestrictionZones').attr("checked", enableRestrictionZones);
$('#languageSelect').val(itineraryLanguage);
$('#routingProfile').val(routingProfile);

var sidebar = L.control.sidebar('sidebar').addTo(map);
sidebar.open("home");

var buildProfile = function () {
    var template = '<Profile xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"><FeatureLayer majorVersion=\"1\" minorVersion=\"0\"><GlobalSettings enableTimeDependency=\"true\"/><Themes><Theme id=\"PTV_RestrictionZones\" enabled=\"{enableRestrictionZones}\" priorityLevel=\"0\"></Theme><Theme id=\"PTV_SpeedPatterns\" enabled=\"{enableSpeedPatterns}\" priorityLevel=\"0\"/></Themes></FeatureLayer><Routing majorVersion=\"2\" minorVersion=\"0\"><Course><AdditionalDataRules enabled=\"true\"/></Course></Routing></Profile>'

    template = template.replace("{enableRestrictionZones}", enableRestrictionZones);
    template = template.replace("{enableSpeedPatterns}", enableSpeedPatterns);

    return template;
}

var updateParams = function (refreshFeatureLayer) {
    hour = $('#range').val();
    enableSpeedPatterns = $('#enableSpeedPatterns').is(':checked');
    enableRestrictionZones = $('#enableRestrictionZones').is(':checked');
    itineraryLanguage = $('#languageSelect option:selected').val();
    routingProfile = $('#routingProfile option:selected').val();

    if (refreshFeatureLayer) {
        bgLayer.redraw();
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
            request.options.push({
                parameter: "START_TIME",
                value: "2014-01-07T" + ((hour == 24) ? '00' : (hour >= 10) ? hour : '0' + hour) + ":00:00+02:00"
            });

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

	routingControl.on('routingerror', function(e){ 
		alert(e.error.responseJSON.errorMessage);
	});
