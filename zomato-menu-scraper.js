var express = require('express');
var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var app     = express();
var https = require('https');
var exec = require('exec');
var globalCookie1 = "PHPSESSID=19o5reaf0c09kn898no98hn2i0; ueg=3; squeeze=9d021699261ed227328dfa064ba52ff0; orange=7688750; GCSCE_442739719837_S3=C=442739719837.apps.googleusercontent.com:S=7e74c3fe301f3c8f396ee14084d41bab731976c3..aa9c:I=1411218831:X=1411222431; G_AUTHUSER_S3=0; dpr=1; __utma=141625785.1004035067.1411205798.1411220954.1411223772.5; __utmc=141625785; __utmz=141625785.1411205798.1.1.utmcsr=google|utmccn=(organic)|utmcmd=organic|utmctr=(not%20provided); fbcity=4; zl=en; fbtrack=a4be40b9e3690d6761c703f0657533c1";
var globalCookie2 = "PHPSESSID=19o5reaf0c09kn898no98hn2i0; ueg=3; squeeze=6149c444ab05cd7579139a5cc203a093; orange=2797656; dpr=1; __utma=141625785.1004035067.1411205798.1411245289.1411251972.8; __utmb=141625785.3.10.1411251972; __utmc=141625785; __utmz=141625785.1411205798.1.1.utmcsr=google|utmccn=(organic)|utmcmd=organic|utmctr=(not%20provided); GCSCE_442739719837_S3=C=442739719837.apps.googleusercontent.com:S=7e74c3fe301f3c8f396ee14084d41bab731976c3..aa9c:I=1411251976:X=1411255576; G_AUTHUSER_S3=0; fbcity=4; zl=en; fbtrack=a4be40b9e3690d6761c703f0657533c1";
var port = 8081;

app.get('/getFirst', function(req, res) {
  var resturant = encodeURIComponent(req.query.resturant),
    location = encodeURIComponent(req.query.location),
    host = "www.zomato.com",
    x = "/php/liveSuggest.php?type=json&q=" + resturant + "%2C%20" + location.split(",")[0];

  console.log("Querying for the data " + host + x);
  if (resturant[0]=="K" && resturant[resturant.length - 1]=="K") {
    res.send("/bangalore/k-k-itc-gardenia-residency-road");
    console.log("Sending KK Fix");
    return;
  } else {
    console.log(resturant);
  }

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
      Cookie: globalCookie1
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
    hide_images = req.query.hide_images,
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

    if (hide_images) {
      setTimeout(function () {
        console.log("Sending the response because of hide_images");
        res.send(json);
      }, 50);
      return;
    }

    if (!hide_images) {
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
            if (i>5) {
              res.send(json);
              return;
            }
            menuImager();
          }
        });
      };

      menuImager();
    }
  });
})

app.get("/reviews", function(req, res){
  var the_res_id = req.query.res_id,
    urlBuilt = req.query.url,
    curlCommand = "curl 'https://www.zomato.com/php/filter_reviews.php' -H 'Pragma: no-cache' -H 'X-NewRelic-ID: VgcDUF5SGwEDV1RWAgg=' -H 'Origin: https://www.zomato.com' -H 'Accept-Encoding: gzip,deflate,sdch' -H 'Accept-Language: en-US,en;q=0.8' -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.153 Safari/537.36' -H 'Content-Type: application/x-www-form-urlencoded; charset=UTF-8' -H 'Accept: */*' -H 'Cache-Control: no-cache' -H 'X-Requested-With: XMLHttpRequest' -H 'Cookie: " + globalCookie2 + "' -H 'Connection: keep-alive' -H 'Referer: https://www.zomato.com"+ urlBuilt +"/reviews' --data "+
      "'res_id=" + the_res_id + "&sort=reviews-dd&limit=50' --compressed"

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
      dataDump = dataDump.replace(/"/g, "");
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

app.get("/about", function(req, res) {
  var resturant = encodeURIComponent(req.query.name),
    location = encodeURIComponent(req.query.location),
    url = "http://localhost:"+port+"/getFirst?resturant="+resturant+"&location="+location,
    objectReturn = {};
  
  request(url, function(error, response, html){
    console.log("Step 1: " + html);
    var url2 = "http://localhost:"+port+"/scrape?resturant="+html+"&hide_images=true";
    request(url2, function(error2, response2, html2) {
      console.log("Step 2: " + html2);
      html2 = JSON.parse(html2);
      objectReturn.res_id = html2.res_id;
      objectReturn.name = html2.name;
      objectReturn.address = html2.address;
      var url3 = "http://localhost:"+port+"/reviews?res_id="+html2.res_id+"&url="+html;
      request(url3, function(error3, response3, html3) {
        console.log("Step 3: " + html3);
        objectReturn.reviews = JSON.parse(html3);
        res.send(objectReturn);
      });
    });
  });
});

app.get("/menuphotos", function(req, res) {
  var resturant = encodeURIComponent(req.query.name),
    location = encodeURIComponent(req.query.location),
    url = "http://localhost:"+port+"/getFirst?resturant="+resturant+"&location="+location,
    objectReturn = {};
  
  request(url, function(error, response, html){
    console.log("Step 1: " + html);
    var url2 = "http://localhost:"+port+"/scrape?resturant="+html;
    request(url2, function(error2, response2, html2) {
      console.log("Step 2: " + html2);
      html2 = JSON.parse(html2);
      objectReturn.res_id = html2.res_id;
      objectReturn.name = html2.name;
      objectReturn.address = html2.address;
      objectReturn.menuImages = html2.menuImages;
      res.send(objectReturn);
    });
  });
});

app.listen('8081')
console.log('Magic happens on port 8081');
exports = module.exports = app;
