if (!token)
    alert("you need an xServer internet token to run this sample!");

var hour1 = 18;
var hour2 = 6;
var map = L.map('map');

var attribution = '<a href="http://www.ptvgroup.com">PTV</a>, TOMTOM';
var cluster = 'eu-n-test';

// getXMapBaseLayers(cluster, "sandbox", token, attribution).addTo(map);
//initialize layers
var bgLayer = new L.PtvLayer.Tiled("https://xmap-" + cluster + ".cloud.ptvgroup.com", {
    token: token, beforeSend: function (request) {
        var hour = hour1;
        request.callerContext.properties[0] = { key: "Profile", value: "silkysand-bg" };

        if (map.getZoom() < 10) // don't display los for low zoom levels
            return request;

        request.mapParams.referenceTime = "2014-01-07T" + ((hour == 24) ? '00' : (hour >= 10) ? hour : '0' + hour) + ":00:00+02:00";
        request.callerContext.properties.push({
            key: "ProfileXMLSnippet",
            value: "<Profile xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"><FeatureLayer majorVersion=\"1\" minorVersion=\"0\"><GlobalSettings enableTimeDependency=\"true\"/><Themes><Theme id=\"PTV_PreferredRoutes\" enabled=\"false\" priorityLevel=\"0\"><PropertyValue id=\"preferredRouteType\" value=\"1\"/></Theme><Theme id=\"PTV_SpeedPatterns\" enabled=\"true\" priorityLevel=\"0\"/><Theme id=\"PTV_TimeZones\" enabled=\"false\" priorityLevel=\"0\"/></Themes></FeatureLayer><Routing majorVersion=\"2\" minorVersion=\"0\"><Course><AdditionalDataRules enabled=\"true\"/></Course></Routing></Profile>"
        });

        return request;
    }
}).addTo(map);

// add (non-tiled) label layer. Default - insert at overlayPane
var fgLayer = new L.NonTiledLayer.WMS("https://xmap-" + cluster + ".cloud.ptvgroup.com" + '/WMS/WMS?xtok=' + token, {
    opacity: 1.0,
    layers: 'xmap-ajaxfg-silkysand',
    format: 'image/png',
    transparent: true
}).addTo(map);

$('#range').attr("value", hour1);
$('#range2').attr("value", hour2);

var sidebar = L.control.sidebar('sidebar').addTo(map);
sidebar.open("home");

range.onchange = function () {
    hour1 = $('#range').val();
    bgLayer.redraw();
    routingControl.route();
};

range2.onchange = function () {
    hour2 = $('#range2').val();
    routingControl.route();
};


var routingControl = L.Routing.control({
    plan: L.Routing.plan([
		L.latLng(52.616390233045387, 13.348388671875),
		L.latLng(52.540449426243796, 13.59283447265625)
    ], {
        waypointIcon: function (i) {
            return new L.Icon.Label.Default({ labelText: String.fromCharCode(65 + i) });
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
        token: token, beforeSend: function (idx, request) {
            var hour = (idx == 0) ? hour1 : hour2;

            var ro = {
                parameter: "START_TIME",
                value: "2014-01-07T" + ((hour == 24) ? '00' : (hour >= 10) ? hour : '0' + hour) + ":00:00+02:00"
            };
            request.options.push(ro);

            request.callerContext.properties.push({
                key: "ProfileXMLSnippet",
                value: "<Profile xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\"><FeatureLayer majorVersion=\"1\" minorVersion=\"0\"><GlobalSettings enableTimeDependency=\"true\"/><Themes><Theme id=\"PTV_PreferredRoutes\" enabled=\"false\" priorityLevel=\"0\"><PropertyValue id=\"preferredRouteType\" value=\"1\"/></Theme><Theme id=\"PTV_SpeedPatterns\" enabled=\"true\" priorityLevel=\"0\"/><Theme id=\"PTV_TimeZones\" enabled=\"false\" priorityLevel=\"0\"/></Themes></FeatureLayer><Routing majorVersion=\"2\" minorVersion=\"0\"><Course><AdditionalDataRules enabled=\"true\"/></Course></Routing></Profile>"
            });

            request.callerContext.properties.push({ key: "Profile", value: "truckfast" });
            return request;
        }
    }),
    routeWhileDragging: false,
    routeDragInterval: 1000
}).addTo(map);
