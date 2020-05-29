const Discord = require("discord.js"),
    utils = require("./../utils/utils"),
    options         = require("./../options.json");

const clients = require("./../.private/clients.json");

//WebHook
/*const webhookClientMapfeed = new Discord.WebhookClient(WEBHOOK_CREDENTIALS.WEBHOOK_MAPFEED.ID, WEBHOOK_CREDENTIALS.WEBHOOK_MAPFEED.TOKEN),
 webhookClientGroupfeed = new Discord.WebhookClient(WEBHOOK_CREDENTIALS.WEBHOOK_GROUPFEED.ID, WEBHOOK_CREDENTIALS.WEBHOOK_GROUPFEED.TOKEN);
*/

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
        for (webHook of clients.clients){
            let webhookClientMapfeed = new Discord.WebhookClient(webHook.WEBHOOK_MAPFEED.ID, webHook.WEBHOOK_MAPFEED.TOKEN);
            let diffs = [];
            let modes = [];
            for (var diff of data.beatmaps) {
                if (diff.difficulty_rating == 0 || diff.deleted_at != null)
                    continue;
                diffs.push({
                    "diffname": diff.version,
                    "star_rating": diff.difficulty_rating,
                    "diff": utils.getMapDifficulty(diff.difficulty_rating),
                    "diff_emoji": webHook.emojis[utils.getMapDifficultyEmoji(diff.difficulty_rating)]
                })
                if (diff.mode == "osu" && !modes.includes("[osu]"))
                    modes.push("[osu]")
                if (diff.mode == "fruits" && !modes.includes("[catch]"))
                    modes.push("[catch]")
                if (diff.mode == "mania" && !modes.includes("[mania]"))
                    modes.push("[mania]")
                if (diff.mode == "taiko" && !modes.includes("[taiko]"))
                    modes.push("[taiko]")
            }
            diffs.sort(function (a, b) {
                return a.star_rating - b.star_rating;
            })

            let listModes = "";
            for (var i = 0; i < modes.length; i++) {
                listModes += modes[i];
            }

            let nominator = null;
            for (u of data.users) {
                if (data.user_id == u.id) {
                    if (u.groups[0].identifier == "bng_limited") {
                        nominator = {
                            "name": u.username,
                            "badge": "PROBATION",
                            "id": u.id,
                            "avatar_url": u.avatar_url
                        }
                    } else {
                        nominator = {
                            "name": u.username,
                            "badge": u.groups[0].short_name,
                            "id": u.id,
                            "avatar_url": u.avatar_url
                        } 
                    }
                }
            }
            let diffList = "\n\n";
            for (d of diffs) {
                diffList += `${d.diff_emoji}`;
            }
            if (webHook.SHOW_DIFFS == false) {
                diffList = "";
            }
            let mapHistory = "";
            if (data.history != undefined) {
                for (eve of data.history) {
                    switch (eve.type) {
                        case "qualify":
                            if (webHook.SHOW_BADGES === false)
                                mapHistory += `:heart: ${utils.getUserFromList(eve.user_id, data.users).name}  `;
                            else
                                mapHistory += `:heart: ${utils.getUserFromList(eve.user_id, data.users).name} [**${utils.getUserFromList(eve.user_id, data.users).badge}**]  `;                        
                            break;
                        case "nominate":
                            if (webHook.SHOW_BADGES === false)
                                mapHistory += `:thought_balloon: ${utils.getUserFromList(eve.user_id, data.users).name}  `;
                            else
                                mapHistory += `:thought_balloon: ${utils.getUserFromList(eve.user_id, data.users).name} [**${utils.getUserFromList(eve.user_id, data.users).badge}**]  `;
                            break;
                        case "nomination_reset":
                            if (webHook.SHOW_BADGES === false)
                                mapHistory += `:anger_right: ${utils.getUserFromList(eve.user_id, data.users).name}  `;
                            else
                                mapHistory += `:anger_right: ${utils.getUserFromList(eve.user_id, data.users).name} [**${utils.getUserFromList(eve.user_id, data.users).badge}**]  `;
                            break;
                        case "disqualify":
                            if (webHook.SHOW_BADGES === false)
                                mapHistory += `:broken_heart:  ${utils.getUserFromList(eve.user_id, data.users).name}  `;
                            else 
                                mapHistory += `:broken_heart:  ${utils.getUserFromList(eve.user_id, data.users).name} [**${utils.getUserFromList(eve.user_id, data.users).badge}**]   `;
                            break;
                    }
                }
            }
            if (data.is_nominate && data.is_qualify == false) {
                let msg = new Discord.MessageEmbed().setThumbnail(data.mapset_info.thumb)
                    .addField(`:thought_balloon:  Nominated`, `[${data.mapset_info.artist} - ${data.mapset_info.title}](https://osu.ppy.sh/beatmapsets/${data.mapset_id})\nMapped by [${data.mapset_info.creator}](https://osu.ppy.sh/users/${data.mapset_info.creator_id}) **${listModes}**${diffList}`, false)
                    .setFooter(`${nominator.name} [${nominator.badge}]`, nominator.avatar_url)
                    .setColor(Discord.Constants.Colors.AQUA);
                webhookClientMapfeed.send(`https://osu.ppy.sh/beatmapsets/${data.mapset_id}`, {
                    embeds: [msg],
                });

            } else if (data.is_qualify && data.is_nominate) {
                let msg = new Discord.MessageEmbed().setThumbnail(data.mapset_info.thumb)
                    .addField(`:heart:  Qualified`, `[${data.mapset_info.artist} - ${data.mapset_info.title}](https://osu.ppy.sh/beatmapsets/${data.mapset_id})\nMapped by [${data.mapset_info.creator}](https://osu.ppy.sh/users/${data.mapset_info.creator_id}) **${listModes}**${diffList}\n\n${mapHistory}`, false)
                    .setFooter(`${nominator.name} [${nominator.badge}]`, nominator.avatar_url)
                    .setColor(Discord.Constants.Colors.RED);

                webhookClientMapfeed.send(`https://osu.ppy.sh/beatmapsets/${data.mapset_id}`, {
                    embeds: [msg],
                });
            } else if (data.is_reset) {
                let _reason = data.reason;
                if (_reason.length > 53)
                    _reason = _reason.substring(0, 52) + "...";
                let msg = new Discord.MessageEmbed().setThumbnail(data.mapset_info.thumb)
                    .addField(`:anger_right:  Nomination Reset`, `[${data.mapset_info.artist} - ${data.mapset_info.title}](https://osu.ppy.sh/beatmapsets/${data.mapset_id})\nMapped by [${data.mapset_info.creator}](https://osu.ppy.sh/users/${data.mapset_info.creator_id}) **${listModes}**${diffList}\n\n${mapHistory}`, false)
                    .setFooter(`${nominator.name} [${nominator.badge}] - "${_reason}"`, nominator.avatar_url)
                    .setColor(Discord.Constants.Colors.GREY);

                webhookClientMapfeed.send(`${data.discussion_post}`, {
                    embeds: [msg],
                });
            } else if (data.is_rank) {
                let msg = new Discord.MessageEmbed().setThumbnail(data.mapset_info.thumb)
                    .addField(`:sparkling_heart:  Ranked`, `[${data.mapset_info.artist} - ${data.mapset_info.title}](https://osu.ppy.sh/beatmapsets/${data.mapset_id})\nMapped by [${data.mapset_info.creator}](https://osu.ppy.sh/users/${data.mapset_info.creator_id}) **${listModes}**${diffList}\n\n${mapHistory}`, false)
                    .setColor(Discord.Constants.Colors.DARK_GREEN);

                webhookClientMapfeed.send(`https://osu.ppy.sh/beatmapsets/${data.mapset_id}`, {
                    embeds: [msg],
                });
            } else if (data.is_disqualify) {
                let _reason = data.reason;
                if (_reason.length > 53)
                    _reason = _reason.substring(0, 52) + "...";
                let msg = new Discord.MessageEmbed().setThumbnail(data.mapset_info.thumb)
                    .addField(":broken_heart:  Disqualified", `[${data.mapset_info.artist} - ${data.mapset_info.title}](https://osu.ppy.sh/beatmapsets/${data.mapset_id})\nMapped by [${data.mapset_info.creator}](https://osu.ppy.sh/users/${data.mapset_info.creator_id}) **${listModes}**${diffList}\n\n${mapHistory}`)
                    .setFooter(`${nominator.name} [${nominator.badge}] - "${_reason}"`, nominator.avatar_url)
                    .setColor(Discord.Constants.Colors.RED);

                webhookClientMapfeed.send(`${data.discussion_post}`, {
                    embeds: [msg],
                });
            } else if (data.is_love) {
                let msg = new Discord.MessageEmbed().setThumbnail(data.mapset_info.thumb)
                    .addField(`:heart:  Loved`, `[${data.mapset_info.artist} - ${data.mapset_info.title}](https://osu.ppy.sh/beatmapsets/${data.mapset_id})\nMapped by [${data.mapset_info.creator}](https://osu.ppy.sh/users/${data.mapset_info.creator_id}) **${listModes}**${diffList}`, false)
                    .setFooter(`${nominator.name} [${nominator.badge}]`, nominator.avatar_url)
                    .setColor(Discord.Constants.Colors.LUMINOUS_VIVID_PINK);

                webhookClientMapfeed.send(`https://osu.ppy.sh/beatmapsets/${data.mapset_id}`, {
                    embeds: [msg],
                });
            }
        }
    } catch (e) {
        console.log("Error:", e);
    }
}
async function userRemoved(data = {"user": user, "group": group }) {
    for (webHook of clients.clients) {
        let webhookClientGroupfeed = new Discord.WebhookClient(webHook.WEBHOOK_GROUPFEED.ID, webHook.WEBHOOK_GROUPFEED.TOKEN);
        let msg = new Discord.MessageEmbed().setThumbnail(data.user.avatar_url)
        .addField(`:arrow_down: Removed`,`:flag_${data.user.country.toLowerCase()}: [${data.user.username}](https://osu.ppy.sh/users/${data.user.id}) \nhas been removed from [${data.group.title}](https://osu.ppy.sh/groups/${data.group.id})`)
        .setColor(`${data.group.color}`);
        webhookClientGroupfeed.send(msg);
    }
}

async function userAdded(data = {"user": user, "group": group }) {
    for (webHook of clients.clients) {
        let msg = new Discord.MessageEmbed().setThumbnail(data.user.avatar_url)
        .addField(`:arrow_up: Added`,`:flag_${data.user.country.toLowerCase()}: [${data.user.username}](https://osu.ppy.sh/users/${data.user.id}) \nhas been added to [${data.group.title}](https://osu.ppy.sh/groups/${data.group.id})`)
        .setColor(`${data.group.color}`);
        webhookClientGroupfeed.send(msg);
    }
}

module.exports = {newEvent, userRemoved, userAdded}
