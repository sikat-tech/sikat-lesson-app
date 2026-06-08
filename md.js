const IdSize = 5;
const TitleSize = 50;
const DescSize = 100;

const record = {
  id: "00001",
  title: "A".repeat(TitleSize),
  description: "B".repeat(DescSize)
};

console.log(JSON.stringify(record).length + 1); // +1 for \n