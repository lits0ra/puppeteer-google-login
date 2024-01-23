import readline from "readline";

import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { Page } from "puppeteer";

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
      debuggingPort: 9222,
      args: ["--no-sandbox"],
      headless: false,
    });
    const page = (await browser.pages())[0];

    const navigationPromise = page.waitForNavigation();

    await page.goto("https://accounts.google.com/");

    await navigationPromise;

    await page.waitForSelector('input[type="email"]');
    await page.click('input[type="email"]');

    await navigationPromise;

    let isValidEmail;

    do {
      for (let index = 0; index < email.length; index++) {
        page.keyboard.press("Backspace");
      }

      yield {
        type: STEP_TYPES.INPUT,
        field_required: "email",
        setter: setEmail,
      };
      await page.type('input[type="email"]', email);

      await page.waitForSelector("#identifierNext");
      await page.click("#identifierNext");

      await sleep(5000);

      isValidEmail = await page.evaluate(() => {
        const emailElement = document.querySelector('input[type="email"]');

        return !emailElement?.ariaInvalid;
      });
    } while (!isValidEmail);

    await page.waitForSelector('input[type="password"]');
    await sleep(5000);

    let isValidPassword;

    do {
      for (let index = 0; index < password.length; index++) {
        page.keyboard.press("Backspace");
      }

      yield {
        type: STEP_TYPES.INPUT,
        field_required: "password",
        setter: setPassword,
      };
      await page.type('input[type="password"]', password);

      await page.waitForSelector("#passwordNext");
      await page.click("#passwordNext");

      await sleep(5000);

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
