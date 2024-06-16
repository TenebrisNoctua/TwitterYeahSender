'use strict';

var config
var imageData
const cache = []
const tweetCache = []

chrome.runtime.sendMessage("getConfig").then(response => {
    config = response
})
chrome.runtime.sendMessage("getImageURL").then(response => {
    imageData = response
})

function getCookie(cname) {
    var name = cname + "="
    var decodedCookie = decodeURIComponent(document.cookie)
    var ca = decodedCookie.split(';')
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i]
        while (c.charAt(0) == ' ') {
            c = c.substring(1)
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length)
        }
    }
    return ""
}

function readFile() {
    return new Promise(function (resolve, reject) {
        fetch(imageData)
            .then(response => response.blob())
            .then(blob => {
                const reader = new FileReader();
                reader.readAsArrayBuffer(blob)
                reader.onloadend = function () {
                    resolve(reader.result)
                }
            })
            .catch(error => console.error('Error:', error));
    })
}

async function sendAPIRequest(id, username) {
    const token = getCookie("ct0")
    const media_id_string = await uploadMedia(token)

    var url = `https://api.twitter.com/1.1/statuses/update.json?status=@${username}&in_reply_to_status_id=${id}&media_ids=${media_id_string}`
    var init = {
        method: 'POST',
        origin: 'https://twitter.com',
        headers: {
            "Accept": '*/*',
            "Authorization": config.Authorization,
            "Content-Type": "application/json",
            "x-csrf-token": token,
            "Cookie": ""
        },
        credentials: 'include',
        referrer: 'https://twitter.com'
    }

    const response = await fetch(url, init)
    const data = await response.json()
    if (response.ok) tweetCache.push({username: username, id: data.id_str})
}

function parseIdLink(idLink) {
    var end = idLink.indexOf('status/') + 7
    var newId = idLink.replace(idLink.substring(0, end), "")

    if (newId.includes("/photo/1")) { newId = newId.replace("/photo/1", "") }

    var usernameStart = idLink.indexOf('status/') - 1
    var usernameEnd = idLink.indexOf('com') + 4
    var username = idLink.replace(idLink.substring(usernameStart, undefined), "").replace(idLink.substring(0, usernameEnd), "")

    return [newId, username]
}

async function removeTweet(username) {
    const filterObj = tweetCache.filter(res => res.username == username)
    if (!filterObj[0]) return;

    const result = await deleteTweet(getCookie("ct0"), filterObj[0].id).catch(error => {})
    if (result) removeByValue(tweetCache, filterObj[0]);
}

function analyzeTweet(target) {
    var tweet = $(target).closest('article')
    if (!tweet.length) return;

    const iconsGroups = tweet.find('div[role="group"]')
    const likeButton = $(iconsGroups).children()[2]

    $(likeButton).on("click", function () {
        const idArray = $(tweet)[0].getElementsByTagName("a")
        var idLink;

        for (let idObject of idArray) {
            if (idObject.href.includes("/status/")) {
                idLink = idObject.href
                break;
            }
        }

        var parsedArray = parseIdLink(idLink)

        if ($(likeButton).children()[0].dataset.testid == "unlike") return removeTweet(parsedArray[1]);

        if (cache.filter(username => username.includes(parsedArray[1])).length >= 1) return;
        cache.push(parsedArray[1])

        sendAPIRequest(parsedArray[0], parsedArray[1])
    })
}

function removeFromCache(target) {
    var tweet = $(target).closest('article')
    if (!tweet.length) return;

    const idArray = $(tweet)[0].getElementsByTagName("a")
    var idLink;

    for (let idObject of idArray) {
        if (idObject.href.includes("/status/")) {
            idLink = idObject.href
            break;
        }
    }

    var parsedArray = parseIdLink(idLink)

    if (cache.filter(username => username.includes(parsedArray[1]).length <= 0)) return;
    cache = removeByValue(cache, parsedArray[1])
}

$(document).on('DOMNodeInserted', function (event) {
    const tweets = $(event.target).find('article')

    if (tweets.length) {
        tweets.each((index, element) => {
            analyzeTweet(element)
        })
    } else {
        analyzeTweet(event.target)
    }
})

$(document).on('DOMNodeRemoved', function (event) {
    const tweets = $(event.target).find('article')
    if (tweets.length) {
        tweets.each((index, element) => {
            removeFromCache(element)
        })
    } else {
        removeFromCache(event.target)
    }
})