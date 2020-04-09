const   JSSoup = require('jssoup').default,
        fetch = require("node-fetch"),
        webhookHandler = require("./webhookHandler"),
        throttledQueue = require('throttled-queue'),
        options         = require("./../options.json"),
        moment          = require("moment");

//define the limit of requests per second
var throttle = throttledQueue(options.REQUEST_LIMIT, 1000)

// triggers to get discussion json and parse it
async function discussionRequest(s, ids, _date, _type, _mapsetID, show_bancho_pop) {
    await throttle(async function () {
        await fetch(`https://osu.ppy.sh/beatmapsets/${ids[0]}/discussion`).then(async function (response) {
            return response.text();
        }).then(async function (newhtml) {
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
            let json_mapset_info = {
                "artist": jsonparsed.beatmapset.artist,
                "title": jsonparsed.beatmapset.title,
                "creator": jsonparsed.beatmapset.creator,
                "creator_id": jsonparsed.beatmapset.user_id,
                "thumb": jsonparsed.beatmapset.covers["list@2x"]
            }
            let json_users = jsonparsed.beatmapset.related_users;
            let _lastDisqualify = null;
            let _lastNomination = null;
            let _lastReset = null;
            let _rank = null;
            let _reason = null;
            let _history = [];
            let _dqPost = null;
            let _isQualify = false;
            if (ids.length > 1) 
                _dqPost = `https://osu.ppy.sh/beatmapsets/${ids[0]}/discussion#/${ids[1]}`;
                 
            //get nomination/dq/pop history
            let indEve = 0;
            for (e of json_events) {
                switch (e.type) {
                    case "rank":
                        _rank = e;
                        _history.push();
                        break;
                    case "nominate":
                        _lastNomination = e;
                        if (indEve < json_events.length && json_events[indEve + 1] != undefined) {
                            if (json_events[indEve + 1].type == "qualify")
                                _lastNomination.type = "qualify";
                        }
                        _history.push(_lastNomination);
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
                indEve++;
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

            // call newReset() Function here
            if (_type == "nomination_reset" && _lastReset != null && moment(_lastReset.created_at).isSame(_date)) {
                webhookHandler.newEvent({
                    "user_id": _lastReset.user_id,
                    "mapset_id": _mapsetID,
                    "is_nominate": false,
                    "is_qualify": false,
                    "is_disqualify": false,
                    "is_love": false,
                    "is_reset": true,
                    "is_rank": false,
                    "history": _history,
                    "datetime": _date,
                    "beatmaps": json_beatmapset,
                    "users": json_users,
                    "mapset_info": json_mapset_info,
                    "reason": _reason,
                    "discussion_post": _dqPost
                })
            }
            // Condition when it uses user_id
            if (_type == "nominate" || _type == "love" || _type == "disqualify") {
                let _userID = s.findAll("a", "user-name")[0].attrs["data-user-id"];
                if (_lastNomination != null && _type== "nominate") {
                    if (_lastNomination.type == "qualify" && _lastNomination.user_id == _userID)
                        _isQualify = true;
                }

                // Call newNominate() function here
                if (_type == "nominate") {
                    webhookHandler.newEvent({
                        "user_id": _userID,
                        "mapset_id": _mapsetID,
                        "is_nominate": true,
                        "is_qualify": _isQualify,
                        "is_disqualify": false,
                        "is_love": false,
                        "is_reset": false,
                        "is_rank": false,
                        "history": _history,
                        "datetime": _date,
                        "beatmaps": json_beatmapset,
                        "users": json_users,
                        "mapset_info": json_mapset_info
                    })
                }
                // Call newLove() function here
                if (_type == "love") {
                    webhookHandler.newEvent({
                        "user_id": _userID,
                        "mapset_id": _mapsetID,
                        "is_nominate": false,
                        "is_qualify": false,
                        "is_disqualify": false,
                        "is_love": true,
                        "is_reset": false,
                        "is_rank": false,
                        "datetime": _date,
                        "beatmaps": json_beatmapset,
                        "users": json_users,
                        "mapset_info": json_mapset_info
                    })

                }
                // call newDisqualify() Function here
                if (_type == "disqualify") {
                    //use _lastDisqualify
                    webhookHandler.newEvent({
                        "user_id": _userID,
                        "mapset_id": _mapsetID,
                        "is_nominate": false,
                        "is_qualify": false,
                        "is_disqualify": true,
                        "is_love": false,
                        "is_reset": false,
                        "is_rank": false,
                        "history": _history,
                        "datetime": _date,
                        "beatmaps": json_beatmapset,
                        "users": json_users,
                        "mapset_info": json_mapset_info,
                        "reason": _reason,
                        "discussion_post": _dqPost
                    })

                }
            }
            
            // call newRank() function here with history
            if (_type == "rank") {
                webhookHandler.newEvent({
                    "mapset_id": _mapsetID,
                    "is_qualify": false,
                    "is_nominate": false,
                    "is_disqualify": false,
                    "is_love": false,
                    "is_reset": false,
                    "is_rank": true,
                    "history": _history,
                    "datetime": _date,
                    "beatmaps": json_beatmapset,
                    "users": json_users,
                    "mapset_info": json_mapset_info
                })
            }


        }).catch(async function (err) {
            console.warn('Error at discussions fetching: ', err);
        });
    })
}
module.exports = {discussionRequest}