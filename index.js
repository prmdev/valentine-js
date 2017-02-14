require('dotenv').config();
const Promise = require('bluebird');
const path = require('path');
const fs = Promise.promisifyAll(require('fs'));
const rimraf = Promise.promisify(require('rimraf'));
const jimp = require('jimp');
const twitterApi = require('node-twitter-api');

const tempDir = path.resolve(__dirname, '.tmp');
const valentineDir = path.resolve(tempDir, 'valentines');

const messages = ['Happy Valentine\'s Day, nerd']

const twitter = Promise.promisifyAll(new twitterApi({
    consumerKey: process.env.CONSUMER_TOKEN,
    consumerSecret: process.env.CONSUMER_TOKEN_SECRET
}));

function setupWorkingDirectory() {
    return cleanTempDirectory().then(() => fs.mkdirAsync(tempDir)).then(() => fs.mkdirAsync(valentineDir));
}

function cleanTempDirectory() {
    return rimraf(tempDir);
}

function loadValentine(state) {
    console.log('Loading in valentine image file...');
    return jimp.read('beaver.jpg')
        .then((beaver) => {
            console.log('Successfully loaded image');
            state.baseBeaverImage = beaver.clone();
            return state;
        })
        .catch(error => Promise.reject(error));
}

function loginToTwitter(state) {
    console.log('Logging in to Twitter...');
    return twitter.verifyCredentialsAsync(process.env.ACCESS_TOKEN, process.env.ACCESS_TOKEN_SECRET, null)
        .then((data, response) => {
            console.log('Logged in to Twitter successfully');
            state.user = data;
            return state;
        })
        .catch(error => Promise.reject(error));
}

function loadTwitterFriends(state) {
    console.log('Fetching all Twitter friends...');
    return twitter.followersAsync('list', { count: 100 }, process.env.ACCESS_TOKEN, process.env.ACCESS_TOKEN_SECRET)
        .then((data, response) => {
            state.friends = data.users.filter(user => user.following);
            console.log('Fetched all', state.friends.length, 'Twitter friends');
            return state;
        })
        .catch(error => Promise.reject(error));
}

function generateValentines(state) {
    console.log('Generating valentines...');
    return Promise.map(state.friends, user => generateValentine(user, state))
        .then(() => state);
}

function generateValentine(user, state) {
    if (!state.baseBeaverImage) {
        return Promise.reject('beaver doesn\'t exist for some reason');
    }
    const username = user['screen_name'];
    const filePath = getFilePathForUser(username);
    const name = username.toLowerCase();
    return new Promise((resolve, reject) => {
        jimp.loadFont(jimp.FONT_SANS_32_BLACK)
            .then((font) => {
                const beaver = state.baseBeaverImage.clone();
                beaver.print(font, 105, 240, name)
                    .write(filePath, (error, image) => {
                        if (error) {
                            reject(error);
                            return;
                        }
                        console.log('Generated valentine for', username);
                        resolve(state);
                    });
            });
    });
}

function getFilePathForUser(user) {
    let name;
    if (typeof user === 'object' && user['screen_name']) {
        name = user['screen_name'];
    } else {
        name = user;
    }
    return path.resolve(valentineDir, name + '.jpg')
}

function sendValentines(state) {
    console.log('Sending valentines...');
    return Promise.map(state.friends, user => sendValentine(user, state))
        .then(() => state)
        .catch(error => Promise.reject(error));
}

function sendValentine(user, state) {
    const username = user['screen_name'];
    const message = getRandomMessage(username);
    console.log('Sending valentine to', username, `"${message}"`);
    const filepath = getFilePathForUser(username);
    return twitter.uploadMediaAsync({ media: filepath }, process.env.ACCESS_TOKEN, process.env.ACCESS_TOKEN_SECRET)
        .then((response) => {
            const mediaId = response['media_id_string'];
            if (!mediaId) {
                return Promise.reject('No media id');
            }
            return twitter.statusesAsync(
                'update',
                { status: message, 'media_ids': mediaId },
                process.env.ACCESS_TOKEN,
                process.env.ACCESS_TOKEN_SECRET
            );
        })
        .catch(error => Promise.reject(error));
}

function getRandomMessage(username) {
    const index = Math.floor(Math.random() * messages.length);
    const message = messages[index];
    return `@${username} ${message}`;
}

(function main() {
    setupWorkingDirectory()
        // step 1 - load the picture
        .then(() => loadValentine({}))
        // step 2 - load the friends
        .then(loginToTwitter)
        .then(loadTwitterFriends)
        // step 3 - create the valentines from the friends list and the picture
        .then(generateValentines)
        // step 4 - send out the valentines
        .then(sendValentines)
        .then(() => console.log('done :)'))
        .then(() => process.exit(0))
        .catch((reason) => {
            console.error(reason);
            process.exit(1);
        });
})();