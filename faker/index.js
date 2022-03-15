const { writeFile } = require("fs");

//#region user-configurable variables
const CHROMOSOMES = [
  { name: "chr1", from: 0, to: 19230 },
  { name: "chr2", from: 19240, to: 37130 },
  { name: "chr3", from: 37140, to: 52830 },
  { name: "chr4", from: 52840, to: 68150 },
  { name: "chr5", from: 68160, to: 83030 },
  { name: "chr6", from: 83040, to: 97700 },
  { name: "chr7", from: 97710, to: 111930 },
  { name: "chr8", from: 111940, to: 124570 },
  { name: "chr9", from: 124580, to: 136720 },
  { name: "chr10", from: 136730, to: 149480 },
  { name: "chr11", from: 149490, to: 161380 },
  { name: "chr12", from: 161390, to: 173080 },
  { name: "chr13", from: 173090, to: 184800 },
  { name: "chr14", from: 184810, to: 196980 },
  { name: "chr15", from: 196990, to: 207080 },
  { name: "chr16", from: 207090, to: 216590 },
  { name: "chr17", from: 216600, to: 225780 },
  { name: "chr18", from: 225790, to: 234550 },
  { name: "chr19", from: 234560, to: 240370 },
  { name: "chrX", from: 240380, to: 257070 },
];

const CHROMATIN_RESOLUTRION = 100000;
const DENSITY = 1.0;
const MIN_PEAK_LENGHT = 0;
const MAX_PEAK_LENGHT = 1000;
const SEPARATOR = "\t";
const VALUE_TYPE = "numerical"; // "numerical" | "textual" | "array"
const ARRAY_ELEMENTS = ["Gene1", "Gene2", "Gene3", "Gene4", "Gene5"];
//#endregion

function makeLine(chrom, from, to, value, separator) {
  return `${chrom}${separator}${from}${separator}${to}${separator}${value}`;
}

const bedFileLines = [];

for (const chromosome of CHROMOSOMES) {
  const chromosomeLength = chromosome.to - chromosome.from;
  const peaksCount = Math.floor(chromosomeLength * DENSITY);
  for (let i = 0; i < peaksCount; i++) {
    const peakLenght =
      MIN_PEAK_LENGHT +
      Math.floor((MAX_PEAK_LENGHT - MIN_PEAK_LENGHT) * Math.random());
    const peakBegining =
      Math.floor(chromosomeLength * Math.random()) * CHROMATIN_RESOLUTRION;
    let peakValue = "";
    if (VALUE_TYPE == "numerical") {
      peakValue = Math.random();
    }
    if (VALUE_TYPE == "array") {
      peakValue = Math.floor(Math.random() * ARRAY_ELEMENTS.length);
    }
    bedFileLines.push(
      makeLine(
        chromosome.name,
        peakBegining,
        peakBegining + peakLenght,
        peakValue,
        SEPARATOR
      )
    );
  }
}

writeFile("./output.bed", bedFileLines.join("\n"), (err) => {
  if (err) {
    console.error(err);
    return;
  }
});
