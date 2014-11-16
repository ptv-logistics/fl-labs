L.Routing.Ptv = L.Class.extend({
    options: {
        serviceUrl: 'https://xroute-eu-n-test.cloud.ptvgroup.com/xroute/rs/XRoute/',
        token: '',
        supportsHeadings: true,
        beforeSend: null
    },

    initialize: function (options) {
        L.Util.setOptions(this, options);
        this._hints = {
            locations: {}
        };
    },

    response0: null,
    response1: null,

    route: function (waypoints, callback, context, options) {
        var that = this;
        this.response0 = null;
        this.response1 = null;
        var url = this.options.serviceUrl + 'calculateRoute';
        var request0 = this._buildRouteRequest(0, waypoints, options);
        var request1 = this._buildRouteRequest(1, waypoints, options);
        runRequest(url, request0, this.options.token,
            function (response) {
                that.response0 = response;
                if(that.response0 && that.response1)
                    that._routeDone([that.response0, that.response1], waypoints, callback, context);
            },
            function (xhr) {
                console.log(xhr);
        });
        runRequest(url, request1, this.options.token,
            function (response) {
                that.response1 = response;
                if (that.response0 && that.response1)
                    that._routeDone([that.response0, that.response1], waypoints, callback, context);
            },
            function (xhr) {
                console.log(xhr);
        });
    },

    _routeDone: function (responses, inputWaypoints, callback, context) {
        var alts = [];
        for (var i = 0; i < responses.length; i++) {
            var response = responses[i];
            var coordinates = this._buildLinestring(response.polygon.lineString.points);
            alts.push({
                name: "Route " + (i+1),
                coordinates: coordinates,
                instructions: this._bulidInstructions(response.manoeuvres, response.segments, response.stations),
                summary: this._convertSummary(response.info),
                inputWaypoints: inputWaypoints,
                waypoints: inputWaypoints,
                waypointIndices: this._buildWaypointIndices(response.stations)
            });}

        callback.call(context, null, alts);
    },

    _buildWaypointIndices: function (stations) {
        var waypointIndices = [];
        for (var i = 0; i < stations.length; i++) {
            waypointIndices.push(stations[i].polyIdx);
        }
    },

    _drivingDirectionType: function (manoeuvre) {
        if (!this.options.supportsHeadings)
            return '';
        switch (manoeuvre.manoeuvreType) {
            case 'UTURN':
                return 'TurnAround';
            case 'ENTER_RA':
            case 'STAY_RA':
            case 'EXIT_RA':
            case 'EXIT_RA_ENTER':
            case 'EXIT_RA_ENTER_FERRY':
                return 'Roundabout';
            case 'FURTHER':
            case 'KEEP':
            case 'CHANGE':
            case 'ENTER':
            case 'EXIT':
            case 'ENTER_FERRY':
            case 'EXIT_FERRY':
                switch (manoeuvre.turnOrient) {
                    case 'LEFT':
                        return 'SlightLeft';
                    case 'RIGHT':
                        return 'SlightRight';
                    default:
                        return 'Straight';
                }
            case "TURN":
                switch (manoeuvre.turnOrient) {
                    case 'LEFT':
                        return (manoeuvre.turnWeight == 'HALF') ? 'SlightLeft' : (manoeuvre.turnWeight == 'STRONG') ? 'SharpLeft' : 'Left';
                    case 'RIGHT':
                        return (manoeuvre.turnWeight == 'HALF') ? 'SlightRight' : (manoeuvre.turnWeight == 'STRONG') ? 'SharpRight' : 'Right';
                    default:
                        return 'Roundabout';
                }
            default:
                return 'Straight';
        }
    },

    _bulidInstructions: function (manoeuvres, segments, stations) {
        var instructions = [];

        for (var i = 0; i < manoeuvres.length; i++) {
            var manoeuvre = manoeuvres[i];
            instructions.push({
                // direction: "NE",
                distance: segments[manoeuvre.succSegmentIdx].accDist - segments[manoeuvre.predSegmentIdx].accDist,
                exit: undefined,
                index: segments[manoeuvre.succSegmentIdx].firstPolyIdx,
                // road: manoeuvres[i].manoeuvreDesc,
                time: segments[manoeuvre.succSegmentIdx].accTime - segments[manoeuvre.predSegmentIdx].accTime,
                type: this._drivingDirectionType(manoeuvre),
                text: manoeuvre.manoeuvreDesc
            });
        }
        for (var i = stations.length - 1; i >= 0; i--) {
            var station = stations[i];
            instructions.splice(station.manoeuvreIdx, 0, {
                //                direction: "NE",
                distance: (i == stations.length - 1) ? 0 : segments[manoeuvres[station.manoeuvreIdx].routeListSegmentIdx].accDist - station.accDist,
                exit: undefined,
                index: station.polyIdx,
                //                road: manoeuvres[i].manoeuvreDesc,
                distance: (i == stations.length - 1) ? 0 : segments[manoeuvres[station.manoeuvreIdx].routeListSegmentIdx].accTime - station.accTime,
                type: (i == stations.length - 1) ? "DestinationReached" : (i == 0) ? "Straight" : "WaypointReached",
                text: (i == stations.length - 1) ? "Destination" : (i == 0) ? "Start" : "WayPoint " + i
            });
        }


        return instructions;
    },

    _buildLinestring: function (inputpoints) {
        var points = [];

        for (var i = 0; i < inputpoints.length; i++) {
            points.push([inputpoints[i].y, inputpoints[i].x]);
        }

        return points;
    },

    _convertSummary: function (info) {
        return {
            totalDistance: info.distance,
            totalTime: info.time
        };
    },

    _buildRouteRequest: function (idx, waypoints, options) {
        var wpCoords = [],
            computeInstructions,
            computeAlternative;

        for (var i = 0; i < waypoints.length; i++) {
            wpCoords.push({
                "coords": [
                  {
                      "point": {
                          "x": waypoints[i].latLng.lng,
                          "y": waypoints[i].latLng.lat
                      }
                  }
                ],
                "linkType": "NEXT_SEGMENT"
            });
        }

        computeAlternative = computeInstructions =
            !(options && options.geometryOnly);

        var request = {
            "waypoints": wpCoords,
            "options": [],
            "exceptionPaths": [],
            "details": {
                detailLevel: "STANDARD",
                polygon: true,
                manoeuvres: true,
                segments: true
            },
            "callerContext": {
                "properties": [
                  {
                      "key": "CoordFormat",
                      "value": "OG_GEODECIMAL"
                  }]
            }
        };

        if (typeof this.options.beforeSend === "function") {
            request = this.options.beforeSend(idx, request);
        }

        return request;
    }
});

L.Routing.ptv = function (options) {
    return new L.Routing.Ptv(options);
};