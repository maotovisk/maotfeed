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
    
    let reqUrl= `https://osu.ppy.sh/beatmapsets/events?user=&${reqtypes}&min_date=&max_date=`;
    console.log(reqUrl)
    await fetch(reqUrl).then(async function (response) {
        return response.text();
    }).then(async function (html) {
        var page = new JSSoup(html.toString())
        let jsons = page.findAll("script");
        let jsonEvents = null;
        for (scr of jsons) {
            if (scr.attrs.id == "json-events") {
                for (cont of scr.contents) {
                    jsonEvents = JSON.parse(cont._text);
                }
            }
        }
        jsonEvents.reverse();
        let x = 0;

        for (var s of jsonEvents) {
            // Parsing beatmap events
            let _type = s.type;
            let _date = moment(s.created_at);
            let _nextEvent = jsonEvents[x + 1];
            let _lastEvent;
            if (x > 0)
                _lastEvent = jsonEvents[x - 1];
            let _nextDate;

            if (x < jsonEvents.length - 1|| _nextEvent != undefined)
                _nextDate = moment(_nextEvent.created_at);
            let _lastEventDate;
            if (x > 0)
                _lastEventDate = moment(_lastEvent.created_at);
            if (_date.isSameOrBefore(lastDate) && lastDate != null) {
                x++;
                continue;
            } 
            console.log("New event!", _type, "at", _date.toDate());

            if (_type == "unknown")
                console.log((s.text).toString());

            // Regex that finds the MapsetID/DiscussionPostID
            if (s.comment)
                ids = [s.beatmapset.id, s.comment.beatmap_discussion_post_id];
            else
                ids = [s.beatmapset.id];

            let _mapsetID = s.beatmapset.id;
            //Request to the beatmap discussion, finding the issue that caused the disqualify.
            discussionHandler.discussionRequest(s, ids, _date, _type, _mapsetID, show_bancho_pop);
            x++;
        }
        console.log(jsonEvents.toString());
        lastDate = moment(jsonEvents[jsonEvents.length - 1].created_at).toDate();
        fs.writeFileSync("./data/lastDate", moment(lastDate).toString(), "utf8");
        console.log("Finished fetching all events at", moment(lastDate).toDate())
    }).catch(async function (err) {
        console.warn('Something went wrong.', err);
    });
}

module.exports = {fetchUpdates}