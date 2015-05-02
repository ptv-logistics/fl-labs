L.Routing.Ptv = L.Class.extend({
    options: {
        serviceUrl: 'https://xroute-eu-n-test.cloud.ptvgroup.com/xroute/rs/XRoute/',
        token: '',
        supportsHeadings: true,
        numberOfAlternatives: 0,
        beforeSend: null
    },

    initialize: function (options) {
        L.Util.setOptions(this, options);
        this._hints = {
            locations: {}
        };
    },

    route: function (waypoints, callback, context, options, currentResponses) {
        var that = this;
        var url = this.options.serviceUrl + 'calculateRoute';

        // build current responses on initial call
        var responses;
        if (!currentResponses) {
            responses = [];
        } else {
            responses = currentResponses;
        }

        var request = this._buildRouteRequest(waypoints, options, responses);

        runRequest(url, request, this.options.token,

        function (response) {
            responses.push(response);

            if (responses.length > that.options.numberOfAlternatives) {
                that._routeDone(responses, waypoints, callback, context);
            } else {
                that.route(waypoints, callback, context, options, responses)
            }
        },

        function (xhr) {
            console.log(xhr);
            callback.call(context, xhr, null);
        });
    },

    _routeDone: function (responses, inputWaypoints, callback, context) {
        alts = [];
        for (var i = 0; i < responses.length; i++) {
            var response = responses[i];

            var coordinates = this._buildLinestring(response.polygon.lineString.points);
            alts.push({
                name: "Route " + (i + 1),
                coordinates: coordinates,
                instructions: this._bulidInstructions(response.manoeuvres, response.segments, response.stations),
                summary: this._convertSummary(response.info),
                inputWaypoints: inputWaypoints,
                waypoints: inputWaypoints,
                waypointIndices: this._buildWaypointIndices(response.stations)
            });
        }   

        callback.call(context, null, alts);

        if (typeof this.options.routesCalculated === "function") {
            request = this.options.routesCalculated(alts);
        }
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

    _bulidInstructions: function(manoeuvres, segments, stations) {
        var instructions = [];

        for (var i = 0; i < manoeuvres.length; i++) {
            var manoeuvre = manoeuvres[i];
            instructions.push({
                distance: segments[manoeuvre.succSegmentIdx].accDist,
                exit: undefined,
                index: segments[manoeuvre.succSegmentIdx].firstPolyIdx,
                time: segments[manoeuvre.succSegmentIdx].accTime,
                type: this._drivingDirectionType(manoeuvre),
                text: manoeuvre.manoeuvreDesc
            });
        }
        for (var i = stations.length - 1; i >= 0; i--) {
            var station = stations[i];
            instructions.splice(station.manoeuvreIdx, 0, {
                distance: station.accDist,
                exit: undefined,
                index: station.polyIdx,
                time: station.accTime,
                type: (i == stations.length - 1) ? "DestinationReached" : (i == 0) ? "Straight" : "WaypointReached",
                text: (i == stations.length - 1) ? "Destination" : (i == 0) ? "Start" : "WayPoint " + i
            });
        }

        for (var i = instructions.length-1; i > 0 ; i--) {
            instructions[i].distance = instructions[i].distance - instructions[i-1].distance;
            instructions[i].time = instructions[i].time - instructions[i-1].time;
        }

        for (var i = 1; i < instructions.length; i++) {
            instructions[i - 1].distance = instructions[i].distance;
            instructions[i - 1].time = instructions[i].time;
        }

        instructions[instructions.length-1].distance = 0;
        instructions[instructions.length-1].time = 0;

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

    _buildRouteRequest: function (waypoints, options, currentResponses) {
        var exceptionPaths = [];
        if (currentResponses) {
            for (var i = 0; i < currentResponses.length; i++) {
                exceptionPaths.push(
                {
                    "binaryPathDesc": currentResponses[i].binaryPathDesc,
                    "relMalus": 1000
                });
            }
        }

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
            "exceptionPaths": exceptionPaths,
            "details": {
                binaryPathDesc: currentResponses.length < this.options.numberOfAlternatives, // last route doesn't need exception paths
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
            request = this.options.beforeSend(request);
        }

        return request;
    }
});

L.Routing.ptv = function (options) {
    return new L.Routing.Ptv(options);
};