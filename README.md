### Login to Google using command line

The program will ask for your inputs on the command line (email, password, MFA method (and code))

Currently only MFA methods that take a user input (in form of a code) work

---

To run the project, you need Node v20

Install dependencies `npm i`  
And run using `npm run start`

### Update: 28 Jan 2024

Getting bounds using OpenAI was a very iffy method. It was working 100% of the times one day, and next day, it just kept failing. SO I decided on just recognising options using OpenAI, and then finding the coordinates myself. This approach seems to be working without hard-coding almost anything
