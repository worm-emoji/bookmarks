const axios = require("axios");
const moment = require("moment");
const qs = require("qs");
const { DROPBOX, PINBOARD } = process.env;

const pinboardOptions = qs.stringify({
  auth_token: PINBOARD,
  tag: "publish",
  format: "json",
});

let bookmarks = null;

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

const generateMarkdown = (bookmarks) =>
  `
Title: bookmarks
Page: Yes
Permalink: /bookmarks

# Bookmarks

This page is an [occasionally updated collection](/blog/publishing-my-bookmarks) of my personal bookmarks.

${bookmarks.map(generateBookmark).join("\n\n")}
    `.trim();

const uploadToDropbox = (markdown) => {
  return axios({
    url: "https://content.dropboxapi.com/2/files/upload",
    method: "POST",
    headers: {
      Authorization: `Bearer ${DROPBOX}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({
        path: "/ylukem/pages/bookmarks.md",
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
  const markdown = generateMarkdown(bookmarks);
  await uploadToDropbox(markdown);
  console.log("Bookmarks updated");
};

exports.handler = () => {
  main();
};
