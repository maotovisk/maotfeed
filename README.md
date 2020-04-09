# maotfeed.js 
>A discord webhook ~~badly~~ written in Node.JS, based on Aiess and [Phillip](https://github.com/rorre/Phillip).

## What is it?
>MaotFeed is a live mapfeed that updates nominations, disqualifications, etc, from osu!.

![](https://i.imgur.com/w6keFC5.png)

## Setting up
1. Get the WebHook URL and get the ID and the TOKEN:
`https://discordapp.com/api/webhooks/_ID_/_TOKEN_`
3. Create a .private directory and a new `keys.json` file inside it:
```json
{
    "OSU_TOKEN": "your_osu_api_token_here",
    "WEBHOOK": {
        "ID": "webhook_id",
        "TOKEN": "webhook_token"
    }
}
```
4. `npm install` 

3. `npm start`
