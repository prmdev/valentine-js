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

let baseBeaverImage = null;
function loadValentine(name) {
    return jimp.read('beaver.jpg')
        .then(function (beaver) {
            baseBeaverImage = beaver.clone();
        })
        .catch(function (error) {
            console.error(error);
            process.exit(1);
        });
}

function loginToTwitter() {
    return twitter.verifyCredentialsAsync(process.env.ACCESS_TOKEN, process.env.ACCESS_TOKEN_SECRET, null)
        .then(function (data, response) {
            console.log(data["screen_name"]);
        });
}

let twitterFriends = null;
function loadTwitterFriends() {
    return twitter.followersAsync('list', null, process.env.ACCESS_TOKEN, process.env.ACCESS_TOKEN_SECRET)
    .then(function (data, response) {
        console.log(data.users.filter(user => user.following).length);
    });
}

function generateValentines() {
    if (!baseBeaverImage) {
        console.error('beaver doesn\'t exist for some reason');
        return;
    }
    jimp.loadFont(jimp.FONT_SANS_32_BLACK)
        .then(function (font) {
            const beaver = baseBeaverImage.clone();
            beaver.print(font, 105, 240, name).write(path.resolve(valentineDir, name + '.jpg'));
        });
}

function sendValentines() {

}

(function main() {
    // // step 1 - load the picture
    // loadValentine()
    // // step 2 - load the friends
    // .then(loginToTwitter)
    // .then(loadTwitterFriends)
    // // step 3 - create the valentines from the friends list and the picture
    // .then(generateValentines)
    // // step 4 - send out the valentines
    // .then(sendValentines);
    loginToTwitter()
    .then(loadTwitterFriends)
        .then(() => console.log('done'))
        .then(() => process.exit(0));
})();