require('dotenv').config();
const path = require('path');
const fs = require('fs');
const rimraf = require('rimraf');
const Promise = require('bluebird');
const jimp = require('jimp');
const twitterApi = require('node-twitter-api');

const valentineDir = path.resolve(__dirname, 'valentines');
if (fs.existsSync(valentineDir)) {
    rimraf.sync(valentineDir);
}
fs.mkdirSync(valentineDir);

const twitter = Promise.promisifyAll(new twitterApi({
    consumerKey: process.env.CONSUMER_TOKEN,
    consumerSecret: process.env.CONSUMER_TOKEN_SECRET
}));

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
    return Promise.all(state.friends.map(user => generateValentine(user, state)))
        .then(() => state);
}

function generateValentine(user, state) {
    if (!state.baseBeaverImage) {
        return Promise.reject('beaver doesn\'t exist for some reason');
    }
    const name = (user['screen_name'] || 'my friend').toLowerCase();
    const filePath = getFilePathForUser(name);
    return jimp.loadFont(jimp.FONT_SANS_32_BLACK)
        .then((font) => {
            const beaver = state.baseBeaverImage.clone();
            beaver.print(font, 105, 240, name)
                .write(filePath);
            console.log('Generated valentine for', user['screen_name']);
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
    return Promise.all(state.friends.map(user => sendValentine(user, state)))
        .then(() => state)
        .catch(error => Promise.reject(error));
}

function sendValentine(user, state) {
    console.log('Sending valentine to', user['screen_name']);
    return twitter.uploadMediaAsync({ media: getFilePathForUser(user['screen_name']) }, process.env.ACCESS_TOKEN, process.env.ACCESS_TOKEN_SECRET)
        .then((response) => {
            const mediaId = response['media_id'];
            if (!mediaId) {
                return Promise.reject();
            }
            return twitter.statusesAsync(
                'update',
                { status: `@${user['screen_name']} Happy Valentine's Day ya goof`, 'media_ids': mediaId },
                process.env.ACCESS_TOKEN,
                process.env.ACCESS_TOKEN_SECRET
            );
        })
        .catch(error => Promise.reject(error));
}

(function main() {
    // step 1 - load the picture
    loadValentine({})
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