async function uploadMedia(token) {
    let initAttempts = 0
    let finalizeAttempts = 0
    let statusAttempts = 0

    const media = await readFile()

    function mediaINIT() {
        return new Promise(async function (resolve, reject) {
            if (initAttempts++ > 7) return reject("Failed to initialize media upload.");

            var URL = `https://upload.twitter.com/1.1/media/upload.json?command=INIT&total_bytes=${media.byteLength}&media_type=image/jpg`
            var init = {
                method: "POST",
                headers: {
                    "Accept": '*/*',
                    "Authorization": config.Authorization,
                    "Content-Type": "application/x-www-form-urlencoded",
                    "x-csrf-token": token,
                    "x-twitter-auth-type": "OAuth2Session"
                },
                credentials: 'include',
            }

            try {
                const response = await fetch(URL, init)
                if (!response.ok) {
                    console.warn('Network response was not ok: ' + response.statusText);

                    await timeOut(1500 * initAttempts);
                    return mediaINIT()
                } else {
                    const json = await response.json()
                    resolve(json.media_id_string)
                }
            } catch (error) {
                console.error('Error:', error);

                await timeOut(1500 * initAttempts);
                return mediaINIT()
            }
        })
    }
    function mediaAPPEND(id) {
        return new Promise(async function (resolve, reject) {
            let segments = []
            let segmentSize = 1084576
            let segmentCount = Math.ceil(media.byteLength / segmentSize)

            for (let i = 0; i < segmentCount; i++) {
                let segmentData = media.slice(i * segmentSize, (i + 1) * segmentSize)
                segments.push(segmentData)
            }

            for (let i in segments) {
                let segment = segments[i]
                let attempts = 0

                async function tryUploadingChunk() {
                    if (attempts++ > 7) return reject("Failed to append media upload chunk.");

                    let formData = new FormData();
                    formData.append("media", new Blob([segment], { type: "image/jpg" }));

                    var URL = `https://upload.twitter.com/1.1/media/upload.json?command=APPEND&media_id=${id}&segment_index=${i}`
                    var init = {
                        method: "POST",
                        headers: {
                            "Authorization": config.Authorization,
                            "x-csrf-token": token,
                            "x-twitter-auth-type": "OAuth2Session"
                        },
                        credentials: "include",
                        body: formData
                    }

                    try {
                        const response = await fetch(URL, init)
                        if (!response.ok) {
                            console.warn('Network response was not ok: ' + response.statusText);
                        } else {
                            response.text()
                        }
                    } catch (error) {
                        console.error('Error:', error);

                        await timeOut(1500 * initAttempts);
                        return tryUploadingChunk()
                    }
                }
                await tryUploadingChunk()
            }
            resolve(true)
        })
    }
    function mediaFINALIZE(id) {
        return new Promise(async function (resolve, reject) {
            if (finalizeAttempts++ > 7) return reject("Failed to finalize media upload.");

            var URL = `https://upload.twitter.com/1.1/media/upload.json?command=FINALIZE&media_id=${id}`
            var init = {
                method: "POST",
                headers: {
                    "Authorization": config.Authorization,
                    "Content-Type": "application/x-www-form-urlencoded",
                    "x-csrf-token": token,
                    "x-twitter-auth-type": "OAuth2Session"
                },
                credentials: 'include'
            }

            try {
                const response = await fetch(URL, init)
                if (!response.ok) {
                    console.warn('Network response was not ok: ' + response.statusText);

                    await timeOut(1500 * finalizeAttempts);
                    return mediaFINALIZE(id)
                } else {
                    const json = await response.json()
                    resolve(json)
                }
            } catch (error) {
                console.warn('Error:', error);

                await timeOut(1500 * finalizeAttempts);
                return mediaFINALIZE(id)
            }
        })
    }
    function mediaStatusCheck(id) {
        return new Promise(async function (resolve, reject) {
            if (statusAttempts++ > 7) return reject("Failed to check status of the media upload.");

            var URL = `https://upload.twitter.com/1.1/media/upload.json?command=STATUS&media_id=${id}`
            var init = {
                method: "POST",
                headers: {
                    "Authorization": config.Authorization,
                    "Content-Type": "application/x-www-form-urlencoded",
                    "x-csrf-token": token,
                    "x-twitter-auth-type": "OAuth2Session"
                },
                credentials: 'include'
            }

            try {
                const response = fetch(URL, init)
                if (!response.ok) {
                    console.warn('Network response was not ok: ' + response.statusText);

                    await timeOut(1500 * statusAttempts);
                    return mediaStatusCheck(id)
                } else {
                    const json = await response.json()
                    if (json.processing_info.state === "succeeded") {
                        resolve(json.media_id_string);
                    } else if (json.processing_info.state === "failed") {
                        if (json.processing_info.error.message) {
                            reject(json.processing_info.error.message);
                        } else {
                            reject(`Twitter API rejected the media with code ${json.processing_info.error.code} (${json.processing_info.error.name})`);
                        }
                    } else if (json.processing_info.state === "in_progress") {
                        if (!json.processing_info.check_after_secs && json.processing_info.error) {
                            if (json.processing_info.error.message) {
                                return reject(json.processing_info.error.message);
                            } else {
                                return reject(`Twitter API rejected the media with code ${json.processing_info.error.code} (${json.processing_info.error.name})`);
                            }
                        }
                        setTimeout(mediaStatusCheck, json.processing_info.check_after_secs * 1000, id);
                    }
                }
            } catch (error) {
                console.error('Error:', error);

                await timeOut(1500 * statusAttempts);
                return mediaStatusCheck(id)
            }
        })
    }

    const media_id = await mediaINIT()
    await mediaAPPEND(media_id)

    const finalize_res = await mediaFINALIZE(media_id)
    if (!finalize_res.processing_info) return media_id

    await mediaStatusCheck(media_id)

    return media_id
}

function deleteTweet(token, id) {
    return new Promise(async function (resolve, reject) {
        var URL = `https://api.twitter.com/1.1/statuses/destroy/${id}.json`
        var init = {
            method: "POST",
            headers: {
                "Accept": '*/*',
                "Authorization": config.Authorization,
                "Content-Type": "application/x-www-form-urlencoded",
                "x-csrf-token": token,
                "x-twitter-auth-type": "OAuth2Session"
            },
            credentials: 'include',
        }

        try {
            const response = await fetch(URL, init)
            if (!response.ok) {
                console.warn('Network response was not ok: ' + response.statusText);
                reject(response)
            } else {
                const json = await response.json()
                resolve(json)
            }
        } catch (error) {
            console.error('Error:', error);
            reject(error)
        }
    })
}