import { MongoClient } from "mongodb";
import { Mutex, Semaphore, withTimeout } from "async-mutex";

import { KeyInput } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

const mutex = new Mutex();

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

  let shouldRefresh = false;
  let shouldScroll = false;

  try {
    const database = client.db("test");
    const tweets = database.collection("tweets");

    const browser = await puppeteer.launch({
      args: ["--no-sandbox", `--window-size=${width},${height}`],
      headless: false,
      defaultViewport: {
        width,
        height,
      },
    });

    const page = (await browser.pages())[0];

    // page.setRequestInterception(true);

    page.on("response", async (response) => {
      const request = response.request();
      if (
        response.request().method().toUpperCase() == "GET" &&
        request.url().includes("SearchTimeline")
      ) {
        const text = await response.json();

        const _tweets = (
          text.data.search_by_raw_query.search_timeline.timeline.instructions[0]
            .entries || []
        ).filter((t) => t.entryId.includes("tweet-"));

        let _shouldScroll = true;

        for (let index = 0; index < _tweets.length; index++) {
          const tweet = _tweets[index];

          try {
            await tweets.insertOne(tweet);
            console.log("Tweet inserted");
          } catch (error) {
            console.log("Tweet insertion failed");

            if (mutex.isLocked()) {
              console.log("Mutex is locked");
              _shouldScroll = false;
            } else {
              console.log("Preparing for refresh");

              await mutex.acquire();

              shouldScroll = false;

              await sleep(1000 * 60 * 1);

              _shouldScroll = false;
              shouldRefresh = true;

              await mutex.release();
            }

            break;
          }
        }

        shouldScroll = _shouldScroll;
      }
    });

    const navigationPromise = page.waitForNavigation();

    // const userAgents = [
    //   "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15",
    // ];

    const userAgents = [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15",
    ];

    const customUA = userAgents[Math.floor(Math.random() * userAgents.length)];

    console.log(customUA);

    await page.setUserAgent(customUA);

    await page.goto(
      "https://twitter.com/search?q=%23HackThisFall%20OR%20%23HackThisFall2024&src=typed_query&f=live"
    );

    await page.waitForNetworkIdle({ idleTime: 1500 });

    await navigationPromise;

    await sleep(3000);

    await page.screenshot({
      path: "screenshot.jpg",
    });

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

    await sleep(1000);

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

    await page.screenshot({
      path: "screenshot.jpg",
    });

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

    await page.screenshot({
      path: "screenshot.jpg",
    });

    for (let index = 0; index < pass.length; index++) {
      const char = pass[index];

      await sleep(Math.random() * 100);

      await page.keyboard.press(char as unknown as KeyInput);
    }

    await sleep(1000);

    await page.keyboard.press("Enter");

    await navigationPromise;

    await sleep(10000);

    await page.screenshot({
      path: "screenshot.jpg",
    });

    await page.goto(
      "https://twitter.com/search?q=%23HackThisFall%20OR%20%23HackThisFall2024&src=typed_query&f=live"
    );

    await page.screenshot({
      path: "screenshot.jpg",
    });

    await navigationPromise;

    const refresh = async () => {
      console.log("refresh called");
      shouldRefresh = false;
      await page.goto(
        "https://twitter.com/search?q=%23HackThisFall%20OR%20%23HackThisFall2024&src=typed_query&f=live"
      );
    };

    while (true) {
      if (shouldScroll) {
        await page.waitForNetworkIdle({ idleTime: 1500 });
        await page.evaluate(() => {
          window.scrollBy(0, 2 * window.innerHeight);
        });
      }

      if (shouldRefresh) {
        await refresh();
      }

      await sleep(1000);
    }
  } catch (error) {
    console.log(error);
  } finally {
    if (browser) await browser.close();
  }
};

runner();
