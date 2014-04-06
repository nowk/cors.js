/* jshint laxcomma: true */

(function() {
  'use strict';

  var fcount = 0;


  function cors3() {
    // :
  }


  /*
   * inherit EventEmitter
   */

  cors3.prototype = Object.create(EventEmitter.prototype);


  /*
   * defaults
   */

  cors3.prototype.useAcl          = 'private';
  cors3.prototype.useSignatureUrl = '/sign/my/s3';
  cors3.prototype.path = '/uploads';


  /*
   * @api public
   */

  cors3.prototype.upload = function(filesObj) {
    for (var i=0, l=filesObj.length; i<l; i+=1) {
      var file = {_id: fcount, file: filesObj[i]};

      this.emit('fileadded', file);
      this._upload(file);

      fcount+= 1; // count, used as unique id for reference
    }
  };


  /*
   * @api private
   */

  cors3.prototype._upload = function(file) {
    var self = this;

    this.signFile(file, function(err, signedFile) {
      self.emit('filesigned', err, signedFile);
      if (!err) self.puts3(signedFile);
    });
  };


  /*
   * @api private
   */

  cors3.prototype.signFile = function(file, callback) {
    var self = this
      , xhr  = new XMLHttpRequest()
      ;

    var params = '?'+[
      'mimetype='+file.file.type,
      'filename='+file.file.name,
      'path='+this.path
    ].join("&");

    xhr.open('GET', this.useSignatureUrl+params);

    xhr.onreadystatechange = function(evt) {
      if (this.readyState === 4 && this.status === 200) {
        var json = JSON.parse(this.responseText);

        for (var k in json) {
          if (json.hasOwnProperty(k)) file[k] = json[k];
        }
        file.filesize = file.file.size;

        callback(null, file);

      } else if (this.readyState === 4 && this.status !== 200) {
        callback({status: this.status, response: this.responseText}, file);
      }
    };

    xhr.send();
  };


  /*
   * @api private
   */

  cors3.prototype.puts3 = function(file) {
    var self = this;

    this.corsit('PUT', file.signedPutUrl, function(err, xhr) {
      if (err) {
        self.emit('error', err, file);
      } else {
        xhr.onloadstart = function() {
          self.emit('uploadstarted', file);
        };

        xhr.onload = function() {
          if (xhr.status === 200) {
            self.emit('uploadcompleted', null, file);
          } else {
            self.emit('uploadcompleted', {status: this.status, response: this.responseText}, file);
          }
        };

        xhr.onerror = function() {
          self.emit('uploadcompleted', 'XHR error.', file);
        };

        xhr.upload.onprogress = function(evt) {
          if (evt.lengthComputable) {
            var percent = Math.round((evt.loaded / evt.total) * 100);
            self.emit('uploadprogress', file, evt.total, evt.loaded, percent);
          }
        };

        xhr.abort = function() {
          self.emit('uploadaborted', file);
        };
      }

      xhr.setRequestHeader('Content-Type', file.file.type);
      xhr.setRequestHeader('x-amz-acl',    self.useAcl);

      xhr.send(file.file);
    });
  };


  /*
   * @api private
   */

  cors3.prototype.corsit = function(method, url, callback) {
    var xhr = new XMLHttpRequest();

    if (xhr.withCredentials !== null) {
      xhr.open('PUT', url, true);
    } else if ('undefined' !== typeof XDomainRequest) {
      xhr = new XDomainRequest();
      xhr.open('PUT', url);
    } else {
      callback('No CORS support', null);
      return;
    }

    callback(null, xhr);
  };



  this.Cors3 = cors3;

}.call(this));

