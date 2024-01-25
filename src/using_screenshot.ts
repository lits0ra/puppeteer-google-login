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

const height = 1024;
const width = 512;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const prompt = (query) => new Promise((resolve) => rl.question(query, resolve));

puppeteer.use(StealthPlugin());

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
  let email = "";
  let password = "";
  let phoneNumber = "";
  let mfaPicklistVal;
  let maxMfaPicklistVal;
  let mfaVal = "";

  const setEmail = (_email) => {
    email = _email;
  };

  const setPassword = (_pass) => {
    password = _pass;
  };

  const setPhoneNumber = (_phone) => {
    phoneNumber = _phone;
  };

  const setMfaVal = (_value) => {
    mfaVal = _value;
  };

  const setMfaPicklistVal = (_value) => {
    const int = parseInt(_value);
    if (!!int && int <= maxMfaPicklistVal) {
      mfaPicklistVal = int;
    }
  };

  return async function* worker(): AsyncGenerator<
    ReceiveInputText | ReceiveInputPicklist | Output
  > {
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

    await navigationPromise;

    await sleep(2000);

    page.mouse.click(0, 0);

    await page.screenshot({
      path: "screenshot.jpg",
    });

    let response = await openai.chat.completions.create({
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
              Provide an answer in the form of {x_topleft: number; y_topleft: number; width: number; height: number;} json object. 
              Here x_topleft is the x coordinate where the input box starts, and y_topleft is the y coordinate where the box starts
              width and height are those of the input box.
              Do not consider the borders in calculation
              
              Can you tell me the starting and ending coordinates of the input box. It is a very small rectangle.              
              ${
                "" // Can you tell me the coordinates where I should click so that it is inside the email input element box in the screenshot?
                // Make sure the response can pass through JSON.parse in Javascript.
              }
              Just output the object without wrapping in any text or code block`,
            },
          ],
        },
      ],
    } as any);

    console.log(response.choices[0].message.content);
    const email_field_coordinates = JSON.parse(
      response.choices[0].message.content
    );

    console.log(
      `document.elementFromPoint(${
        email_field_coordinates.x_topleft + email_field_coordinates.width / 4
      },${
        email_field_coordinates.y_topleft + email_field_coordinates.height / 4
      })`
    );

    let isValidEmail;

    do {
      page.mouse.click(
        email_field_coordinates.x_topleft + email_field_coordinates.width / 4,
        email_field_coordinates.y_topleft + email_field_coordinates.height / 4
      );

      for (let index = 0; index < email.length; index++) {
        page.keyboard.press("Backspace");
      }

      yield {
        type: STEP_TYPES.INPUT,
        field_required: "email",
        setter: setEmail,
      };

      page.mouse.click(
        email_field_coordinates.x_topleft + email_field_coordinates.width / 4,
        email_field_coordinates.y_topleft + email_field_coordinates.height / 4
      );

      email.split("").forEach((k) => {
        page.keyboard.press(k as unknown as KeyInput);
      });

      page.keyboard.press("Enter");

      await sleep(5000);

      await page.screenshot({
        path: "screenshot.jpg",
      });

      const response = await openai.chat.completions.create({
        model: "gpt-4-vision-preview",
        max_tokens: 4096,
        // response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "Image input capabilities: Enabled",
          },
          {
            role: "system",
            content: "You are a helpful assistant designed to output JSON.",
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
                text: `This screenshot is ${width}px x ${height}px.
                Can you tell me if the email input field is invalid or not? If it is not visible, response with VALID 
                Try to be as precise as one can be with specialised tools, but provide an answer in the form of VALID or INVALID. 
                Just output one word`,
              },
            ],
          },
        ],
      } as any);

      isValidEmail = response.choices[0].message.content === "VALID";

      // isValidEmail = await page.evaluate(() => {
      //   const emailElement = document.querySelector('input[type="email"]');

      //   return !emailElement?.ariaInvalid;
      // });
    } while (!isValidEmail);

    await navigationPromise;

    await sleep(2000);

    page.mouse.click(0, 0);

    await page.screenshot({
      path: "screenshot.jpg",
    });

    response = await openai.chat.completions.create({
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
              Provide an answer in the form of {x_topleft: number; y_topleft: number; width: number; height: number;} json object. 
              Here x_topleft is the x coordinate where the input box starts, and y_topleft is the y coordinate where the box starts
              width and height are those of the input box.
              Do not consider the borders in calculation
              
              Can you tell me the starting and ending coordinates of the input box. It is a very small rectangle.              
              ${
                "" // Can you tell me the coordinates where I should click so that it is inside the email input element box in the screenshot?
                // Make sure the response can pass through JSON.parse in Javascript.
              }
              Just output the object without wrapping in any text or code block`,
            },
          ],
        },
      ],
    } as any);

    console.log(response.choices[0].message.content);
    const pass_field_coordinates = JSON.parse(
      response.choices[0].message.content
    );

    console.log(
      `document.elementFromPoint(${
        pass_field_coordinates.x_topleft + pass_field_coordinates.width / 4
      },${
        pass_field_coordinates.y_topleft + pass_field_coordinates.height / 4
      })`
    );

    let isValidPassword;

    do {
      page.mouse.click(
        pass_field_coordinates.x_topleft + pass_field_coordinates.width / 4,
        pass_field_coordinates.y_topleft + pass_field_coordinates.height / 4
      );

      for (let index = 0; index < password.length; index++) {
        page.keyboard.press("Backspace");
      }

      yield {
        type: STEP_TYPES.INPUT,
        field_required: "password",
        setter: setPassword,
      };

      page.mouse.click(
        pass_field_coordinates.x_topleft + pass_field_coordinates.width / 4,
        pass_field_coordinates.y_topleft + pass_field_coordinates.height / 4
      );

      password.split("").forEach((k) => {
        page.keyboard.press(k as unknown as KeyInput);
      });

      page.keyboard.press("Enter");

      await sleep(5000);

      await page.screenshot({
        path: "screenshot.jpg",
      });

      isValidPassword = await page.evaluate(() => {
        const passwordElement = document.querySelector(
          'input[type="password"]'
        );

        return !passwordElement?.ariaInvalid;
      });
    } while (!isValidPassword);

    await navigationPromise;

    let currentUrl = await page.url();

    let isLoggedIn = currentUrl.includes("myaccount.google.com");

    if (isLoggedIn) return;

    await page.waitForSelector("button");

    await page.evaluate(() => {
      const buttons = document.querySelectorAll("button");
      const anotherWayButton = buttons[buttons.length - 1];
      anotherWayButton.click();
    });

    await navigationPromise;

    await page.waitForSelector('input[name="challengeListId"]');

    // const mfaItems = [];
    const mfaItems = (await page.evaluate(() => {
      const listItems = document
        .querySelector('input[name="challengeListId"]')
        .parentElement.querySelector("ul")
        .querySelectorAll("li");

      const listItemsCleaned = [];

      listItems.forEach((li) => listItemsCleaned.push(li.innerText));

      return listItemsCleaned;
    })) as unknown as Array<string>;

    maxMfaPicklistVal = mfaItems.length;

    do {
      yield {
        type: STEP_TYPES.PICKLIST,
        field_required: "MFA Choice",
        options: mfaItems,
        setter: setMfaPicklistVal,
      };
    } while (!mfaPicklistVal || mfaPicklistVal <= 0);

    await sleep(5000);

    await page.evaluate((mfaPicklistVal) => {
      const listItems = document
        .querySelector('input[name="challengeListId"]')
        .parentElement.querySelector("ul")
        .querySelectorAll("li");

      listItems[mfaPicklistVal - 1].querySelector("div").click();
    }, mfaPicklistVal);

    await navigationPromise;

    if (
      mfaItems[mfaPicklistVal - 1].includes("Standard rates apply") &&
      !phoneNumber
    ) {
      await page.waitForSelector('input[type="tel"]');
      await sleep(5000);

      let isValidPhone;

      do {
        for (let index = 0; index < phoneNumber.length; index++) {
          page.keyboard.press("Backspace");
        }

        yield {
          type: STEP_TYPES.INPUT,
          field_required: "phone with country code (ex. +91)",
          setter: setPhoneNumber,
        };
        await page.type('input[type="tel"]', phoneNumber);

        await page.keyboard.down("Enter");

        await sleep(5000);

        isValidPhone = await page.evaluate(() => {
          const phoneElement = document.querySelector('input[type="tel"]');

          if (phoneElement?.ariaInvalid === "false") return true;

          return !phoneElement?.ariaInvalid;
        });
      } while (!isValidPhone);
    }

    await navigationPromise;

    let isValidMfaCode;

    do {
      for (let index = 0; index < mfaVal.length; index++) {
        page.keyboard.press("Backspace");
      }

      yield {
        type: STEP_TYPES.INPUT,
        field_required: "MFA Code",
        setter: setMfaVal,
      };

      await page.type('input[type="tel"]', mfaVal);

      await page.keyboard.down("Enter");

      await sleep(10000);
      await navigationPromise;

      isValidMfaCode = await page.evaluate(() => {
        const phoneElement = document.querySelector('input[type="tel"]');

        if (phoneElement?.ariaInvalid === "false") return true;

        return !phoneElement?.ariaInvalid;
      });
    } while (!isValidMfaCode);

    await navigationPromise;

    currentUrl = await page.url();

    isLoggedIn = currentUrl.includes("myaccount.google.com");

    if (isLoggedIn) {
      await page.waitForSelector("h1");

      const username = await page.evaluate(() => {
        return document.querySelector("h1").innerText;
      });

      return { type: STEP_TYPES.OUTPUT, value: username };
    }
  };
}

const runner = async () => {
  const worker = loginToGoogle()();

  do {
    const generatedOutput = await worker.next();

    if (generatedOutput.value.type === STEP_TYPES.INPUT) {
      const input_value = await prompt(
        `Enter your ${generatedOutput.value.field_required}: `
      );
      generatedOutput.value.setter(input_value);
    }

    if (generatedOutput.value.type === STEP_TYPES.PICKLIST) {
      let input_prompt = `Pick your preferred ${generatedOutput.value.field_required}\n`;

      input_prompt += generatedOutput.value.options
        .map((op, i) => `${i + 1}. ${op}`)
        .join("\n");

      input_prompt += `\nEnter value (1 - ${generatedOutput.value.options.length}): `;

      const input_value = await prompt(input_prompt);
      generatedOutput.value.setter(input_value);
    }

    if (generatedOutput.value.type === STEP_TYPES.OUTPUT) {
      console.log(generatedOutput.value.value);
    }

    if (generatedOutput.done) return;
  } while (true);
};

runner();
