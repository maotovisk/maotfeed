const Discord = require("discord.js"),
    JSSoup = require('jssoup').default,
    fetch = require("node-fetch"),
    moment = require("moment"),
    fs = require("fs"),
    osu = require("nodesu"),
    throttledQueue = require('throttled-queue');


const WEBHOOK_CREDENTIALS = require("./.private/keys.json").WEBHOOK;

//WebHook
const webhookClient = new Discord.WebhookClient(WEBHOOK_CREDENTIALS.ID, WEBHOOK_CREDENTIALS.TOKEN);

//define the limit of requests per second
var throttle = throttledQueue(2, 1000)

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
async function fetchUpdates(data) {

    console.log("Fetching updates...")
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
    await fetch(`https://osu.ppy.sh/beatmapsets/events?user=&${reqtypes}`).then(async function (response) {
        return response.text();
    }).then(async function (html) {
        var page = new JSSoup(html.toString())
        var allEventHTML = page.findAll("div", "beatmapset-event");
        allEventHTML.reverse();
        let x = 0;

        for (var s of allEventHTML) {
            // Parsing beatmap events
            let _type = getType(s.text);
            let _date = moment(s.find("time").attrs.datetime);
            let _nextEvent = allEventHTML[x + 1];
            let _lastEvent;
            if (x > 0)
                _lastEvent = allEventHTML[x - 1];
            let _nextDate;
            let _isQualify = false;

            if (x < allEventHTML.length - 1|| _nextEvent != undefined)
                _nextDate = moment(_nextEvent.find("time").attrs.datetime);
            let _lastEventDate;
            if (x > 0)
                _lastEventDate = moment(_lastEvent.find("time").attrs.datetime);
            if (_date.isSameOrBefore(lastDate) && lastDate != null) {
                x++;
                continue;
            } else {
                console.log("New event! Type", _type);
                if (_type == "nominate" && x < (allEventHTML.length - 1)) {
                    /*if (getType(_nextEvent.text) == "qualify" && _date.isSame(_nextDate)) {
                        _isQualify == true;
                        console.log("Triggering a qualified nomination...");
                    }*/
                }
            }
            if (_type == "unknown")
                console.log((s.text).toString());

            // Regex that finds the MapsetID/DiscussionPostID
            ids = s.find("a").attrs.href.match(/\/(\d+)+[\/]?/g).map(id => id.replace(/\//g, ''))
            let _mapsetID = ids[0];


            //condition when it is triggered by default/ dq 

            //Request to the beatmap discussion, finding the issue that caused the disqualify.
            discussionRequest(s, ids, _date, _type, _mapsetID, show_bancho_pop);
            x++;
        }
        lastDate = moment(allEventHTML[allEventHTML.length - 1].find("time").attrs.datetime).toDate();
        fs.writeFileSync("./data/lastDate", moment(lastDate).toString(), "utf8");
        console.log(lastDate)
    }).catch(async function (err) {
        console.warn('Something went wrong.', err);
    });
}

async function start() {
    await fetchUpdates({
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
    if (text.includes("Nominated by"))
        return "nominate";
    if (text.includes("Disqualified by"))
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
function newEvent(data = {
    "user_id": user_id,
    "mapset_id": mapset_id,
    "mapset_info": mapset_info,
    "is_qualify": is_qualify,
    "is_nominate": is_nominate,
    "is_disqualify": is_disqualify,
    "is_reset": is_reset,
    "is_rank": is_rank,
    "is_love": is_love,
    "history": history,
    "datetime": datetime,
    "beatmaps": beatmaps,
    "users": users,
    "reason": reason,
    "discussion_post": discussion_post
}) {
    try {
        let diffs = [];
        let modes = [];
        for (diff of data.beatmaps) {
            if (diff.difficulty_rating == 0 || diff.deleted_at != null)
                continue;
            diffs.push({
                "diffname": diff.version,
                "star_rating": diff.difficulty_rating,
                "diff": getMapDifficulty(diff.difficulty_rating),
                "diff_emoji": getMapDifficultyEmoji(diff.difficulty_rating)
            })
            if (diff.mode == "osu")
                modes.push("[osu]")
            if (diff.mode == "catch")
                modes.push("[catch]")
            if (diff.mode == "mania")
                modes.push("[mania]")
            if (diff.mode == "taiko")
                modes.push("[taiko]")
        }
        diffs.sort(function (a, b) {
            return a.star_rating - b.star_rating;
        })

        let cleanModes = modes.filter(function (elem, index, self) {
            return index === self.indexOf(elem);
        })

        let listModes = "";
        for (m of cleanModes) {
            listModes += m;
        }

        let nominator = null;
        for (u of data.users) {
            if (data.user_id == u.id) {
                if (u.group_badge.identifier == "bng_limited") {
                    nominator = {
                        "name": u.username,
                        "badge": "PROBATION",
                        "id": u.id,
                        "avatar_url": u.avatar_url
                    }
                } else {
                    nominator = {
                        "name": u.username,
                        "badge": u.group_badge.short_name,
                        "id": u.id,
                        "avatar_url": u.avatar_url
                    } 
                }
            }
        }
        let beautyDiffs = "";
        for (d of diffs) {
            beautyDiffs += (d.diff_emoji + `(${d.star_rating}★)  `);
        }
        let histoBeauty = "";
        if (data.history != undefined) {
            for (eve of data.history) {
                switch (eve.type) {
                    case "qualify":
                        histoBeauty += `:heart: ${getUserFromList(eve.user_id, data.users).name} [**${getUserFromList(eve.user_id, data.users).badge}**]  `;
                        break;
                    case "nominate":
                        histoBeauty += `:thought_balloon: ${getUserFromList(eve.user_id, data.users).name} [**${getUserFromList(eve.user_id, data.users).badge}**]  `;
                        break;
                    case "nomination_reset":
                        histoBeauty += `:anger_right: ${getUserFromList(eve.user_id, data.users).name} [**${getUserFromList(eve.user_id, data.users).badge}**]  `;
                        break;
                    case "disqualify":
                        histoBeauty += `:broken_heart:  ${getUserFromList(eve.user_id, data.users).name} [**${getUserFromList(eve.user_id, data.users).badge}**]  `;
                        break;
                }
            }
        }
        if (data.is_nominate && data.is_qualify == false) {
            let msg = new Discord.MessageEmbed().setThumbnail(data.mapset_info.thumb)
                .addField(`:thought_balloon:  Nominated`, `[${data.mapset_info.artist} - ${data.mapset_info.title}](https://osu.ppy.sh/beatmapsets/${data.mapset_id})\nMapped by [${data.mapset_info.creator}](https://osu.ppy.sh/users/${data.mapset_info.creator_id}) **${listModes}**\n\n${beautyDiffs}`)
                .setFooter(`${nominator.name} [${nominator.badge}]`, nominator.avatar_url)
                .setColor(Discord.Constants.Colors.AQUA);
            webhookClient.send(`https://osu.ppy.sh/beatmapsets/${data.mapset_id}`, {
                embeds: [msg],
            });

        } else if (data.is_qualify && data.is_nominate) {
            let msg = new Discord.MessageEmbed().setThumbnail(data.mapset_info.thumb)
                .addField(`:heart:  Qualified`, `[${data.mapset_info.artist} - ${data.mapset_info.title}](https://osu.ppy.sh/beatmapsets/${data.mapset_id})\nMapped by [${data.mapset_info.creator}](https://osu.ppy.sh/users/${data.mapset_info.creator_id}) **${listModes}**\n\n${beautyDiffs}\n\n${histoBeauty}`)
                .setFooter(`${nominator.name} [${nominator.badge}]`, nominator.avatar_url)
                .setColor(Discord.Constants.Colors.RED);

            webhookClient.send(`https://osu.ppy.sh/beatmapsets/${data.mapset_id}`, {
                embeds: [msg],
            });
        } else if (data.is_reset) {
            let _reason = data.reason;
            if (_reason.length > 128)
                _reason = _reason.substring(0, 127) + "...";
            let msg = new Discord.MessageEmbed().setThumbnail(data.mapset_info.thumb)
                .addField(`:anger_right:  Nomination Reset`, `[${data.mapset_info.artist} - ${data.mapset_info.title}](https://osu.ppy.sh/beatmapsets/${data.mapset_id})\nMapped by [${data.mapset_info.creator}](https://osu.ppy.sh/users/${data.mapset_info.creator_id}) **${listModes}**\n\n${beautyDiffs}\n\n${histoBeauty}`)
                .setFooter(`${nominator.name} [${nominator.badge}] - "${_reason}"`, nominator.avatar_url)
                .setColor(Discord.Constants.Colors.GREY);

            webhookClient.send(`${data.discussion_post}`, {
                embeds: [msg],
            });
        } else if (data.is_rank) {
            let msg = new Discord.MessageEmbed().setThumbnail(data.mapset_info.thumb)
                .addField(`:sparkling_heart:  Ranked`, `[${data.mapset_info.artist} - ${data.mapset_info.title}](https://osu.ppy.sh/beatmapsets/${data.mapset_id})\nMapped by [${data.mapset_info.creator}](https://osu.ppy.sh/users/${data.mapset_info.creator_id}) **${listModes}**\n\n${beautyDiffs}\n\n${histoBeauty}`)
                .setColor(Discord.Constants.Colors.DARK_GREEN);

            webhookClient.send(`https://osu.ppy.sh/beatmapsets/${data.mapset_id}`, {
                embeds: [msg],
            });
        } else if (data.is_disqualify) {
            let _reason = data.reason;
            if (_reason.length > 128)
                _reason = _reason.substring(0, 127) + "...";
            let msg = new Discord.MessageEmbed().setThumbnail(data.mapset_info.thumb)
                .addField(`:broken_heart:  Disqualified`, `[${data.mapset_info.artist} - ${data.mapset_info.title}](https://osu.ppy.sh/beatmapsets/${data.mapset_id})\nMapped by [${data.mapset_info.creator}](https://osu.ppy.sh/users/${data.mapset_info.creator_id}) **${listModes}**\n\n${beautyDiffs}\n\n${histoBeauty}`)
                .setFooter(`${nominator.name} [${nominator.badge}] - "${_reason}"`, nominator.avatar_url)
                .setColor(Discord.Constants.Colors.RED);

            webhookClient.send(`${data.discussion_post}`, {
                embeds: [msg],
            });
        } else if (data.is_love) {
            let msg = new Discord.MessageEmbed().setThumbnail(data.mapset_info.thumb)
                .addField(`:heart:  Loved`, `[${data.mapset_info.artist} - ${data.mapset_info.title}](https://osu.ppy.sh/beatmapsets/${data.mapset_id})\nMapped by [${data.mapset_info.creator}](https://osu.ppy.sh/users/${data.mapset_info.creator_id}) **${listModes}**\n\n${beautyDiffs}`)
                .setFooter(`${nominator.name} [${nominator.badge}]`, nominator.avatar_url)
                .setColor(Discord.Constants.Colors.LUMINOUS_VIVID_PINK);

            webhookClient.send(`https://osu.ppy.sh/beatmapsets/${data.mapset_id}`, {
                embeds: [msg],
            });
        }
    } catch (e) {
        console.log("Error:", e);
    }
}









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
            if (_type == "nomination_reset" && _lastReset != null) {
                await newEvent({
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
                    newEvent({
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
                    await newEvent({
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
                    newEvent({
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
            // call newNominate() function here with is_qualify = true / history
            /*if (_type == "qualify") {
                newEvent({
                    "user_id": _lastNomination.user_id,
                    "mapset_id": _mapsetID,
                    "is_qualify": true,
                    "is_nominate": false,
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
            }*/
            // call newRank() function here with history
            if (_type == "rank") {
                newEvent({
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

function getUserFromList(id, userlist) {
    for (user of userlist) {
        if (id == user.id) {
            if (user.group_badge.identifier == "bng_limited") {
                return {
                "name": user.username,
                "badge": "PBN"
            };
            }
             else {
                return {
                    "name": user.username,
                    "badge": user.group_badge.short_name
                };
             }
        }
    }
}

start()
setInterval(start, 60 * 1000);

//utils

function getMapDifficulty(diff) {

    if (diff >= 0 && diff < 2)
        return "Easy";
    if (diff >= 2 && diff <= 2.69)
        return "Normal";
    if (diff >= 2.7 && diff <= 3.99)
        return "Hard";
    if (diff >= 4 && diff <= 5.29)
        return "Insane"
    if (diff >= 5.3 && diff < 6.5)
        return "Expert";
    if (diff >= 6.5)
        return "Expert+";
}

function getMapDifficultyEmoji(diff) {

    if (diff >= 0 && diff < 2)
        return ":green_circle:";
    if (diff >= 2 && diff <= 2.69)
        return ":blue_circle:";
    if (diff >= 2.7 && diff <= 3.99)
        return ":yellow_circle:";
    if (diff >= 4 && diff <= 5.29)
        return ":red_circle:"
    if (diff >= 5.3 && diff < 6.5)
        return ":purple_circle:";
    if (diff >= 6.5)
        return ":black_circle:";
}
