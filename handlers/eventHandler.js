const   JSSoup = require('jssoup').default,
        fetch = require("node-fetch"),
        moment = require("moment"),
        fs = require("fs"),
        discussionHandler = require("./discussionHandler"),
        utils             = require("./../utils/utils");

// Get updates from beatmap events
async function fetchUpdates(data) {

    console.log("Fetching updates...")
    // Variable that will concatenate every request type
    let reqtypes = "";
    let types = data;
    let show_bancho_pop = data.show_bancho_pop;
    let lastDate = data.lastDate;
    if (types.nominate == true)
        reqtypes += "&types%5B%5D=nominate";
    if (types.rank == true)
        reqtypes += "&types%5B%5D=rank";
    if (types.qualify == true)
        reqtypes += "&types%5B%5D=qualify";
    if (types.disqualify == true)
        reqtypes += "&types%5B%5D=disqualify";
    if (types.love == true)
        reqtypes += "&types%5B%5D=love";
    if (types.nomination_reset == true)
        reqtypes += "&types%5B%5D=nomination_reset";

    // Request to the beatmapset event pages
    await fetch(`https://osu.ppy.sh/beatmapsets/events?user=&${reqtypes}`).then(async function (response) {
        return response.text();
    }).then(async function (html) {
        var page = new JSSoup(html.toString())
        var allEventHTML = page.findAll("div", "beatmapset-event");
        allEventHTML.reverse();
        let x = 0;

        for (var s of allEventHTML) {
            // Parsing beatmap events
            let _type = utils.getType(s.text);
            let _date = moment(s.find("time").attrs.datetime);
            let _nextEvent = allEventHTML[x + 1];
            let _lastEvent;
            if (x > 0)
                _lastEvent = allEventHTML[x - 1];
            let _nextDate;

            if (x < allEventHTML.length - 1|| _nextEvent != undefined)
                _nextDate = moment(_nextEvent.find("time").attrs.datetime);
            let _lastEventDate;
            if (x > 0)
                _lastEventDate = moment(_lastEvent.find("time").attrs.datetime);
            if (_date.isSameOrBefore(lastDate) && lastDate != null) {
                x++;
                continue;
            } 
            console.log("New event!", _type, "at", _date.toDate());

            if (_type == "unknown")
                console.log((s.text).toString());

            // Regex that finds the MapsetID/DiscussionPostID
            ids = s.find("a").attrs.href.match(/\/(\d+)+[\/]?/g).map(id => id.replace(/\//g, ''))
            let _mapsetID = ids[0];

            //Request to the beatmap discussion, finding the issue that caused the disqualify.
            discussionHandler.discussionRequest(s, ids, _date, _type, _mapsetID, show_bancho_pop);
            x++;
        }
        lastDate = moment(allEventHTML[allEventHTML.length - 1].find("time").attrs.datetime).toDate();
        fs.writeFileSync("./data/lastDate", moment(lastDate).toString(), "utf8");
        console.log("Finished fetching all events at", moment(lastDate).toDate())
    }).catch(async function (err) {
        console.warn('Something went wrong.', err);
    });
}

module.exports = {fetchUpdates}