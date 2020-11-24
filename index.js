const axios = require("axios");
const moment = require("moment");
const qs = require("qs");
const _ = require("lodash");
const { DROPBOX, PINBOARD } = process.env;

const pinboardOptions = qs.stringify({
  auth_token: PINBOARD,
  tag: "publish",
  format: "json",
});

let bookmarks = null;
let posts = null;

const getBookmarks = async () => {
  const req = await axios({
    url: `https://api.pinboard.in/v1/posts/all?${pinboardOptions}`,
  });

  if (typeof req.data === "string") {
    // So for some reason, Pinboard is sending empty width space characters
    // which is messing with the JSON parser. This strips them and parses
    // the JSON.
    const json = JSON.parse(req.data.replace(/[\u200B-\u200D\uFEFF]/g, ""));
    return json;
  }

  // If Pinboard fixes their API, this codepath should work like normal again.
  return req.data;
};

const getPosts = async () => {
  const req = await axios({
    url: `https://ylukem.com/page/1?debug=true`,
  });
  return req.data;
};

const generateTS = (time) => moment(time).format("MMMM YYYY");

const generateBookmark = ({ href, description, time }, index) => {
  let bookmark = "";

  const ts = generateTS(time);
  let previousTS = null;
  const previous = bookmarks[index - 1];
  if (typeof previous != "undefined") {
    previousTS = generateTS(previous.time);
  }

  if (ts != previousTS) {
    bookmark += `<span class="bookmark-month">${ts}</span>`;
    bookmark += "\n\n";
  }

  const host = new URL(href).hostname.replace("www.", "");

  let day = moment(time).format("MMMM Do");
  let dayClass = "bookmark-day";

  if (moment(time).isAfter(moment().subtract(12, "hours"))) {
    dayClass += " bookmark-day-recent";
    day = moment(time).fromNow();
  }

  bookmark += `<span class="bookmark">[${description}](${href}) <span class="hostname">${host}</span> <span class="${dayClass}">${day}</span></span>`;
  return bookmark;
};

const bookmarkMarkdown = (bookmarks) =>
  `
Title: bookmarks
Page: Yes
Permalink: /bookmarks

# Bookmarks

This page is an [occasionally updated collection](/blog/publishing-my-bookmarks) of my personal bookmarks.

${bookmarks.map(generateBookmark).join("\n\n")}
    `.trim();

const indexMarkdown = (posts, bookmarks) => {
  const { entries } = posts;

  const postHTML = _.take(entries, 3).map(
    ({ date, title, url }) =>
      `
  <p class="index-entry">
  <div><span class="index-date">${date}</span>
  <div class="tags-date">
  </div>
  </div>
  <div class="details">
  <a href="${url}">${title}</a>
  </div>
  </p>
  `
  );

  const bookmarkHTML = _.take(bookmarks, 3).map(({ href, description }) => {
    const host = new URL(href).hostname.replace("www.", "");
    return `
<p><a href="${href}">${description}</a> <span class="hostname">${host}</span></p>
    `;
  });

  return `Title: about
Page: Yes
Menu: No
Permalink: /
Summary: My name is luke miles and I'm a software engineer based in San Francisco. 

My name is luke miles and I'm based in San Francisco. 

Professionally, I'm a software engineer. In the past, I've [started a company][1] (now defunct), worked at [Stripe][2] on new products, and freelanced for a little bit. I currently work at [byte][3].

You can find me on [GitHub][4], [Twitter][5], and [byte][6]. If you'd like to get in touch 
with me, please email me at [hello@lukemil.es][7] and I'll try to respond.

<div class="show">
<div class="s-half">
## Writing
${postHTML.join("\n")}

[More →](/page/1)
</div>

<div class="s-half">
## Bookmarks
${bookmarkHTML.join("\n")}

[More →](/bookmarks)
</div>
</div>

## Other publishing

* I share my screenshots at [luke.cat][8]
* Every time I spend money, [a bot tweets it][9]
* I’m working on a journaling app for iOS called “posting!”, due for release by the end of 2020


[1]:	https://www.gq.com/story/restocks-app-luke-miles
[2]:	https://stripe.com
[3]:	https://byte.co
[4]:	https://github.com/ylukem
[5]:	https://twitter.com/ylukem
[6]:	https://byte.co/@luke
[7]:	mailto:hello@lukemil.es
[8]:	https://luke.cat
[9]:	/ch
`;
};

const uploadToDropbox = (markdown, page) => {
  return axios({
    url: "https://content.dropboxapi.com/2/files/upload",
    method: "POST",
    headers: {
      Authorization: `Bearer ${DROPBOX}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({
        path: `/ylukem/pages/${page}.md`,
        mode: "overwrite",
        mute: true,
      }),
    },
    data: Buffer.from(markdown),
  });
};

const main = async () => {
  bookmarks = await getBookmarks();
  console.log("Fetched bookmarks from pinboard");

  const markdown = bookmarkMarkdown(bookmarks);
  await uploadToDropbox(markdown, "bookmarks");
  console.log("Bookmarks updated");

  posts = await getPosts();
  console.log("Fetched posts from blot");

  const index = indexMarkdown(posts, bookmarks);
  await uploadToDropbox(index, "about");
  console.log("About updated");
};

exports.handler = () => {
  main();
};

main();
