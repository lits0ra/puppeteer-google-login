import jimp from "jimp";

async function main() {
  const image = await jimp.read("screenshot.jpg");
  const img = image.greyscale().autocrop({ cropSymmetric: true });
  img.write(`contrast.png`);
}

// const range = [-1, -0.9, -0.8, -0.7, -0.6, -0.5, -0.4, -0.3, -0.2, -0.1, 0]
//   .map((a) => [a, a * -1])
//   .flat()
//   .forEach((i) => main());

main();
