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

var fixClickPropagationForIE = function (container) {
    container.onclick = L.DomEvent.stopPropagation;
    var inputTags = container.getElementsByTagName('input');
    var selectTags = container.getElementsByTagName('select');
    var elements = Array.prototype.slice.call(inputTags, 0);
    elements = elements.concat(Array.prototype.slice.call(selectTags, 0));

    for (var i = 0; i < elements.length; i++) {
        if (elements[i].type == 'text')
            elements[i].onclick = L.DomEvent.stopPropagation;
        elements[i].onmousedown = elements[i].ondblclick = elements[i].onpointerdown = L.DomEvent.stopPropagation;
    }
};