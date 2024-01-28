import readline from "readline";

import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { KeyInput, Page } from "puppeteer";

import OpenAI from "openai";
import fs from "fs";
import { ChatCompletionContentPartImage } from "openai/resources/index.mjs";

const convertToBase64 = (file) => {
  let fileData = fs.readFileSync(file);
  return Buffer.from(fileData).toString("base64");
};

const height = 1080;
const width = 1280;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const prompt = (query) => new Promise((resolve) => rl.question(query, resolve));

puppeteer.use(StealthPlugin());

const checkIfInput = async () => {
  const response = await openai.chat.completions.create({
    seed: 397428934,
    temperature: 1,
    model: "gpt-4-vision-preview",
    max_tokens: 4096,
    messages: [
      {
        role: "system",
        content: "Image input capabilities: Enabled",
      },
      {
        role: "system",
        content:
          "You are a helpful assistant designed to output JSON. This is a game, where every correct output will give you one point, and every wrong one will deduct 3 points",
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: `data:image/jpeg;base64,${convertToBase64(
              "./screenshot.jpg"
            )}` as unknown as ChatCompletionContentPartImage.ImageURL,
          },
          {
            type: "text",
            text: `This screenshot is ${width}px wide and ${height}px in height. 
            I need the below items as output from you in a JSON object.
            Only write what you see. Don't add anything on your own.

            "inputs": This is the first key where you will push all the input fields where typing is possible along with the FIELD LABELS. Make this an array of strings

            "buttons": This is the next key where you will push all buttons along with the text to recognise it. Buttons can be colorful or not. Make this an array of strings

            "options": This is the field where you will give an array of strings to identify all the options on this page. Navbar and Footer options don't count. Checkboxes don't count

            "is_logged_in": This is a boolean to determine if there is any step pending in the login process. If pending, return false. Else true

            Just output the object without wrapping in any text(like \`\`\`json) or code block`,
          },
        ],
      },
    ],
  } as any);

  return response.choices[0].message.content;
};

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

enum STEP_TYPES {
  INPUT = "INPUT",
  PICKLIST = "PICKLIST",
  OUTPUT = "OUTPUT",
}

type ReceiveInputText = {
  type: STEP_TYPES;
  field_required: string;
  setter: Function;
};

type ReceiveInputPicklist = {
  type: STEP_TYPES;
  field_required: string;
  options: Array<string>;
  setter: Function;
};

type Output = {
  type: STEP_TYPES;
  value: string;
};

function loginToGoogle() {
  let isLoggedIn = false;

  let action: any = {};

  const setAction = (_val) => {
    action = _val;
  };

  return async function* worker(): AsyncGenerator<any> {
    const browser = await puppeteer.launch({
      args: ["--no-sandbox", `--window-size=${width},${height}`],
      headless: false,
      defaultViewport: {
        width,
        height,
      },
    });

    const page = (await browser.pages())[0];

    await page.setRequestInterception(true);

    page.on("request", (req) => {
      if (
        req.resourceType() == "stylesheet" ||
        req.resourceType() == "font" ||
        req.resourceType() == "image"
      ) {
        req.abort();
      } else {
        req.continue();
      }
    });

    const navigationPromise = page.waitForNavigation();

    await page.goto("https://accounts.google.com/", {
      waitUntil: "networkidle0",
    });

    do {
      await page.screenshot({
        path: "screenshot.jpg",
      });

      const pageDetailsRaw = await checkIfInput();

      const pageDetails = JSON.parse(pageDetailsRaw);

      if (pageDetails.is_logged_in) {
        isLoggedIn = true;
        break;
      }

      yield { pageDetails, setter: setAction };

      let elementBounds;

      if (action.category === "inputs") {
        elementBounds = await page.evaluate((action) => {
          const inputs = document.querySelectorAll("input");

          for (let index = 0; index < inputs.length; index++) {
            const element = inputs[index];

            if (
              element?.ariaLabel?.includes(action?.subcategory) ||
              action?.subcategory?.includes(element?.ariaLabel)
            ) {
              const rect = element.getBoundingClientRect();

              return {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                bottom: rect.bottom,
                left: rect.left,
                right: rect.right,
                top: rect.top,
              };
            }
          }
        }, action);

        if (elementBounds) {
          await page.mouse.click(
            elementBounds.x + elementBounds.width / 2,
            elementBounds.y + elementBounds.height / 2
          );

          for (let index = 0; index < action.value.length; index++) {
            const k = action.value[index];

            await page.keyboard.press(k as unknown as KeyInput);
          }

          await page.keyboard.press("Enter");
        }
      } else if (
        action.category === "options" ||
        action.category === "buttons"
      ) {
        elementBounds = await page.evaluate((action) => {
          const options = document.querySelectorAll("li,button,a");

          for (let index = 0; index < options.length; index++) {
            const element = options[index] as any;

            if (element.innerText.includes(action.subcategory)) {
              const rect = element.getBoundingClientRect();

              return {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                bottom: rect.bottom,
                left: rect.left,
                right: rect.right,
                top: rect.top,
              };
            }
          }
        }, action);

        if (elementBounds) {
          await page.mouse.click(
            elementBounds.x + elementBounds.width / 2,
            elementBounds.y + elementBounds.height / 2
          );
        }
      }

      await navigationPromise;

      await sleep(5000);
    } while (!isLoggedIn);

    if (isLoggedIn) {
      console.log("User is logged in");
      yield {
        pageDetails: "Logged in page",
        setter: setAction,
      };
    }
  };
}

const runner = async () => {
  const worker = loginToGoogle()();

  do {
    const generatedOutput = await worker.next();

    const { pageDetails, setter } = generatedOutput.value;

    let text_to_be_displayed = "";

    Object.keys(pageDetails).forEach((k, i) => {
      if (["inputs", "buttons", "options"].includes(k)) {
        text_to_be_displayed += `${i}. ${k}:\n`;
        text_to_be_displayed +=
          pageDetails[k]
            .map((t, i) => `\t${String.fromCharCode(i + 65)}. ${t}`)
            .join("\n") + "\n";
      }
    });

    console.log(text_to_be_displayed);

    const category = (await prompt(`Enter category (digit): `)) as string;
    const subcategory = (await prompt(
      `Enter option in category (character): `
    )) as string;
    let value;

    if (Object.keys(pageDetails)[parseInt(category)] === "inputs") {
      value = await prompt(
        `Enter value for ${
          pageDetails.inputs[subcategory.charCodeAt(0) - 65]
        }: `
      );
    }

    setter({
      category: Object.keys(pageDetails)[parseInt(category)],
      subcategory:
        pageDetails[Object.keys(pageDetails)[parseInt(category)]][
          subcategory.charCodeAt(0) - 65
        ],
      value,
    });
  } while (true);
};

runner();
