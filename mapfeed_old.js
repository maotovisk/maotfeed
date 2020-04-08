const webhook  = require("webhook-discord"),
    JSSoup  = require('jssoup').default,
    fetch   = require("node-fetch"),
    moment  = require("moment"),
    fs      = require("fs"),
    osu     = require("nodesu");

const WEBHOOK_LINK = require("./.private/keys.json").WEBHOOK_URL;

//WebHook
const Hook = new webhook.Webhook(WEBHOOK_LINK)


// useless
var _EventQueue = [];
const tipos = ["nominate", "rank", "love", "nomination_reset", "disqualify"];

//OSU API HANDLING
const OSU_TOKEN = require("./.private/keys.json").OSU_TOKEN;
const osuApi = new osu.Client(OSU_TOKEN.toString());

//Check the last datetime of recieved reports.
var lastDate = null;

if (fs.existsSync("./data/lastDate")) {
    try {
        lastDate = moment(fs.readFileSync("./data/lastDate", "utf8")).toDate();
        console.log("Last date:", lastDate);
    } catch (e) {
        console.warn("Erro ao dar fetch na data:", e);
    }
}

// Get updates from beatmap events
function fetchUpdates(data) {

    // Variable that will concatenate every request type
    let reqtypes = "";
    let types = data;
    let show_bancho_pop = data.show_bancho_pop;
    let _lastEvent;
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
    fetch(`https://osu.ppy.sh/beatmapsets/events?user=&${reqtypes}`).then(function (response) {
        return response.text();
    }).then(function (html) {
        var page = new JSSoup(html.toString())
        var allEventHTML = page.findAll("div", "beatmapset-event");
        allEventHTML.reverse();
        let x = 0;

        for (s of allEventHTML) {
            if (x>2)
                continue;
            // Parsing beatmap events
            let _sampletext = (s.text).toString();
            let _type = getType(_sampletext);
            let _date = moment(s.find("time").attrs.datetime).toDate();
            let _nextEvent = allEventHTML[x + 1];
            let _nextDate = moment(_nextEvent.find("time").attrs.datetime).toDate();
            if (moment(_date).isSameOrBefore(lastDate) && lastDate != null && !(_lastEvent == "nominate" && _type == "qualify")) {
                continue;
            }
            else {
                console.log("New event! Type", _type);
                if(_type == "nominate") {
                    if (getType(_nextEvent.text) == "qualify" && moment(_date).isSame(_nextDate)) {
                        console.log("Skiping nomination to qualify")
                        continue;
                    }
                }
            }
            if (_type == "unknown")
                console.log((s.text).toString());

            // Regex that finds the MapsetID/DiscussionPostID
            ids = s.find("a").attrs.href.match(/\/(\d+)+[\/]?/g).map(id => id.replace(/\//g, ''))
            let _mapsetID = ids[0];

            // Condition when it uses user_id
            if (_type == "nominate" || _type == "love") {
                let _userID = s.findAll("a", "user-name")[0].attrs["data-user-id"];
                let _discussionLink = s.find("a").attrs.href;
                
                // Call newNominate() function here
                if (_type == "nominate") {
                    newNominate({user_id: _userID, mapset_id: _mapsetID, qualify: false, history: null, "datetime": _date, "beatmaps": null})
                }
                // Call newLove() function here
                if (_type == "love") {
                    console.log("chegouOK", _type)

                }
            }

            //condition when it is triggered by default/ dq 
            if(_type == "nomination_reset" || _type == "disqualify") {
                if (ids.length > 1) {
                    let _dqTopic = `https://osu.ppy.sh/beatmapsets/${ids[0]}/discussion#/${ids[1]}`

                    //Request to the beatmap discussion, finding the issue that caused the disqualify.
                    fetch(`https://osu.ppy.sh/beatmapsets/${ids[0]}/discussion`).then(function (response) {
                        return response.text();
                    }).then(function (newhtml) {
                        let discussionPage = new JSSoup(newhtml.toString());
                        let jsons = discussionPage.findAll("script");
                        let jsonDiscussion = null;
                        for (scr of jsons) {
                            if (scr.attrs.id == "json-beatmapset-discussion") {
                                for (cont of scr.contents) {
                                    jsonDiscussion = cont._text;
                                }
                            }
                        }
                        let jsonparsed = JSON.parse(jsonDiscussion);
                        if (jsonparsed == null) {
                            console.log(discussionPage.toString());
                        }
                        let json_events = jsonparsed.beatmapset.events;
                        let json_discussions = jsonparsed.beatmapset.discussions;
                        let json_beatmapset = jsonparsed.beatmapset.beatmaps;
                        let _lastDisqualify = null;
                        let _lastReset = null;
                        let _reason = null;
                        let _history = [];
                        
                        //get nomination/dq/pop history
                        for (e of json_events) {
                            switch (e.type) {
                                case "rank":
                                    _rank = e;
                                    _history.push();
                                    break;
                                case "nominate":
                                    _lastNomination = e;
                                    _history.push(e);
                                    break;
                                case "nomination_reset":
                                    if (show_bancho_pop == true && e.user_id == 3)
                                        _history.push(e);
                                    else if (e.user_id != 3) {
                                        _lastReset = e;
                                        _history.push(e);
                                    }
                                    break;
                                case "disqualify":
                                    _lastDisqualify = e;
                                    _history.push(e);
                                    break;
                            }
                        }
                        for (d of json_discussions) {
                            if (d.posts == undefined)
                                continue;
                            //get the reason
                            for (let i = 0; i < d.posts.length; i++) {
                                if (_type == "disqualify") {
                                    if (d.posts[i].id == _lastDisqualify.comment.beatmap_discussion_post_id) 
                                        _reason = d.posts[i].message;
                                }
                                //
                                if (_type == "nomination_reset" && _lastReset != null) {
                                    if (d.posts[i].id == _lastReset.comment.beatmap_discussion_post_id) 
                                        _reason = d.posts[i].message;
                                }
                            }
                        }

                        // call newDisqualify() Function here
                        if (_type == "disqualify"){
                            //use _lastDisqualify
                        }

                        // call newReset() Function here
                        if (_type == "nomination_reset" && _lastReset != null){
                            console.log("chegouOK", _type)
                            
                        }
                    }).catch(function (err) {
                        console.warn('Error at discussions fetching: ', err);
                    });

                }
            }
            
            if (_type == "qualify" || _type == "rank") {
                //request discussion to find the nominate that triggered the qualify| Getting nomination history.
                fetch(`https://osu.ppy.sh/beatmapsets/${ids[0]}/discussion`).then(function (response) {
                        return response.text();
                    }).then(function (newhtml) {
                        let discussionPage = new JSSoup(newhtml.toString());
                        let jsons = discussionPage.findAll("script");
                        let jsonDiscussion = null;
                        for (scr of jsons) {
                            if (scr.attrs.id == "json-beatmapset-discussion") {
                                for (cont of scr.contents) {
                                    jsonDiscussion = cont._text;
                                }
                            }
                        }
                        let jsonparsed = JSON.parse(jsonDiscussion);
                        if (jsonparsed == null) {
                            console.log(discussionPage.toString());
                        }
                        let json_events = jsonparsed.beatmapset.events;
                        let json_beatmapset = jsonparsed.beatmapset.beatmaps;
                        let _rank = null;
                        let _lastNomination = null;
                        let _history = [];
                        for (e of json_events) {
                            switch (e.type) {
                                case "rank":
                                    _rank = e;
                                    _history.push();
                                    break;
                                case "nominate":
                                    _lastNomination = e;
                                    _history.push(e);
                                    break;
                                case "nomination_reset":
                                    if (show_bancho_pop == true && e.user_id == 3)
                                        _history.push(e);
                                    else if (e.user_id != 3)
                                        _history.push(e);
                                    break;
                                case "disqualify":
                                        _history.push(e);
                                    break;
                            }
                        }
                        // call newNominate() function here with is_qualify = true / history
                        if(_type == "qualify") {
                            newNominate({"user_id": _lastNomination.user_id, "mapset_id": _mapsetID, "qualify": true, "history": _history, "datetime": _date,"beatmaps": json_beatmapset})
                        }
                        // call newRank() function here with history
                        if(_type == "rank") {
                            console.log("chegouOK", _type)

                        }
                    }).catch(function (err) {
                        console.warn('Error at discussions fetching: ', err);
                    });
            }

            lastDate = _date;
            if (allEventHTML[allEventHTML.length - 1] == s) {
                fs.writeFileSync("./data/lastDate", moment.utc(lastDate).toString(), "utf8");
            }

            x++;
            _lastEvent = _type; 
        }
    }).catch(function (err) {
        console.warn('Something went wrong.', err);
    });
}

function start() {
    fetchUpdates({
        "disqualify": true,
        "nominate": true,
        "love": true,
        "rank": true,
        "qualify": true,
        "nomination_reset": true,
        "show_bancho_pop": false
    });
}

function getType(text) {
if (text.includes("Nominated"))
    return "nominate";
if (text.includes("Disqualified"))
    return "disqualify";
if (text.includes("has been qualified"))
    return "qualify";
if (text.includes("Ranked."))
    return "rank";
if (text.includes("Loved"))
    return "love";
if (text.includes("nomination reset."))
    return "nomination_reset";
}

// triggers when a nominate is happening
function newNominate(data = {
    "user_id": user_id,
    "mapset_id": mapset_id,
    "is_qualify": is_qualify,
    "history": history,
    "datetime": datetime,
    "beatmaps": beatmaps,
}) {
    console.log(data)
    osuApi.user.get(data.user_id).then((user) =>{
        console.log(data.beatmaps, "\n", user)
    }).catch(console.warn);
}

// triggers when a nominate is happening




start()
//setInterval(start, 60 * 1000);