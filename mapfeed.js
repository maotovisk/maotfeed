const   moment          = require("moment"),
        fs              = require("fs"),
        eventHandler    = require("./handlers/eventHandler"),
        options         = require("./options.json");

//Check the last datetime of recieved reports.
var lastDate = null;
 



async function start() {
    if (fs.existsSync("./data/lastDate")) {
        try {
            lastDateJson = JSON.parse(fs.readFileSync("./data/lastDate.json", "utf8"));
            lastDate = moment(lastDateJson.datetime);
            console.log("Last date:", lastDate);
        } catch (e) {
            console.warn("Erro ao dar fetch na data:", e);
        }
    }
    await eventHandler.fetchUpdates({
        "disqualify": true,
        "nominate": true,
        "love": true,
        "rank": true,
        "qualify": true,
        "nomination_reset": true,
        "show_bancho_pop": false,
        "lastDate": lastDate
    });
    
    await eventHandler.fetchGroups();
}




//start funcion here
start()
setInterval(start, options.REQUEST_PERIODICITY* 1000);


