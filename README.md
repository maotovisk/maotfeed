# maotfeed.js 
A discord webhook ~~badly~~ written in Node.JS, based on Aiess and [Phillip](https://github.com/rorre/Phillip).

Check out our [discord server](https://discord.gg/26hHK7E)

## What is it?
>MaotFeed is a live mapfeed that updates nominations, disqualifications, etc, from osu!.

![](https://i.imgur.com/WoiafND.png)

## Getting started
1. Get the WebHook URL and get the ID and the TOKEN:
`https://discordapp.com/api/webhooks/_ID_/_TOKEN_`
3. Create a .private directory and a new `keys.json` file inside it:
```json
{
    "OSU_TOKEN": "your_osu_api_token_here",
    "WEBHOOK_MAPFEED": {
        "ID": "webhook_id",
        "TOKEN": "webhook_token"
    },
    "WEBHOOK_GROUPFEED": {
        "ID": "webhook_id",
        "TOKEN": "webhook_token"
    }
}
```
4. `npm install` 

3. `npm start`

## Customizing

By default MaotFeed uses custom emotes that are required to be added to the server.
You can find them [here](https://github.com/maotovisk/maotfeed/issues/1), or you can create your own by just changing the emoji name at `options.json`.
