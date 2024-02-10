import { MongoClient } from "mongodb";

import { KeyInput } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

const uri =
  "mongodb://mongo:GEbA4DEC4f-CDEF-HB3b6B3e6EdB--he@roundhouse.proxy.rlwy.net:51520";

const client = new MongoClient(uri);

puppeteer.use(StealthPlugin());

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

const width = 1280;
const height = 720;

const uname = "Thoughtfulcodes";
const pass = "hug!UAK-ruq0bqf-xmv";

const runner = async () => {
  let browser;
  try {
    const database = client.db("test");
    const tweets = database.collection("tweets");

    // const a = await tweets.createIndex({ entryId: 1 }, { unique: true });
    const a = await tweets.insertMany([
      { entryId: "tweet-1753055748698014124" },
    ]);

    console.log(a);

    return;

    const browser = await puppeteer.launch({
      args: ["--no-sandbox", `--window-size=${width},${height}`],
      headless: "new",
      defaultViewport: {
        width,
        height,
      },
    });

    const page = (await browser.pages())[0];

    // page.setRequestInterception(true);

    page.on("response", async (response) => {
      const request = response.request();
      if (request.url().includes("SearchTimeline")) {
        const text = await response.json();

        const _tweets = (
          text.data.search_by_raw_query.search_timeline.timeline.instructions[0]
            .entries || []
        ).filter((t) => t.entryId.includes("tweet-"));

        tweets.insertMany(_tweets);
      }
    });

    const navigationPromise = page.waitForNavigation();

    await page.goto(
      "https://twitter.com/search?q=%23HackThisFall%20OR%20%23HackThisFall2024&src=typed_query&f=live"
    );

    await page.waitForNetworkIdle({ idleTime: 1500 });

    await navigationPromise;

    await sleep(3000);

    const usernameInputBoundingBox = {
      bottom: 373.296875,
      height: 40,
      left: 491,
      right: 789,
      top: 333.296875,
      width: 298,
      x: 491,
      y: 333.296875,
    };

    await page.mouse.click(
      usernameInputBoundingBox.x + usernameInputBoundingBox.width / 2,
      usernameInputBoundingBox.y + usernameInputBoundingBox.height / 2
    );

    await sleep(2000);

    for (let index = 0; index < uname.length; index++) {
      const char = uname[index];

      await sleep(Math.random() * 100);

      await page.keyboard.press(char as unknown as KeyInput);
    }

    await sleep(1000);

    await page.keyboard.press("Enter");

    await navigationPromise;

    const passwordInputBoundingBox = {
      x: 421,
      y: 271.296875,
      width: 438,
      height: 44,
      top: 271.296875,
      right: 859,
      bottom: 315.296875,
      left: 421,
    };

    await sleep(5000);

    await page.mouse.click(
      passwordInputBoundingBox.x + passwordInputBoundingBox.width / 2,
      passwordInputBoundingBox.y + passwordInputBoundingBox.height / 2
    );

    await sleep(2000);

    for (let index = 0; index < pass.length; index++) {
      const char = pass[index];

      await sleep(Math.random() * 1000);

      await page.keyboard.press(char as unknown as KeyInput);
    }

    await sleep(1000);

    await page.keyboard.press("Enter");

    await navigationPromise;

    await sleep(10000);

    await page.goto(
      "https://twitter.com/search?q=%23HackThisFall%20OR%20%23HackThisFall2024&src=typed_query&f=live"
    );

    await navigationPromise;

    while (true) {
      await page.waitForNetworkIdle({ idleTime: 1500 });
      await page.evaluate(() => {
        window.scrollBy(0, 2 * window.innerHeight);
      });
    }
  } catch (error) {
    console.log(error);
  } finally {
    if (browser) await browser.close();
  }
};

runner();
