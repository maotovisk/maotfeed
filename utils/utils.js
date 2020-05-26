
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

function getUserFromList(id, userlist) {
    try {
    for (user of userlist) {
        if (id == user.id) {
            if (user.group_badge == undefined){
                return {
                    "name": user.username,
                    "badge": "EX-BN"
                };
            }
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
} catch (e)
{   
    console.log("Erro:",e,id, userlist);
}

}

function getMapDifficultyEmoji(diff) {

    if (diff >= 0 && diff < 2)
        return "easy";
    if (diff >= 2 && diff <= 2.69)
        return "normal";
    if (diff >= 2.7 && diff <= 3.99)
        return "hard";
    if (diff >= 4 && diff <= 5.29)
        return "insane";
    if (diff >= 5.3 && diff < 6.5)
        return "extra";
    if (diff >= 6.5)
        return "extreme";
}

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


module.exports = {getType, getMapDifficulty, getMapDifficultyEmoji, getUserFromList}
