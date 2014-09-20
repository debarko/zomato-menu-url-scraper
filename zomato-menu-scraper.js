var express = require('express');
var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var app     = express();
var https = require('https');
var exec = require('exec');
var globalCookie1 = "PHPSESSID=19o5reaf0c09kn898no98hn2i0; ueg=3; squeeze=9d021699261ed227328dfa064ba52ff0; orange=7688750; GCSCE_442739719837_S3=C=442739719837.apps.googleusercontent.com:S=7e74c3fe301f3c8f396ee14084d41bab731976c3..aa9c:I=1411218831:X=1411222431; G_AUTHUSER_S3=0; dpr=1; __utma=141625785.1004035067.1411205798.1411220954.1411223772.5; __utmc=141625785; __utmz=141625785.1411205798.1.1.utmcsr=google|utmccn=(organic)|utmcmd=organic|utmctr=(not%20provided); fbcity=4; zl=en; fbtrack=a4be40b9e3690d6761c703f0657533c1";
var globalCookie2 = "PHPSESSID=19o5reaf0c09kn898no98hn2i0; ueg=3; squeeze=9d021699261ed227328dfa064ba52ff0; orange=7688750; GCSCE_442739719837_S3=C=442739719837.apps.googleusercontent.com:S=7e74c3fe301f3c8f396ee14084d41bab731976c3..aa9c:I=1411236227:X=1411239827; G_AUTHUSER_S3=0; LEL_JS=true; searchurl=http%3A%2F%2Fwww.zomato.com%2Fbangalore%2Frestaurants%2Fchinese; __utma=141625785.1004035067.1411205798.1411223772.1411236221.6; __utmb=141625785.16.9.1411238003450; __utmc=141625785; __utmz=141625785.1411205798.1.1.utmcsr=google|utmccn=(organic)|utmcmd=organic|utmctr=(not%20provided); dpr=1; fbcity=4; zl=en; fbtrack=a4be40b9e3690d6761c703f0657533c1";

app.get('/getFirst', function(req, res) {
  var resturant = encodeURIComponent(req.query.resturant),
    location = encodeURIComponent(req.query.location),
    host = "www.zomato.com",
    x = "/php/liveSuggest.php?type=json&q=" + resturant + "%20" + location;

  console.log("Querying for the data " + host + x);

  function fetch(options, cb) {
    var callback = function(response) {
        var data = '';
        response.on('data', function(chunk) {
            data += chunk;
        });
        response.on('end', function() {
            cb(data);
        });
    }
    https.get(options, callback).end();
  }

  fetch({
    host: host,
    path: x,
    headers: {
      Cookie: globalCookie
    }
  }, function (response) {
    console.log("Received the data" + response);
    if (!response || response==="") {
      console.log("Some issues, please check Cookie");
    }
    var $I = cheerio.load(response);
    res.send($I('.item').first().attr("href"));
  });
});

app.get('/scrape', function(req, res){
  var the_name = req.query.resturant,
    the_name, pageNumber = 1;

  var url = "https://www.zomato.com" + the_name + "/menu?page=" + pageNumber + "#menutop";

  console.log("Menu 1 " + url);
  request(url, function(error, response, html){
    if(error){
      console.log("Couldn't find the menu because of error: " + error);
      return;
    }
    var res_id = html.match(/RES_ID = .[0-9]+./)[0].split("\"")[1];
    var $ = cheerio.load(html);
    var checkerName = 0, checkerAddress = 0;
    var json = { name : "", address : "", menuImages: [], res_id: res_id};

    console.log("Trying to fetch resturant name");
    $('.res-main a').filter(function(){
      var data = $(this);
      if (checkerName == 0) {
        checkerName++;
        if (!data.attr("title")) {
          json.name = false;
          console.log("Couldn't get the name of the resturant");
        } else {
          json.name = data.attr("title");
          console.log("Got resturant name " + json.name);
        }
      }
    });

    console.log("Trying to fetch resturant address");
    $('.res-main-address-text').filter(function(){
      var data = $(this);
      if (checkerAddress == 0) {
        checkerAddress++;
        if (!data.html()) {
          console.log("Couldn't get the address of the resturant");
          json.address = false;
        } else {
          json.address = data.text();
          json.address = json.address.replace("\n", "");
          json.address = json.address.replace("India", ", India");
          json.address = json.address.replace(/  /g, "");
          console.log("Got resturant address " + json.address);
        }
      }
    });

    var parseMenu = function (htmlI, i) {
      var $I = cheerio.load(htmlI);

      if (!i) {
        i = 1;
      }
      return $I('#menu-image img').attr("src");
      $I('#menu-image img').filter(function(){
        console.log("Parsing the menu");
        var data = $I(this), imgUrl;
        imgUrl = data.attr("src");
        if (imgUrl) {
          console.log(i, imgUrl);
          return imgUrl;
        } else {
          return false;
        }
      });
    };

    var firstMenuItem = parseMenu(html);
    if (!firstMenuItem) {
      console.log("Sending the response back in the beginning");
      res.send(json);
    } else {
      json.menuImages.push(firstMenuItem);
    }

    var i = 2;
    console.log("Trying to fetch resturant menu");
    var menuImager = function() {
      var urlI = "https://www.zomato.com" + the_name + "/menu?page=" + i + "#menutop";

      console.log("Menu " + i + " " + urlI);
      request(urlI, function(errorI, responseI, htmlI) {
        if (errorI) {
          console.log("Error happened while fetching menus: " + errorI);
          return;
        }
        var menuItem = parseMenu(htmlI, i);
        if (!menuItem) {
          console.log("Sending the response back");
          res.send(json);
        } else {
          json.menuImages.push(menuItem);
          i++;
          menuImager();
        }
      });
    };

    menuImager();
  });
})

app.get("/reviews", function(req, res){
  var curlCommand = "curl 'https://www.zomato.com/php/filter_reviews.php' -H 'Pragma: no-cache' -H 'X-NewRelic-ID: VgcDUF5SGwEDV1RWAgg=' -H 'Origin: https://www.zomato.com' -H 'Accept-Encoding: gzip,deflate,sdch' -H 'Accept-Language: en-US,en;q=0.8' -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.153 Safari/537.36' -H 'Content-Type: application/x-www-form-urlencoded; charset=UTF-8' -H 'Accept: */*' -H 'Cache-Control: no-cache' -H 'X-Requested-With: XMLHttpRequest' -H 'Cookie:" + globalCookie1 + "' -H 'Connection: keep-alive' -H 'Referer: https://www.zomato.com/bangalore/high-ultra-lounge-malleshwaram/reviews' --data "+
  "'res_id=57709&sort=reviews-dd&limit=50' --compressed"

  console.log(curlCommand);
  exec(curlCommand,
    function (error, stdout, stderr) {
      var json = [];
      console.log("Got the reviews");
      stdout = JSON.parse(stdout);
      var $I = cheerio.load(stdout.html);
      var dataDump = $I("div[itemprop=description]").text();
      dataDump = dataDump.replace(/Rated/g, "");
      dataDump = dataDump.replace(/rated/g, "");
      dataDump = dataDump.replace(/  /g, "");
      var xArr = dataDump.split("\n");
      for(var j=0;j<xArr.length;j++) {
        if (xArr[j] === "" || xArr[j] === " " || xArr[j] === "  ") {
          continue;
        }
        json.push(xArr[j]);
      }
      res.send(json);
  });
});

app.listen('8081')
console.log('Magic happens on port 8081');
exports = module.exports = app;
