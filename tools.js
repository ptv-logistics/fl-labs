// runRequest executes a json request on PTV xServer internet,
// given the url endpoint, the token and the callbacks to be called
// upon completion. The error callback is parameterless, the success
// callback is called with the object returned by the server.
var runRequest = function (url, request, token, handleSuccess, handleError) {
    $.ajax({
        url: url,
        type: 'POST',
        data: JSON.stringify(request),

        headers: function () {
            var h = {
                'Content-Type': 'application/json'
            };
            if (token) h['Authorization'] = 'Basic ' + btoa('xtok:' + token);
            return h;
        }(),

        success: function (data, status, xhr) {
            handleSuccess(data);
        },                                               

        error: function (xhr, status, error) {
            handleError(xhr);
        }
    });
};

if (!String.prototype.includes) {
    String.prototype.includes = function(search, start) {
        'use strict';
        if (typeof start !== 'number') {
            start = 0;
        }

        if (start + search.length > this.length) {
            return false;
        } else {
            return this.indexOf(search, start) !== -1;
        }
    };
}