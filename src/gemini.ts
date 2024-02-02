import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";

// Access your API key as an environment variable (see "Set up your API key" above)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);

// Converts local file information to a GoogleGenerativeAI.Part object.
function fileToGenerativePart(path, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(path)).toString("base64"),
      mimeType,
    },
  };
}

const height = 720;
const width = 1280;

async function run() {
  // For text-and-image input (multimodal), use the gemini-pro-vision model
  const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });

  const prompt = `This is a screenshot is ${width}px wide and ${height}px in height. 
  Some coordinates have been written on the image in (x,y) format.

  I need the below items as output from you in a JSON object.
  Only write what you see. Don't add anything on your own.

  "inputs": This is the first key where you will push all the input fields where typing is possible along with the FIELD LABELS. Make this an array of strings

  "buttons": This is the next key where you will push all buttons along with the text to recognise it. Buttons can be colorful or not. Make this an array of strings

  "options": This is the field where you will give an array of strings to identify all the options on this page. Navbar and Footer options don't count. Checkboxes don't count

  "is_logged_in": This is a boolean to determine if there is any step pending in the login process. If pending, return false. Else true

  Just output the object without wrapping in any text(like \`\`\`json) or code block

  For each of "inputs", "buttons", "options"; Provide "inputs_positions", "buttons_positions", "options_positions" in below format

  Provide an answer in the form of {x: number; y: number; width: number; height: number;} json object. 
  Here x is the number of pixels from left where the bounding box starts, and y is the number of pixels from top where the box starts
  width and height are those of the bounding box.
  Do not consider the borders in calculation
  
  Can you tell me the starting and ending coordinates of the bounding box. It is a very small rectangle.
  Just output the object without wrapping in any text or code block`;

  const imageParts = [fileToGenerativePart("screenshot.png", "image/png")];

  const result = await model.generateContent([prompt, ...imageParts]);
  const response = await result.response;
  const text = response.text();
  console.log(text);
}

run();
