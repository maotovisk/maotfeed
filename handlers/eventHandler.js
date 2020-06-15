const JSSoup = require('jssoup').default,
    fetch = require("node-fetch"),
    moment = require("moment"),
    fs = require("fs"),
    fsPromises = fs.promises,
    discussionHandler = require("./discussionHandler"),
    groupsJson = require("./../groups/groups.json"),
    utils = require("./../utils/utils"),
    webhookHandler = require("./../handlers/webhookHandler"),
    throttledQueue = require('throttled-queue'),
    options = require("./../options.json"),
    throttle = throttledQueue(options.REQUEST_LIMIT, 2000),
    hooman = require('hooman');


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

    let reqUrl = `https://osu.ppy.sh/beatmapsets/events?user=&${reqtypes}&min_date=&max_date=`;
    await hooman(reqUrl).then(async function (response) {
        return response.body;
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

            if (x < jsonEvents.length - 1 || _nextEvent != undefined)
                _nextDate = moment(_nextEvent.created_at);
            let _lastEventDate;
            if (x > 0)
                _lastEventDate = moment(_lastEvent.created_at);
            if (_date.isSameOrBefore(lastDate) && lastDate != null) {
                x++;
                continue;
            }
            console.log("New event!", _type, "at", _date.toDate().toUTCString());

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
        let currentDate = moment(jsonEvents[jsonEvents.length - 1].created_at).toDate();
        lastDate = currentDate;
        let currentJsonDate = { "datetime": currentDate.toUTCString() };
        fs.writeFileSync("./data/lastDate.json", JSON.stringify(currentJsonDate), "utf8");
        console.log("Finished fetching all events at", currentDate.toUTCString());
    }).catch(async function (err) {
        console.warn('Something went wrong.', err);
    });
}

async function fetchGroups() {
    let currentGroups = groupsJson.groups.filter(g => g.check == true);
    throttle(async function () {
        currentGroups.forEach( async userGroup => {
            console.log(`Fetching ${userGroup.title}...`)
            let reqUrl = `https://osu.ppy.sh/groups/${userGroup.id}`;
            hooman(reqUrl).then(async (response) => {
                return response.body;
            }).then(async (html) => {
                var page = new JSSoup(html.toString())
                let jsons = page.findAll("script");
                let jsonUsers = null;
                for (scr of jsons) {
                    if (scr.attrs.id == "json-users") {
                        for (cont of scr.contents) {
                            jsonUsers = JSON.parse(cont._text);
                        }
                    }
                }
                let parsedUsers = [];
                for (u of jsonUsers) {
                    let newUser = {
                        "username": u.username,
                        "id": u.id,
                        "country": u.country.code,
                        "group_id": u.groups[0].id,
                        "avatar_url": u.avatar_url
                    }
                    parsedUsers.push(newUser);
                }
                let newUsers = parsedUsers;

                console.log(`Finished fetching ${userGroup.title}...`);
                console.log(`Cheking for differences between group members...`);
                fs.exists(`./groups/${userGroup.filename}`, async (exists) => {
                    console.log(`GRUPO: ${userGroup.title}, `)
                    if (jsonUsers != null && exists == true) {
                        let oldUsers = JSON.parse(await fsPromises.readFile(`./groups/${userGroup.filename}`, ));
                        console.log(`OLD USERS: ${oldUsers.map(u => u.username).join(", ")}\nNEW USERS: ${newUsers.map(u => u.username).join(", ")}`)
                        let addedUsers = newUsers.filter((user) => {
                            let found = oldUsers.find(u => user.id == u.id);
                            if (found == undefined)
                                return true;
                            else
                                return false;
                        });
                        let removedUsers = oldUsers.filter((user) => {
                            let found = newUsers.find(u => user.id == u.id);
                            if (found == undefined)
                                return true;
                            else
                                return false;
                        });
                        if (addedUsers.filter(u => u.group_id == userGroup.id) == undefined) {
                            throw "Error matching groups";
                        }
                        if (removedUsers.length > 0) {
                            for (removedUser of removedUsers) {
                                webhookHandler.userRemoved({ "user": removedUser, "group": userGroup });
                            }
                        }

                        if (addedUsers.length > 0) {
                            for (addedUser of addedUsers) {
                                webhookHandler.userAdded({ "user": addedUser, "group": userGroup });
                            }
                        }
                        fsPromises.writeFile(`./groups/${userGroup.filename}`, JSON.stringify(newUsers), "utf8");
                        console.log(`Stats for ${userGroup.title}:\nUsers added: ${addedUsers.map((u) => u.username).join(", ")}\nUsers removed: ${removedUsers.map((u) => u.username).join(", ")}\n`)
                    } else {
                        console.log(`First time running, fetched all ${userGroup.title} data.`)
                        fsPromises.writeFile(`./groups/${userGroup.filename}`, JSON.stringify(newUsers), "utf8");
                    }
                });
            }).catch(async (err) => {
                console.warn('Something went wrong.', err);
            });
        });
    })
}



module.exports = { fetchUpdates, fetchGroups }