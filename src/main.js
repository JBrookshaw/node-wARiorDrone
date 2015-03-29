var myApp = angular.module('myApp', []);

var videoDiv = document.getElementById('video');
var ns = new NodecopterStream(videoDiv, {port: 5555});
var videoCanvas = videoDiv.querySelector('canvas');
var frameBuffer = new Uint8Array(videoCanvas.width * videoCanvas.height * 4);
//var detect = detector({maxDiff: 0.7});
var pickedColor = [192, 60, 60];
var detected;
var client = new WsClient();

var xPID = new PID({pGain: 0.1, iGain: 0, dGain: 0});
var yPID = new PID({pGain: 0.1, iGain: 0, dGain: 0});
var zPID = new PID({pGain: 0.1, iGain: 0, dGain: 0});

var track = document.getElementById('track');
track.width = 640;
track.height = 360;
var ctx = track.getContext("2d");
ctx.fillStyle = "#FF0000";

//options
var maxDiff = 0.01;
var w = videoCanvas.width;
var h = videoCanvas.height;
var b = frameBuffer;
var c = frameBuffer;
var averagePixel;
var count;
var lastCount;
var state;


myApp.controller('Controller', ['$scope', function ($scope) {

    $scope.maxDiff = 100;
    $scope.accuracy = 3;
    $scope.fps = 1;
    $scope.fps = 200;

    setState('ground');

    var y;
    var x;
    $scope.mainLoop = function(){

            clearInterval(interval);
            ctx.clearRect(0, 0, w, h);
            var maxDiff = $scope.maxDiff /3000;
            var accuracy = $scope.accuracy *4;

            b = frameBuffer;
            count = 0;
            var xSum = 0;
            var ySum = 0;
            ns.getImageData(b);

            averagePixel = {r: 0, g: 0, b: 0};
            for (var i = 0; i < b.length; i += accuracy) {

                var match = true;
                for (var j = 0; j < pickedColor.length; j++) {

                    var diffPercent = Math.abs(b[i + j] - pickedColor[j]) / 255;
                    if (diffPercent > maxDiff) {
                        match = false;
                        break;
                    }
                }
                if (match) {
                    count++;
                    y = i / (w * 4);
                    x = i % (w * 4) / 4;
                    xSum += x;
                    ySum += Math.abs(y - h);
                    ctx.fillStyle = "rgb(" + b[i] + "," + b[i + 1] + "," + b[i + 2] + ")";
                    ctx.fillRect(x, Math.abs(y - h), 1, 1);

                    //Used for color surfing
                    averagePixel.r += b[i];
                    averagePixel.g += b[i + 1];
                    averagePixel.b += b[i + 2];
                }
            }
            averagePixel.r = Math.round(averagePixel.r / count);
            averagePixel.g = Math.round(averagePixel.g / count);
            averagePixel.b = Math.round(averagePixel.b / count);
            $scope.hi = averagePixel.r;
            detected = {x: xSum / count, y: ySum / count};

            if (averagePixel.r > pickedColor[0]) {
                pickedColor[0]++;
            } else if (averagePixel.r < pickedColor[0]) {
                pickedColor[0]--;
            }
            if (averagePixel.g > pickedColor[1]) {
                pickedColor[1]++;
            } else if (averagePixel.g < pickedColor[1]) {
                pickedColor[1]--;
            }
            if (averagePixel.b > pickedColor[2]) {
                pickedColor[2]++;
            } else if (averagePixel.b < pickedColor[2]) {
                pickedColor[2]--;
            }

            //color info
            var pixelColor = "rgb(" + pickedColor[0] + ", " + pickedColor[1] + ", " + pickedColor[2] + ")";
            $('#pickedColor').css('background-color', pixelColor);
            $('#rVal').html("r" + pickedColor[0]);
            $('#gVal').html("b" + pickedColor[1]);
            $('#bVal').html("g" + pickedColor[2]);
            lastCount = count;

            //draw cross-hairs at center of detected object
            ctx.beginPath();
            ctx.moveTo(0, detected.y);
            ctx.lineTo(640, detected.y);
            ctx.moveTo(detected.x, 0);
            ctx.lineTo(detected.x, 360);
            ctx.strokeStyle = "black";
            ctx.stroke();
            ctx.closePath();
            var xVal = (detected.x - w / 2) / (w / 2);
            var yVal = (detected.y - h/2) / (h/2);

            var radi = getRadius(detected.x, detected.y);

            var radidiff = 30-radi;
            console.log("r "+radi+" dif"+radidiff);

            //Uncomment to log location info
            // console.log("|xVal: "+xVal+"|# Detected: "+count+"|X: "+Math.round(detected.x)+ "|Y: "+Math.round(detected.y)+"|AvgPixel: "+averagePixel.r);

            if (state === "follow" && !isNaN(xVal)) {
                client.clockwise(xVal / 6);
                //client.right(xVal/6);
                client.up(-yVal / 6);
                console.log(xVal / 6);
                if(radidiff > 0){
                    client.front(.05);
                }
                else{
                    client.front(-.05);
                }
            } else {
                client.stop();
            }
        interval = setInterval($scope.mainLoop, $scope.fps);
    }

    var interval = setInterval($scope.mainLoop, $scope.fps);

    var surf = function(){ var sX = detected.x; var sY = detected.y;

        var s = frameBuffer;

        var radius = getRadius(sX,sY);
        console.log("sx:"+sX+" sy: "+sY+"  rad "+ radius);
        ns.getImageData(s, sX-radius, h - sY+radius, radius, radius);

        var length = radius*4;
        ctx.fillRect(sX-radius, sY+radius, radius, radius);












        //for(var p =0; p <40; p+=4) {
        //    console.log(s[p]+" "+s[p+1]+" "+s[p+2]);
        //    var tY = p / (w * 4);
        //    var tX = p % (w * 4) / 4;
        //    var data = ctx.getImageData(tX+1,Math.abs(tY - h)+1, 2, 2).data;
        //
        //    for(var q =0; q < 16; q+=4){
        //    var isMatch = (Math.abs(b[q] - pickedColor[0]) / 255 < maxDiff
        //                        && Math.abs(b[q+1] - pickedColor[1]) / 255 < maxDiff
        //                        && Math.abs(b[q+2] - pickedColor[2]) / 255 < maxDiff);
        //    if (isMatch) {
        //        ctx.fillStyle = "rgb(" + b[i] + "," + b[i + 1] + "," + b[i + 2] + ")";
        //        ctx.fillRect(x, Math.abs(y - h), 1, 1);
        //    }
        //}
        //
        //
        //}
    }

    function getRadius(xCenter, yCenter){
        var s = frameBuffer;
        var xDis = Math.abs(w-xCenter);
        ns.getImageData(s, xCenter, h-yCenter, xDis, 1);


            var farthest = 0;
        for(var i=0; i < (xDis*4);i+=4){
            var isMatch = (Math.abs(s[i] - pickedColor[0]) / 255 < maxDiff
            && Math.abs(s[i+1] - pickedColor[1]) / 255 < maxDiff
            && Math.abs(s[i+2] - pickedColor[2]) / 255 < maxDiff);
            if(isMatch){
                farthest = i/4;
            }
        }
        return farthest;
    }
    var flightButton = document.getElementById('flight');
    flightButton.addEventListener('click', function () {

        if (this.textContent === 'Start') {
            setState('takeoff');
            client.takeoff(function () {
                setState('follow');
            });
            this.textContent = 'Stop';
        } else {
            setState('land');
            client.land(function () {
                setState('ground');
            });
            this.textContent = 'Start';
        }
    });

}]);


function PID(options) {
    this._pGain = options.pGain || 0;
    this._iGain = options.iGain || 0;
    this._dGain = options.dGain || 0;
    this._min = options.min || -1;
    this._max = options.max || 1;
    this._zero = options.zero || 0;
    this._p = 0;
    this._i = 0;
    this._d = 0;
    this._sum = 0;
    this._target = 0;
    this._sumErr = 0;
    this._lastErr = 0;
    this._lastTime = null;

}
PID.prototype.target = function (val) {
    if (val === undefined) {
        return this._target;
    }
    this._sumErr = 0;
    this._lastErr = 0;
    this._lastTime = null;
    this._sum = this._p = this._i = this._d = this._zero;
    this._target = val;
    return this._target;
};
PID.prototype.update = function (val) {
    var now = Date.now();
    var dt = 0;
    if (this._lastTime !== null) {
        dt = (now - this._lastTime) / 1000;
    }
    this._lastTime = now;
    var err = this._target - val;
    var dErr = (err - this._lastErr) * dt;
    this._sumErr += err * dt;
    this._lastErr = err;
    this._p = this._pGain * err;
    this._i = this._iGain * this._sumErr;
    this._d = this._dGain * dErr;
    this._sum = this._p + this._i + this._d;
    if (this._sum < this._min) {
        this._sum = this._min;
    } else if (this._sum > this._max) {
        this._sum = this._max;
    }
};
PID.prototype.pid = function () {
    return {p: this._p, i: this._i, d: this._d, sum: this._sum};
};

function setState(val) {
    console.log('new state: ' + val);
    this.state = val;
}

function WsClient() {
    this._conn = null;
    this._connected = false;
    this._queue = [];
    this._listeners = {};
    this._takeoffCbs = [];
    this._landCbs = [];

    var self = this;
    self._conn = new WebSocket('ws://' + window.location.host);
    self._conn.onopen = function () {
        self._connected = true;
        self._queue.forEach(function (msg) {
            self._conn.send(msg);
        });
        self._queue = [];

        self._conn.onmessage = function (msg) {
            try {
                msg = JSON.parse(msg.data);
            } catch (err) {
                console.error(err);
                return;
            }
            var kind = msg.shift();
            switch (kind) {
                case 'takeoff':
                    self._takeoffCbs.forEach(function (cb) {
                        cb();
                    });
                    self._takeoffCbs = [];
                    break;
                case 'land':
                    self._landCbs.forEach(function (cb) {
                        cb();
                    });
                    self._landCbs = [];
                    break;
                case 'on':
                    var event = msg.shift();
                    self._listeners[event].forEach(function (cb) {
                        cb.apply(self, msg);
                    });
                    break;
                default:
                    console.error('unknown message: ' + kind);
            }
        };
    };

}

WsClient.prototype._connect = function () {
    var self = this;
    self._conn = new WebSocket('ws://' + window.location.host);
    self._conn.onopen = function () {
        self._connected = true;
        self._queue.forEach(function (msg) {
            self._conn.send(msg);
        });
        self._queue = [];

        self._conn.onmessage = function (msg) {
            try {
                msg = JSON.parse(msg.data);
            } catch (err) {
                console.error(err);
                return;
            }
            var kind = msg.shift();
            switch (kind) {
                case 'takeoff':
                    self._takeoffCbs.forEach(function (cb) {
                        cb();
                    });
                    self._takeoffCbs = [];
                    break;
                case 'land':
                    self._landCbs.forEach(function (cb) {
                        cb();
                    });
                    self._landCbs = [];
                    break;
                case 'on':
                    var event = msg.shift();
                    self._listeners[event].forEach(function (cb) {
                        cb.apply(self, msg);
                    });
                    break;
                default:
                    console.error('unknown message: ' + kind);
            }
        };
    };

};

WsClient.prototype._send = function (msg) {
    msg = JSON.stringify(msg);
    if (!this._connected) {
        this._queue.push(msg);
        return;
    }
    this._conn.send(msg);
};

WsClient.prototype.on = function (event, cb) {
    var cbs = this._listeners[event] = this._listeners[event] || [];
    cbs.push(cb);
    if (cbs.length === 1) {
        this._send(['on', event]);
    }
};

WsClient.prototype.takeoff = function (cb) {
    this._send(['takeoff']);
    if (cb) {
        this._takeoffCbs.push(cb);
    }
};

WsClient.prototype.land = function (cb) {
    this._send(['land']);
    if (cb) {
        this._landCbs.push(cb);
    }
};

WsClient.prototype.right = function (val) {
    this._send(['right', val]);
};
WsClient.prototype.clockwise = function (val) {
    this._send(['clockwise', val]);
};
WsClient.prototype.up = function (val) {
    this._send(['up', val]);
};

WsClient.prototype.front = function (val) {
    this._send(['front', val]);
};

WsClient.prototype.stop = function () {
    this._send(['stop']);
};

//Listeners//

$(function () {

    $('#testCanvas').hide();

    //calculate offset for clicking and hovering on canvas
    var leftOffset = $('.widget-container').width();
    var topOffset = $('header').height();
    var canvasOffset = {left: leftOffset, top: topOffset};

    $('#video').mousemove(function (e) { // mouse move handler

        var canvasX = Math.floor(e.pageX - canvasOffset.left);
        var canvasY = Math.floor(e.pageY - canvasOffset.top);

        ns.getImageData(c, canvasX, h - canvasY, 1, 1);

        var pixelColor = "rgb(" + c[0] + ", " + c[1] + ", " + c[2] + ")";
        $('#preview').css('background-color', pixelColor);
    });

    $('#video').click(function (e) { // mouse click handler

        var canvasX = Math.floor(e.pageX - canvasOffset.left);
        var canvasY = Math.floor(e.pageY - canvasOffset.top);

        ns.getImageData(c, canvasX, h - canvasY, 1, 1);

        //change detection color
        pickedColor[0] = c[0];
        pickedColor[1] = c[1];
        pickedColor[2] = c[2];

        var pixelColor = "rgb(" + pickedColor[0] + ", " + pickedColor[1] + ", " + pickedColor[2] + ")";
        $('#pickedColor').css('background-color', pixelColor);

        //color info
        $('#rVal').html("r" + c[0]);
        $('#gVal').html("b" + c[1]);
        $('#bVal').html("g" + c[2]);

        $('#rgbVal').val(c[0] + ',' + c[1] + ',' + c[2]);
        $('#rgbaVal').val(c[0] + ',' + c[1] + ',' + c[2] + ',' + c[3]);
        var dColor = c[2] + 256 * c[1] + 65536 * c[0];
        $('#hexVal').html('Hex: #' + dColor.toString(16));
    });

    setInterval(function updateUIPixelCount() {
        $('#pixelCount').html(lastCount);
    }, 300);

});




