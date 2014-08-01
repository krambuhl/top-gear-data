var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var $ = require('jquery');

var url = 'http://en.wikipedia.org/wiki/Top_Gear_test_track';
var srpc = [];

function listItems2collection(items) {
	var collection = [];
	items.map(function (index) {
		var raw = this.children;
		var time = raw[0].data.split(' ')[0];

		collection.push({
			position: index,
			name: raw[1].attribs.title,
			time: time,
			seconds: laptime2seconds(time),
			url: 'http://en.wikipedia.org' + raw[1].attribs.href
		});
	});

	return collection;
}

function laptime2seconds(time) {
	time = time.split(/[:.]/g).map(function (t) {
		return parseInt(t);
	});

	return (60 * time[0]) + (time[1]) + (time[2] / 10);
}

function title2meta(title) {
	var meta = title.split(' ');
	var years = meta[2].substr(1, meta[2].length - 2).split('–');

	return {
		make: meta[0],
		model: meta[1],
		start: years[0],
		end: years[1] || 'Present'
	};
}

function scrapeList(items, title) {
	var meta = title2meta(title);
	return {
		make: meta.make,
		model: meta.model,
		start: meta.start,
		end: meta.end,
		data: listItems2collection(items)
	};
}

function scrapeData(el) {
	var root = el.parent();
	var listItems = root.next().find('li');
	var title = root.prevAll('h4').eq(0).children()[0].children[0].data;
	return scrapeList(listItems, title);
}

request(url, function(error, response, html){
  if(!error){
    var $ = cheerio.load(html);

		$('.mw-headline').filter(function () {
			return this.attribs.id.indexOf('leaderboard') !== -1;
		}).map(function (list) {
			var data = scrapeData($(this));
			srpc.push(data);
		});

		fs.writeFile('data/srpc.json', JSON.stringify(srpc, null, 2));
	}
});
