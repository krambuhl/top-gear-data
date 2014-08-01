var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var $ = require('jquery');
var _ = require('underscore');

var starlaps = [];
var powerlaps = {}

function listItems2collection(items) {
	var collection = [];
	items.map(function (index) {
		var raw = this.children;
		var time = raw[0].data.split(' ')[0];
		var note = raw[2] && raw[2].data && raw[2].data !== ' ' ? raw[2].data.replace(/[()]/g,'').trim() : undefined;

		var model = {
			position: index,
			name: raw[1].attribs.title,
			time: time,
			seconds: laptime2seconds(time),
			note: '',
			state: 'dry',
			passenger: false,
			automatic: false,
			url: 'http://en.wikipedia.org' + raw[1].attribs.href
		};

		if (note) {
			var status = note2status(note.toLowerCase());
			model.note = note;

			if (status.state) { model.state = status.state; }
			if (status.passenger) { model.passenger = status.passenger; }
			if (status.automatic) { model.automatic = status.automatic; }
		}

		collection.push(model);
	});

	return collection;
}

function detectState(note) {
	var keywords = [
		'melted snow',
		'very wet',
		'mildly moist',
		'moist',
		'wet',
		'damp',
		'ice',
		'snow',
		'hot'
	];

	var res;

	keywords.forEach(function (kw) {
		if (!res && note.indexOf(kw) !== -1) {
			res = kw;
		}
	});

	return res;
}

function detectPassenger(note) {
	return note.indexOf('passenger') !== -1;
}

function detectAutomatic(note) {
	return note.indexOf('automatic') !== -1;
}

function note2status(note) {
	return {
		state: detectState(note),
		passenger: detectPassenger(note),
		automatic: detectAutomatic(note)
	};
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

var loaded = 0;
function queueWrite() {
	loaded++

	if (loaded >= 2) {
		fs.writeFile('data/top-gear.json', JSON.stringify(_.union(starlaps, [powerlaps]), null, 2));
	}
}

var starUrl = 'http://en.wikipedia.org/wiki/Top_Gear_test_track';
request(starUrl, function(error, response, html){
	if(!error){
		var $ = cheerio.load(html);

		$('.mw-headline').filter(function () {
			return this.attribs.id.indexOf('leaderboard') !== -1;
		}).map(function (list) {
			var data = scrapeData($(this));
			starlaps.push(data);
		});

		fs.writeFile('data/starlaps.json', JSON.stringify(starlaps, null, 2));
		queueWrite();
	}
});
//
// var powerUrl = 'http://en.wikipedia.org/wiki/Top_Gear_test_track';
// request(powerUrl, function(error, response, html){
// 	if(!error){
// 		var $ = cheerio.load(html);
//
// 		$('.mw-headline').filter(function () {
// 			return this.attribs.id.indexOf('leaderboard') !== -1;
// 		}).map(function (list) {
// 			powerlaps = scrapeData($(this));
// 		});
//
// 		fs.writeFile('data/powerlaps.json', JSON.stringify(powerlaps, null, 2));
// 		queueWrite();
// 	}
// });
