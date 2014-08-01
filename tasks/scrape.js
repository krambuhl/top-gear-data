var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var $ = require('jquery');
var _ = require('underscore');

var starlaps = [];
var powerlaps = {};

function listItems2collection(items) {
	var collection = [];
	items.map(function (index) {
		var raw = this.children;
		var time = raw[0].data.split(' ')[0];
		var note = raw[2] && raw[2].data && raw[2].data !== ' ' ? raw[2].data.replace(/[()]/g,'').trim() : undefined;

		var model = {
			rank: index,
			name: raw[1].attribs.title,
			time: time,
			seconds: laptime2seconds(time),
			weather: 'dry',
			passenger: false,
			automatic: false,
			url: 'http://en.wikipedia.org' + raw[1].attribs.href
		};

		if (note) {
			var status = note2status(note.toLowerCase());
			model.note = note;

			if (status.weather) { model.weather = status.weather; }
			if (status.passenger) { model.passenger = status.passenger; }
			if (status.automatic) { model.automatic = status.automatic; }
		}

		collection.push(model);
	});

	return collection;
}

function detectWeather(note) {
	var keywords = [
		'melted snow',
		'very wet',
		'mildly moist',
		'partly damp',
		'moist',
		'wet',
		'damp',
		'ice',
		'snow',
		'hot',
		'cold'
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
		weather: detectWeather(note),
		passenger: detectPassenger(note),
		automatic: detectAutomatic(note)
	};
}

function laptime2seconds(time) {
	var chunks = time.split(/[:.]/g).map(function (t) {
		return parseInt(t);
	});

	var secs = (60 * chunks[0]) + (chunks[1]) + (chunks[2] / 10);

	if (_.isNaN(secs)) return time;
	return secs;
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

function scrapeStarList(items, title) {
	var meta = title2meta(title);
	return {
		vehicle: meta.make + ' ' + meta.model,
		start: meta.start,
		end: meta.end,
		data: listItems2collection(items)
	};
}

function scrapeStarData(el) {
	var root = el.parent();
	var listItems = root.next().find('li');
	var title = root.prevAll('h4').eq(0).children()[0].children[0].data;
	return scrapeStarList(listItems, title);
}

var starUrl = 'http://en.wikipedia.org/wiki/Top_Gear_test_track';
request(starUrl, function(error, response, html){
	if(!error){
		var $ = cheerio.load(html);

		$('.mw-headline').filter(function () {
			return this.attribs.id.indexOf('leaderboard') !== -1;
		}).map(function (list) {
			var data = scrapeStarData($(this));
			starlaps.push(data);
		});

		fs.writeFile('data/starlaps.json', JSON.stringify(starlaps, null, 2));
	}
});



function getVehicle(nodes) {
	var data = [];

	nodes.forEach(function (node, i) {
		if (node.type == 'text') {
			data.push(node.data);
		} else if (node.type == 'tag') {
			data.push(node.children[0].data);
		}
	});

	var join = data.join('');
	var hasNotes = join.indexOf('(') !== -1;

	var ret = {
		string: join.toLowerCase(),
		vehicle: join.split('(')[0].trim(),
	};

	if (hasNotes) {
		ret.notes = join.substr(join.indexOf('(')).replace(/[()]/g,'').trim();
	}

	return ret;
}

function scrapePowerData(table) {
	var rows = table.children('tr');
	var laps = [];

	rows.each(function (i) {
		var power;
		var cells = rows.eq(i);

		if(cells.children()[1].name !== 'th') {
			var rawdata = getVehicle(cells.children()[1].children);
			var time = cells.children()[0].children[0].data;

			power = {
				rank: i - 1,
				time: time,
				seconds: laptime2seconds(time),
				vehicle: rawdata.vehicle
			};

			if (rawdata.notes) {
				power.weather = detectWeather(rawdata.notes);
				if (_.isUndefined(power.weather)) delete power.weather;

			}

			laps.push(power);
		}
	});

	return laps;
}


var powerUrl = 'http://en.wikipedia.org/wiki/List_of_Top_Gear_test_track_Power_Lap_Times';
request(powerUrl, function(error, response, html){
	if(!error){
		var $ = cheerio.load(html);
		var table = $('#Qualifying_vehicles').parent().nextAll('table').eq(0);

		fs.writeFile('data/powerlaps.json', JSON.stringify(scrapePowerData(table), null, 2));
	}
});
